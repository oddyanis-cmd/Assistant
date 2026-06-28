-- =============================================================================
-- Shiny Beauty Center — Phase 7: Finance, HR, Manual Payments, Service Photos,
--                                 Custom Roles, Currency=QAR, Performance
-- Migration: 008_phase7.sql
-- Idempotent — safe to re-run.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. CURRENCY → QAR (single source of truth is app config; fix DB defaults too)
-- ---------------------------------------------------------------------------
alter table public.payments   alter column currency set default 'QAR';
alter table public.gift_cards  alter column currency set default 'QAR';
update public.payments  set currency = 'QAR' where currency = 'SAR';
update public.gift_cards set currency = 'QAR' where currency = 'SAR';

-- ---------------------------------------------------------------------------
-- 2. SERVICE PHOTOS — image column + public Storage bucket + RLS
-- ---------------------------------------------------------------------------
alter table public.services add column if not exists image_url text;

-- Public bucket so the client catalog can show photos via public URL.
insert into storage.buckets (id, name, public)
values ('service-images', 'service-images', true)
on conflict (id) do nothing;

-- Anyone may read; only users with edit_service may upload/replace/remove.
drop policy if exists "service-images read" on storage.objects;
create policy "service-images read" on storage.objects
  for select using (bucket_id = 'service-images');

drop policy if exists "service-images insert" on storage.objects;
create policy "service-images insert" on storage.objects
  for insert with check (
    bucket_id = 'service-images'
    and public.has_permission(auth.uid(), 'edit_service')
  );

drop policy if exists "service-images update" on storage.objects;
create policy "service-images update" on storage.objects
  for update using (
    bucket_id = 'service-images'
    and public.has_permission(auth.uid(), 'edit_service')
  ) with check (
    bucket_id = 'service-images'
    and public.has_permission(auth.uid(), 'edit_service')
  );

drop policy if exists "service-images delete" on storage.objects;
create policy "service-images delete" on storage.objects
  for delete using (
    bucket_id = 'service-images'
    and public.has_permission(auth.uid(), 'edit_service')
  );

