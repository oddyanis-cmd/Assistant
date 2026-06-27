-- =============================================================================
-- Shiny Beauty Center — Phase 5: Tap Payments Integration
-- Migration: 006_payments.sql
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Add tap_charge_mode column to payments for audit trail
-- ---------------------------------------------------------------------------
alter table public.payments
  add column if not exists charge_mode text;  -- 'full' | 'deposit'

-- ---------------------------------------------------------------------------
-- Update create_appointment: when payments are enabled the appointment is
-- created in 'pending' status (webhook will confirm it). When payments are
-- off the existing behaviour of inserting as 'confirmed' is preserved.
--
-- We add a parameter p_pending (default false) so the application layer
-- can pass true when initiating a Tap payment flow.
-- ---------------------------------------------------------------------------
create or replace function public.create_appointment(
  p_service_id   uuid,
  p_staff_id     uuid,
  p_start_at     timestamptz,
  p_notes        text    default null,
  p_client_name  text    default null,
  p_client_phone text    default null,
  p_pending      boolean default false   -- NEW: pass true when payments on
)
returns table (
  appointment_id uuid,
  public_token   text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id       uuid;
  v_client_id     uuid;
  v_duration      smallint;
  v_end_at        timestamptz;
  v_staff_id      uuid;
  v_appt_id       uuid;
  v_token         text;
  v_price         numeric(10,2);
  v_points        int;
  v_overlap_count int;
  v_init_status   public.appointment_status;
begin
  v_user_id := auth.uid();

  -- Resolve service
  select duration_minutes, price
  into   v_duration, v_price
  from   public.services
  where  id = p_service_id and is_active = true;

  if not found then
    raise exception 'Service not found: %', p_service_id;
  end if;

  v_end_at := p_start_at + (v_duration || ' minutes')::interval;

  -- Resolve staff
  if p_staff_id is not null then
    v_staff_id := p_staff_id;
  else
    select sp.id into v_staff_id
    from   public.staff_profiles sp
    where  sp.is_active = true
      and not exists (
        select 1
        from public.appointments ap
        where ap.staff_id = sp.id
          and ap.status in ('pending','confirmed','checked_in')
          and ap.start_at < v_end_at
          and ap.end_at   > p_start_at
      )
    limit 1;

    if v_staff_id is null then
      raise exception 'No staff available for the selected time slot';
    end if;
  end if;

  -- Advisory lock
  perform pg_advisory_xact_lock(
    ('x' || encode(v_staff_id::text::bytea, 'hex'))::bit(64)::bigint,
    extract(epoch from p_start_at)::bigint
  );

  -- Conflict re-check
  select count(*) into v_overlap_count
  from   public.appointments
  where  staff_id = v_staff_id
    and  status in ('pending','confirmed','checked_in')
    and  start_at < v_end_at
    and  end_at   > p_start_at;

  if v_overlap_count > 0 then
    raise exception 'Time slot is no longer available. Please choose another time.';
  end if;

  -- Resolve or create client
  if v_user_id is not null then
    select id into v_client_id
    from   public.clients
    where  user_id = v_user_id
    limit  1;

    if v_client_id is null then
      insert into public.clients (user_id, full_name, locale)
      select v_user_id, coalesce(pr.full_name, 'Guest'), pr.locale
      from   public.profiles pr
      where  pr.id = v_user_id
      returning id into v_client_id;
    end if;
  else
    if p_client_name is null then
      raise exception 'Client name is required for anonymous bookings';
    end if;
    insert into public.clients (full_name, phone)
    values (p_client_name, p_client_phone)
    returning id into v_client_id;
  end if;

  -- Token
  v_token := encode(gen_random_bytes(6), 'hex');

  -- Determine initial status
  -- When p_pending = true (payments enabled path), start as 'pending'
  -- so the webhook can promote to 'confirmed'.
  if p_pending then
    v_init_status := 'pending';
  else
    v_init_status := 'confirmed';
  end if;

  -- Insert appointment
  insert into public.appointments
    (client_id, staff_id, service_id, status, start_at, end_at, notes, created_by, public_token)
  values
    (v_client_id, v_staff_id, p_service_id, v_init_status, p_start_at, v_end_at,
     p_notes, v_user_id, v_token)
  returning id into v_appt_id;

  -- Award loyalty points only when immediately confirmed (pay-at-salon path)
  if not p_pending and v_user_id is not null then
    v_points := floor(v_price / 100) * 10;
    if v_points > 0 then
      insert into public.loyalty_points (client_id, points, reason, ref_type, ref_id)
      values (v_client_id, v_points, 'Booking reward', 'appointment', v_appt_id);
    end if;
  end if;

  return query select v_appt_id, v_token;
end;
$$;

-- Re-grant (function signature changed — must re-grant)
grant execute on function public.create_appointment(uuid, uuid, timestamptz, text, text, text, boolean)
  to authenticated, anon;

-- ---------------------------------------------------------------------------
-- RPC: confirm_appointment_payment
--
-- Called by the webhook handler (via service-role) to atomically:
--   1. Update payment → paid
--   2. Update invoice → paid
--   3. Update appointment → confirmed
--   4. Award loyalty points (deferred from booking time)
-- ---------------------------------------------------------------------------
create or replace function public.confirm_appointment_payment(
  p_appointment_id uuid,
  p_payment_id     uuid,
  p_invoice_id     uuid default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_client_id uuid;
  v_price     numeric(10,2);
  v_user_id   uuid;
  v_points    int;
begin
  -- Mark payment paid
  update public.payments
  set status = 'paid'
  where id = p_payment_id
    and status != 'paid';  -- idempotent

  -- Mark invoice paid
  if p_invoice_id is not null then
    update public.invoices
    set status = 'paid', paid_at = now()
    where id = p_invoice_id
      and status != 'paid';
  end if;

  -- Confirm appointment and get client + price for loyalty
  update public.appointments
  set status = 'confirmed'
  where id = p_appointment_id
    and status = 'pending'
  returning client_id into v_client_id;

  if not found then
    return;  -- Already confirmed or cancelled — no-op
  end if;

  -- Resolve price and user for loyalty points
  select s.price, c.user_id
  into   v_price, v_user_id
  from   public.appointments a
  join   public.services     s on s.id = a.service_id
  join   public.clients      c on c.id = a.client_id
  where  a.id = p_appointment_id;

  -- Award loyalty points now (was deferred because payment was required)
  if v_user_id is not null and v_price is not null then
    v_points := floor(v_price / 100) * 10;
    if v_points > 0 then
      insert into public.loyalty_points (client_id, points, reason, ref_type, ref_id)
      values (v_client_id, v_points, 'Booking reward (paid online)', 'appointment', p_appointment_id)
      on conflict do nothing;
    end if;
  end if;
end;
$$;

grant execute on function public.confirm_appointment_payment(uuid, uuid, uuid)
  to service_role;

-- ---------------------------------------------------------------------------
-- Indexes for webhook lookups
-- ---------------------------------------------------------------------------
create index if not exists idx_payments_provider_ref
  on public.payments(provider_ref)
  where provider_ref is not null;

create index if not exists idx_payments_appointment
  on public.payments(appointment_id)
  where appointment_id is not null;