-- ---------------------------------------------------------------------------
-- 3. MANUAL / OFFLINE PAYMENTS — record cash/card-in-person against a booking
-- ---------------------------------------------------------------------------
create or replace function public.record_manual_payment(
  p_appointment_id uuid,
  p_amount         numeric,
  p_method         text default 'cash',     -- 'cash' | 'card' | 'transfer'
  p_reference      text default null,        -- optional receipt / txn ref
  p_currency       text default 'QAR'
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid        uuid;
  v_client_id  uuid;
  v_price      numeric(10,2);
  v_user_id    uuid;
  v_invoice_id uuid;
  v_total      numeric(10,2);
  v_paid_sum   numeric(10,2);
  v_payment_id uuid;
  v_points     int;
  v_inv_status public.payment_status;
begin
  v_uid := auth.uid();
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;
  if not public.has_permission(v_uid, 'process_payments') then
    raise exception 'Forbidden: missing process_payments';
  end if;
  if p_amount is null or p_amount <= 0 then
    raise exception 'Payment amount must be greater than zero';
  end if;
  if p_method not in ('cash', 'card', 'transfer') then
    raise exception 'Invalid payment method: %', p_method;
  end if;

  -- Resolve appointment → client, price, owning user
  select a.client_id, s.price, c.user_id
  into   v_client_id, v_price, v_user_id
  from   public.appointments a
  join   public.services s on s.id = a.service_id
  join   public.clients  c on c.id = a.client_id
  where  a.id = p_appointment_id;

  if not found then
    raise exception 'Appointment not found: %', p_appointment_id;
  end if;

  -- Find or create an invoice for this appointment
  select id, total into v_invoice_id, v_total
  from   public.invoices
  where  appointment_id = p_appointment_id
  order  by created_at
  limit  1;

  if v_invoice_id is null then
    insert into public.invoices (client_id, appointment_id, subtotal, status)
    values (v_client_id, p_appointment_id, coalesce(v_price, 0), 'pending')
    returning id, total into v_invoice_id, v_total;
  end if;

  -- Record the payment as paid
  insert into public.payments
    (appointment_id, invoice_id, amount, currency, status, provider, provider_ref, charge_mode)
  values
    (p_appointment_id, v_invoice_id, p_amount, p_currency, 'paid', p_method, p_reference, 'full')
  returning id into v_payment_id;

  -- Total paid so far against this invoice
  select coalesce(sum(amount), 0) into v_paid_sum
  from   public.payments
  where  invoice_id = v_invoice_id and status = 'paid';

  if v_paid_sum >= v_total then
    v_inv_status := 'paid';
    update public.invoices set status = 'paid', paid_at = now() where id = v_invoice_id;
  else
    v_inv_status := 'partial';
    update public.invoices set status = 'partial' where id = v_invoice_id;
  end if;

  -- Recording a payment implies the client showed up — confirm if still pending
  update public.appointments set status = 'confirmed'
  where id = p_appointment_id and status = 'pending';

  -- Award loyalty once, when the invoice is fully paid
  if v_inv_status = 'paid' and v_user_id is not null and v_price is not null
     and not exists (
       select 1 from public.loyalty_points
       where ref_type = 'appointment' and ref_id = p_appointment_id
     ) then
    v_points := floor(v_price / 100) * 10;
    if v_points > 0 then
      insert into public.loyalty_points (client_id, points, reason, ref_type, ref_id)
      values (v_client_id, v_points, 'Booking reward (paid at salon)', 'appointment', p_appointment_id);
    end if;
  end if;

  insert into public.audit_log (user_id, action, table_name, record_id, new_data)
  values (v_uid, 'INSERT', 'payments', v_payment_id,
    jsonb_build_object('appointment_id', p_appointment_id, 'amount', p_amount,
                       'method', p_method, 'invoice_status', v_inv_status));

  return v_payment_id;
end;
$$;

grant execute on function public.record_manual_payment(uuid, numeric, text, text, text)
  to authenticated;

-- Refund a recorded payment
create or replace function public.refund_payment(
  p_payment_id uuid,
  p_reason     text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid        uuid;
  v_invoice_id uuid;
begin
  v_uid := auth.uid();
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;
  if not public.has_permission(v_uid, 'issue_refund') then
    raise exception 'Forbidden: missing issue_refund';
  end if;

  update public.payments set status = 'refunded'
  where id = p_payment_id and status = 'paid'
  returning invoice_id into v_invoice_id;

  if not found then
    raise exception 'Payment not found or not in a refundable state';
  end if;

  if v_invoice_id is not null then
    update public.invoices set status = 'refunded' where id = v_invoice_id;
  end if;

  insert into public.audit_log (user_id, action, table_name, record_id, new_data)
  values (v_uid, 'UPDATE', 'payments', p_payment_id,
    jsonb_build_object('refunded', true, 'reason', p_reason));
end;
$$;

grant execute on function public.refund_payment(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 4. FINANCE — expenses ledger
-- ---------------------------------------------------------------------------
create table if not exists public.expenses (
  id           uuid primary key default gen_random_uuid(),
  category     text not null,
  description  text,
  amount       numeric(10,2) not null check (amount >= 0),
  currency     text not null default 'QAR',
  incurred_on  date not null default current_date,
  vendor       text,
  created_by   uuid references public.profiles(id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create trigger expenses_updated_at
  before update on public.expenses
  for each row execute function public.set_updated_at();

create index if not exists idx_expenses_incurred on public.expenses(incurred_on desc);

alter table public.expenses enable row level security;

drop policy if exists "expenses: read" on public.expenses;
create policy "expenses: read" on public.expenses for select
  using (
    public.has_permission(auth.uid(), 'view_financial_reports')
    or public.has_permission(auth.uid(), 'manage_expenses')
  );

drop policy if exists "expenses: write" on public.expenses;
create policy "expenses: write" on public.expenses for all
  using (public.has_permission(auth.uid(), 'manage_expenses'))
  with check (public.has_permission(auth.uid(), 'manage_expenses'));

-- ---------------------------------------------------------------------------
-- 5. HR — employee fields, attendance, payroll
-- ---------------------------------------------------------------------------
alter table public.staff_profiles add column if not exists job_title       text;
alter table public.staff_profiles add column if not exists employment_type text;   -- full_time | part_time | contract
alter table public.staff_profiles add column if not exists hired_on        date;
alter table public.staff_profiles add column if not exists base_salary     numeric(10,2);

-- Allow HR / staff viewers to read the employee directory (additive policy)
drop policy if exists "staff_profiles: hr read" on public.staff_profiles;
create policy "staff_profiles: hr read" on public.staff_profiles for select
  using (
    public.has_permission(auth.uid(), 'view_employees')
    or public.has_permission(auth.uid(), 'view_staff')
  );

create table if not exists public.attendance (
  id          uuid primary key default gen_random_uuid(),
  staff_id    uuid not null references public.staff_profiles(id) on delete cascade,
  work_date   date not null default current_date,
  check_in    timestamptz,
  check_out   timestamptz,
  status      text not null default 'present',  -- present | absent | late | leave
  notes       text,
  created_by  uuid references public.profiles(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (staff_id, work_date)
);

create trigger attendance_updated_at
  before update on public.attendance
  for each row execute function public.set_updated_at();

create index if not exists idx_attendance_staff_date on public.attendance(staff_id, work_date desc);

alter table public.attendance enable row level security;

drop policy if exists "attendance: read" on public.attendance;
create policy "attendance: read" on public.attendance for select
  using (
    public.has_permission(auth.uid(), 'manage_attendance')
    or public.has_permission(auth.uid(), 'view_hr_reports')
    or public.has_permission(auth.uid(), 'view_employees')
    or exists (
      select 1 from public.staff_profiles sp
      where sp.id = staff_id and sp.user_id = auth.uid()
    )
  );

drop policy if exists "attendance: write" on public.attendance;
create policy "attendance: write" on public.attendance for all
  using (public.has_permission(auth.uid(), 'manage_attendance'))
  with check (public.has_permission(auth.uid(), 'manage_attendance'));

create table if not exists public.payroll (
  id            uuid primary key default gen_random_uuid(),
  staff_id      uuid not null references public.staff_profiles(id) on delete cascade,
  period_start  date not null,
  period_end    date not null,
  base_amount   numeric(10,2) not null default 0,
  commission    numeric(10,2) not null default 0,
  deductions    numeric(10,2) not null default 0,
  net_amount    numeric(10,2) not null generated always as (base_amount + commission - deductions) stored,
  currency      text not null default 'QAR',
  status        text not null default 'draft',   -- draft | approved | paid
  notes         text,
  created_by    uuid references public.profiles(id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint payroll_period_check check (period_end >= period_start)
);

create trigger payroll_updated_at
  before update on public.payroll
  for each row execute function public.set_updated_at();

create index if not exists idx_payroll_staff on public.payroll(staff_id, period_end desc);

alter table public.payroll enable row level security;

drop policy if exists "payroll: read" on public.payroll;
create policy "payroll: read" on public.payroll for select
  using (
    public.has_permission(auth.uid(), 'manage_payroll')
    or public.has_permission(auth.uid(), 'view_hr_reports')
    or exists (
      select 1 from public.staff_profiles sp
      where sp.id = staff_id and sp.user_id = auth.uid()
    )
  );

drop policy if exists "payroll: write" on public.payroll;
create policy "payroll: write" on public.payroll for all
  using (public.has_permission(auth.uid(), 'manage_payroll'))
  with check (public.has_permission(auth.uid(), 'manage_payroll'));

-- ---------------------------------------------------------------------------
-- 6. CUSTOM ROLES (positions) — admin can create/edit/delete roles
-- ---------------------------------------------------------------------------
alter table public.roles add column if not exists is_system boolean not null default false;

-- Protect the seeded roles from deletion / rename
update public.roles set is_system = true
where name in ('Admin','Manager','Sales','Customer Service','Finance','HR','Staff','Client');

-- Create a new role, or update an existing one's description + permission set.
-- System roles keep their name (only description + permissions are editable).
create or replace function public.admin_upsert_role(
  p_id          uuid,
  p_name        text,
  p_description text,
  p_permissions text[]
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid       uuid;
  v_role_id   uuid;
  v_is_system boolean;
begin
  v_uid := auth.uid();
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;
  if not public.has_permission(v_uid, 'manage_permissions') then
    raise exception 'Forbidden: missing manage_permissions';
  end if;
  if p_name is null or length(trim(p_name)) = 0 then
    raise exception 'Role name is required';
  end if;

  if p_id is null then
    insert into public.roles (name, description, is_system)
    values (trim(p_name), p_description, false)
    returning id into v_role_id;
  else
    select is_system into v_is_system from public.roles where id = p_id;
    if not found then
      raise exception 'Role not found';
    end if;
    if v_is_system then
      update public.roles set description = p_description where id = p_id;
    else
      update public.roles set name = trim(p_name), description = p_description where id = p_id;
    end if;
    v_role_id := p_id;
  end if;

  -- Replace the role's permission set
  delete from public.role_permissions where role_id = v_role_id;
  insert into public.role_permissions (role_id, permission_id)
  select v_role_id, p.id
  from   public.permissions p
  where  p.key = any(p_permissions);

  insert into public.audit_log (user_id, action, table_name, record_id, new_data)
  values (v_uid, case when p_id is null then 'INSERT' else 'UPDATE' end, 'roles', v_role_id,
    jsonb_build_object('name', p_name,
                       'permission_count', coalesce(array_length(p_permissions, 1), 0)));

  return v_role_id;
end;
$$;

grant execute on function public.admin_upsert_role(uuid, text, text, text[]) to authenticated;

create or replace function public.admin_delete_role(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid       uuid;
  v_is_system boolean;
begin
  v_uid := auth.uid();
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;
  if not public.has_permission(v_uid, 'manage_permissions') then
    raise exception 'Forbidden: missing manage_permissions';
  end if;
  select is_system into v_is_system from public.roles where id = p_id;
  if not found then
    raise exception 'Role not found';
  end if;
  if v_is_system then
    raise exception 'Cannot delete a system role';
  end if;
  delete from public.roles where id = p_id;
  insert into public.audit_log (user_id, action, table_name, record_id)
  values (v_uid, 'DELETE', 'roles', p_id);
end;
$$;

grant execute on function public.admin_delete_role(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 7. PERFORMANCE — composite indexes for the hot query paths
-- ---------------------------------------------------------------------------
create index if not exists idx_appointments_staff_start  on public.appointments(staff_id, start_at);
create index if not exists idx_appointments_client_status on public.appointments(client_id, status);
create index if not exists idx_payments_invoice
  on public.payments(invoice_id) where invoice_id is not null;
