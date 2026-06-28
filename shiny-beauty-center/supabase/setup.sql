-- ============================================================
-- Shiny Beauty Center - one-paste setup for the Supabase SQL Editor
-- Paste this ENTIRE file into Supabase -> SQL Editor and click Run (once).
-- It runs migrations 001-007 + seed.sql + seed_catalog.sql, in order.
-- Afterwards run:  npm run db:seed:test   (creates the 4 role logins).
-- ============================================================

-- ============================== migrations/001_schema.sql ==============================
-- =============================================================================
-- Shiny Beauty Center — Phase 1 Schema
-- Migration: 001_schema.sql
-- Run: supabase db reset  OR  psql -f this file
-- =============================================================================

-- Enable UUID extension
create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Utility: auto-updated timestamps
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- ENUMS
-- ---------------------------------------------------------------------------
do $$ begin
  create type public.app_locale as enum ('en', 'ar');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.appointment_status as enum (
    'pending', 'confirmed', 'checked_in', 'completed', 'cancelled', 'no_show'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.payment_status as enum (
    'pending', 'paid', 'partial', 'refunded', 'failed'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.notification_channel as enum ('whatsapp', 'sms', 'email', 'in_app');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.notification_status as enum ('pending', 'sent', 'failed', 'read');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.audit_action as enum ('INSERT', 'UPDATE', 'DELETE');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.discount_type as enum ('percent', 'fixed');
exception when duplicate_object then null; end $$;

-- =============================================================================
-- RBAC CORE
-- =============================================================================

-- ---------------------------------------------------------------------------
-- profiles (mirrors auth.users 1:1)
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  full_name   text,
  phone       text,
  locale      public.app_locale not null default 'en',
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create trigger profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- Trigger: auto-create profile on auth.users insert
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer
set search_path = public as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, new.raw_user_meta_data ->> 'full_name')
  on conflict (id) do nothing;
  return new;
end;
$$;

create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- roles
-- ---------------------------------------------------------------------------
create table if not exists public.roles (
  id          uuid primary key default gen_random_uuid(),
  name        text not null unique,
  description text,
  created_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- permissions
-- ---------------------------------------------------------------------------
create table if not exists public.permissions (
  id          uuid primary key default gen_random_uuid(),
  key         text not null unique,        -- e.g. 'view_all_bookings'
  module      text not null,              -- e.g. 'appointments'
  description text
);

-- ---------------------------------------------------------------------------
-- role_permissions (many-to-many)
-- ---------------------------------------------------------------------------
create table if not exists public.role_permissions (
  role_id       uuid not null references public.roles(id) on delete cascade,
  permission_id uuid not null references public.permissions(id) on delete cascade,
  primary key (role_id, permission_id)
);

-- ---------------------------------------------------------------------------
-- user_roles (many-to-many — a user can hold multiple roles)
-- ---------------------------------------------------------------------------
create table if not exists public.user_roles (
  user_id     uuid not null references public.profiles(id) on delete cascade,
  role_id     uuid not null references public.roles(id) on delete cascade,
  assigned_by uuid references public.profiles(id),
  created_at  timestamptz not null default now(),
  primary key (user_id, role_id)
);

-- ---------------------------------------------------------------------------
-- user_permissions (individual grants/revokes — overrides role grants)
-- granted = true  → explicitly grant (even if role doesn't have it)
-- granted = false → explicitly revoke (even if role does have it)
-- ---------------------------------------------------------------------------
create table if not exists public.user_permissions (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.profiles(id) on delete cascade,
  permission_id uuid not null references public.permissions(id) on delete cascade,
  granted       boolean not null default true,
  granted_by    uuid references public.profiles(id),
  created_at    timestamptz not null default now(),
  unique (user_id, permission_id)
);

-- =============================================================================
-- DOMAIN TABLES (minimal but correct — fleshed out in later phases)
-- =============================================================================

-- ---------------------------------------------------------------------------
-- staff_profiles
-- ---------------------------------------------------------------------------
create table if not exists public.staff_profiles (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null unique references public.profiles(id) on delete cascade,
  bio         text,
  specialties text[],
  color_hex   text,           -- calendar display colour
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create trigger staff_profiles_updated_at
  before update on public.staff_profiles
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- staff_availability
-- ---------------------------------------------------------------------------
create table if not exists public.staff_availability (
  id           uuid primary key default gen_random_uuid(),
  staff_id     uuid not null references public.staff_profiles(id) on delete cascade,
  day_of_week  smallint not null check (day_of_week between 0 and 6),  -- 0=Sun
  start_time   time not null,
  end_time     time not null,
  is_available boolean not null default true,
  constraint staff_availability_times_check check (end_time > start_time),
  unique (staff_id, day_of_week)
);

-- ---------------------------------------------------------------------------
-- clients
-- ---------------------------------------------------------------------------
create table if not exists public.clients (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid references public.profiles(id) on delete set null,  -- null = walk-in
  full_name     text not null,
  phone         text,
  email         text,
  date_of_birth date,
  notes         text,
  locale        public.app_locale not null default 'en',
  is_active     boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create trigger clients_updated_at
  before update on public.clients
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- service_categories
-- ---------------------------------------------------------------------------
create table if not exists public.service_categories (
  id          uuid primary key default gen_random_uuid(),
  name_en     text not null,
  name_ar     text not null,
  sort_order  smallint not null default 0,
  is_active   boolean not null default true
);

-- ---------------------------------------------------------------------------
-- services
-- ---------------------------------------------------------------------------
create table if not exists public.services (
  id               uuid primary key default gen_random_uuid(),
  category_id      uuid not null references public.service_categories(id) on delete restrict,
  name_en          text not null,
  name_ar          text not null,
  description_en   text,
  description_ar   text,
  price            numeric(10,2) not null default 0,
  duration_minutes smallint not null default 60,
  is_active        boolean not null default true,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create trigger services_updated_at
  before update on public.services
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- appointments
-- ---------------------------------------------------------------------------
create table if not exists public.appointments (
  id          uuid primary key default gen_random_uuid(),
  client_id   uuid not null references public.clients(id) on delete restrict,
  staff_id    uuid references public.staff_profiles(id) on delete set null,
  service_id  uuid not null references public.services(id) on delete restrict,
  status      public.appointment_status not null default 'pending',
  start_at    timestamptz not null,
  end_at      timestamptz not null,
  notes       text,
  created_by  uuid references public.profiles(id),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint appointments_times_check check (end_at > start_at)
);

create trigger appointments_updated_at
  before update on public.appointments
  for each row execute function public.set_updated_at();

create index if not exists idx_appointments_start_at on public.appointments(start_at);
create index if not exists idx_appointments_client   on public.appointments(client_id);
create index if not exists idx_appointments_staff    on public.appointments(staff_id);

-- ---------------------------------------------------------------------------
-- payments
-- ---------------------------------------------------------------------------
create table if not exists public.payments (
  id              uuid primary key default gen_random_uuid(),
  appointment_id  uuid references public.appointments(id) on delete set null,
  invoice_id      uuid,  -- FK added after invoices table
  amount          numeric(10,2) not null,
  currency        text not null default 'SAR',
  status          public.payment_status not null default 'pending',
  provider        text,   -- 'tap', 'cash', etc.
  provider_ref    text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create trigger payments_updated_at
  before update on public.payments
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- invoices
-- ---------------------------------------------------------------------------
create table if not exists public.invoices (
  id              uuid primary key default gen_random_uuid(),
  client_id       uuid not null references public.clients(id) on delete restrict,
  appointment_id  uuid references public.appointments(id) on delete set null,
  subtotal        numeric(10,2) not null default 0,
  discount        numeric(10,2) not null default 0,
  tax             numeric(10,2) not null default 0,
  total           numeric(10,2) not null generated always as (subtotal - discount + tax) stored,
  status          public.payment_status not null default 'pending',
  issued_at       timestamptz not null default now(),
  due_at          timestamptz,
  paid_at         timestamptz,
  created_at      timestamptz not null default now()
);

-- Add FK from payments to invoices now that invoices exists
alter table public.payments
  add constraint payments_invoice_id_fkey
  foreign key (invoice_id) references public.invoices(id) on delete set null;

-- ---------------------------------------------------------------------------
-- promotions
-- ---------------------------------------------------------------------------
create table if not exists public.promotions (
  id              uuid primary key default gen_random_uuid(),
  code            text unique,
  description_en  text,
  description_ar  text,
  discount_type   public.discount_type not null default 'percent',
  discount_value  numeric(10,2) not null,
  min_purchase    numeric(10,2),
  max_uses        int,
  used_count      int not null default 0,
  valid_from      timestamptz,
  valid_until     timestamptz,
  is_active       boolean not null default true,
  created_at      timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- gift_cards
-- ---------------------------------------------------------------------------
create table if not exists public.gift_cards (
  id              uuid primary key default gen_random_uuid(),
  code            text not null unique,
  initial_value   numeric(10,2) not null,
  remaining_value numeric(10,2) not null,
  currency        text not null default 'SAR',
  purchased_by    uuid references public.profiles(id) on delete set null,
  expires_at      timestamptz,
  is_active       boolean not null default true,
  created_at      timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- loyalty_points
-- ---------------------------------------------------------------------------
create table if not exists public.loyalty_points (
  id          uuid primary key default gen_random_uuid(),
  client_id   uuid not null references public.clients(id) on delete cascade,
  points      int not null,
  reason      text,
  ref_type    text,   -- 'appointment', 'promotion', etc.
  ref_id      uuid,
  created_at  timestamptz not null default now()
);

create index if not exists idx_loyalty_client on public.loyalty_points(client_id);

-- ---------------------------------------------------------------------------
-- suppliers
-- ---------------------------------------------------------------------------
create table if not exists public.suppliers (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  contact_name text,
  phone        text,
  email        text,
  notes        text,
  is_active    boolean not null default true,
  created_at   timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- inventory_items
-- ---------------------------------------------------------------------------
create table if not exists public.inventory_items (
  id                  uuid primary key default gen_random_uuid(),
  name_en             text not null,
  name_ar             text not null,
  sku                 text unique,
  quantity            int not null default 0,
  unit                text,   -- 'ml', 'pcs', etc.
  low_stock_threshold int,
  supplier_id         uuid references public.suppliers(id) on delete set null,
  cost                numeric(10,2),
  is_active           boolean not null default true,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create trigger inventory_items_updated_at
  before update on public.inventory_items
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- reviews
-- ---------------------------------------------------------------------------
create table if not exists public.reviews (
  id              uuid primary key default gen_random_uuid(),
  client_id       uuid not null references public.clients(id) on delete cascade,
  appointment_id  uuid references public.appointments(id) on delete set null,
  rating          smallint not null check (rating between 1 and 5),
  comment         text,
  is_published    boolean not null default false,
  created_at      timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- notifications
-- ---------------------------------------------------------------------------
create table if not exists public.notifications (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  channel     public.notification_channel not null,
  status      public.notification_status not null default 'pending',
  subject     text,
  body        text not null,
  sent_at     timestamptz,
  read_at     timestamptz,
  created_at  timestamptz not null default now()
);

create index if not exists idx_notifications_user on public.notifications(user_id);

-- ---------------------------------------------------------------------------
-- audit_log
-- ---------------------------------------------------------------------------
create table if not exists public.audit_log (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references public.profiles(id) on delete set null,
  action      public.audit_action not null,
  table_name  text not null,
  record_id   uuid,
  old_data    jsonb,
  new_data    jsonb,
  ip_address  inet,
  created_at  timestamptz not null default now()
);

create index if not exists idx_audit_log_table     on public.audit_log(table_name);
create index if not exists idx_audit_log_user      on public.audit_log(user_id);
create index if not exists idx_audit_log_created   on public.audit_log(created_at desc);

-- ============================== migrations/002_rls_and_has_permission.sql ==============================
-- =============================================================================
-- Shiny Beauty Center — RLS Policies + has_permission SQL function
-- Migration: 002_rls_and_has_permission.sql
-- =============================================================================

-- =============================================================================
-- has_permission(uid, perm) — core RBAC function
-- =============================================================================
-- Logic:
--   1. If user_permissions has a row for (uid, perm) with granted=false  → DENY
--   2. If user_permissions has a row for (uid, perm) with granted=true   → GRANT
--   3. If any role the user holds has the permission via role_permissions → GRANT
--   4. Otherwise → DENY
-- Individual user_permissions rows take precedence over role grants (explicit deny wins).
-- =============================================================================
create or replace function public.has_permission(uid uuid, perm text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    case
      -- Individual explicit revoke (deny wins)
      when exists (
        select 1
        from public.user_permissions up
        join public.permissions p on p.id = up.permission_id
        where up.user_id = uid
          and p.key = perm
          and up.granted = false
      ) then false

      -- Individual explicit grant
      when exists (
        select 1
        from public.user_permissions up
        join public.permissions p on p.id = up.permission_id
        where up.user_id = uid
          and p.key = perm
          and up.granted = true
      ) then true

      -- Role-based grant
      when exists (
        select 1
        from public.user_roles ur
        join public.role_permissions rp on rp.role_id = ur.role_id
        join public.permissions p       on p.id = rp.permission_id
        where ur.user_id = uid
          and p.key = perm
      ) then true

      else false
    end
$$;

-- Grant execute to authenticated users and anon (for RLS policies)
grant execute on function public.has_permission(uuid, text)
  to authenticated, anon, service_role;

-- =============================================================================
-- Enable RLS on all tables
-- =============================================================================
alter table public.profiles          enable row level security;
alter table public.roles             enable row level security;
alter table public.permissions       enable row level security;
alter table public.role_permissions  enable row level security;
alter table public.user_roles        enable row level security;
alter table public.user_permissions  enable row level security;
alter table public.staff_profiles    enable row level security;
alter table public.staff_availability enable row level security;
alter table public.clients           enable row level security;
alter table public.service_categories enable row level security;
alter table public.services          enable row level security;
alter table public.appointments      enable row level security;
alter table public.payments          enable row level security;
alter table public.invoices          enable row level security;
alter table public.promotions        enable row level security;
alter table public.gift_cards        enable row level security;
alter table public.loyalty_points    enable row level security;
alter table public.suppliers         enable row level security;
alter table public.inventory_items   enable row level security;
alter table public.reviews           enable row level security;
alter table public.notifications     enable row level security;
alter table public.audit_log         enable row level security;

-- =============================================================================
-- RLS POLICIES
-- =============================================================================

-- ---------------------------------------------------------------------------
-- profiles — users see/edit their own; admins with manage_permissions see all
-- ---------------------------------------------------------------------------
create policy "profiles: own read"
  on public.profiles for select
  using (auth.uid() = id OR public.has_permission(auth.uid(), 'view_all_clients'));

create policy "profiles: own update"
  on public.profiles for update
  using (auth.uid() = id);

create policy "profiles: admin insert"
  on public.profiles for insert
  with check (auth.uid() = id OR public.has_permission(auth.uid(), 'create_user'));

create policy "profiles: admin delete"
  on public.profiles for delete
  using (public.has_permission(auth.uid(), 'deactivate_user'));

-- ---------------------------------------------------------------------------
-- roles — read: anyone authenticated; write: manage_permissions
-- ---------------------------------------------------------------------------
create policy "roles: authenticated read"
  on public.roles for select
  using (auth.role() = 'authenticated');

create policy "roles: manage write"
  on public.roles for all
  using (public.has_permission(auth.uid(), 'manage_permissions'))
  with check (public.has_permission(auth.uid(), 'manage_permissions'));

-- ---------------------------------------------------------------------------
-- permissions — read: anyone authenticated; write: manage_permissions
-- ---------------------------------------------------------------------------
create policy "permissions: authenticated read"
  on public.permissions for select
  using (auth.role() = 'authenticated');

create policy "permissions: manage write"
  on public.permissions for all
  using (public.has_permission(auth.uid(), 'manage_permissions'))
  with check (public.has_permission(auth.uid(), 'manage_permissions'));

-- ---------------------------------------------------------------------------
-- role_permissions — read: authenticated; write: manage_permissions
-- ---------------------------------------------------------------------------
create policy "role_permissions: read"
  on public.role_permissions for select
  using (auth.role() = 'authenticated');

create policy "role_permissions: manage"
  on public.role_permissions for all
  using (public.has_permission(auth.uid(), 'manage_permissions'))
  with check (public.has_permission(auth.uid(), 'manage_permissions'));

-- ---------------------------------------------------------------------------
-- user_roles — own read; assign_roles write
-- ---------------------------------------------------------------------------
create policy "user_roles: own read"
  on public.user_roles for select
  using (auth.uid() = user_id OR public.has_permission(auth.uid(), 'view_staff'));

create policy "user_roles: assign"
  on public.user_roles for all
  using (public.has_permission(auth.uid(), 'assign_roles'))
  with check (public.has_permission(auth.uid(), 'assign_roles'));

-- ---------------------------------------------------------------------------
-- user_permissions — own read; manage_permissions write
-- ---------------------------------------------------------------------------
create policy "user_permissions: own read"
  on public.user_permissions for select
  using (auth.uid() = user_id OR public.has_permission(auth.uid(), 'manage_permissions'));

create policy "user_permissions: manage"
  on public.user_permissions for all
  using (public.has_permission(auth.uid(), 'manage_permissions'))
  with check (public.has_permission(auth.uid(), 'manage_permissions'));

-- ---------------------------------------------------------------------------
-- staff_profiles — view_staff or own record
-- ---------------------------------------------------------------------------
create policy "staff_profiles: read"
  on public.staff_profiles for select
  using (auth.uid() = user_id OR public.has_permission(auth.uid(), 'view_staff'));

create policy "staff_profiles: write"
  on public.staff_profiles for all
  using (auth.uid() = user_id OR public.has_permission(auth.uid(), 'edit_user'))
  with check (auth.uid() = user_id OR public.has_permission(auth.uid(), 'edit_user'));

-- ---------------------------------------------------------------------------
-- staff_availability — view_staff_schedule or own
-- ---------------------------------------------------------------------------
create policy "staff_availability: read"
  on public.staff_availability for select
  using (
    public.has_permission(auth.uid(), 'view_staff_schedule')
    OR exists (
      select 1 from public.staff_profiles sp
      where sp.id = staff_id and sp.user_id = auth.uid()
    )
  );

create policy "staff_availability: write"
  on public.staff_availability for all
  using (
    public.has_permission(auth.uid(), 'manage_staff_availability')
    OR exists (
      select 1 from public.staff_profiles sp
      where sp.id = staff_id and sp.user_id = auth.uid()
    )
  )
  with check (
    public.has_permission(auth.uid(), 'manage_staff_availability')
    OR exists (
      select 1 from public.staff_profiles sp
      where sp.id = staff_id and sp.user_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- clients — view_all_clients, view_client_details, or own record
-- ---------------------------------------------------------------------------
create policy "clients: read"
  on public.clients for select
  using (
    auth.uid() = user_id
    OR public.has_permission(auth.uid(), 'view_all_clients')
    OR public.has_permission(auth.uid(), 'view_client_details')
  );

create policy "clients: insert"
  on public.clients for insert
  with check (
    auth.uid() = user_id
    OR public.has_permission(auth.uid(), 'create_client')
  );

create policy "clients: update"
  on public.clients for update
  using (
    auth.uid() = user_id
    OR public.has_permission(auth.uid(), 'edit_client')
  );

create policy "clients: delete"
  on public.clients for delete
  using (public.has_permission(auth.uid(), 'delete_client'));

-- ---------------------------------------------------------------------------
-- service_categories + services — public read; admin write
-- ---------------------------------------------------------------------------
create policy "service_categories: public read"
  on public.service_categories for select using (true);

create policy "service_categories: manage"
  on public.service_categories for all
  using (public.has_permission(auth.uid(), 'manage_service_categories'))
  with check (public.has_permission(auth.uid(), 'manage_service_categories'));

create policy "services: public read"
  on public.services for select using (true);

create policy "services: write"
  on public.services for all
  using (public.has_permission(auth.uid(), 'edit_service'))
  with check (public.has_permission(auth.uid(), 'edit_service'));

-- ---------------------------------------------------------------------------
-- appointments — role-gated
-- ---------------------------------------------------------------------------
create policy "appointments: own read"
  on public.appointments for select
  using (
    public.has_permission(auth.uid(), 'view_all_bookings')
    OR (
      public.has_permission(auth.uid(), 'view_own_bookings')
      AND (
        exists (
          select 1 from public.clients c where c.id = client_id and c.user_id = auth.uid()
        )
        OR exists (
          select 1 from public.staff_profiles sp where sp.id = staff_id and sp.user_id = auth.uid()
        )
      )
    )
  );

create policy "appointments: create"
  on public.appointments for insert
  with check (public.has_permission(auth.uid(), 'create_booking'));

create policy "appointments: update"
  on public.appointments for update
  using (public.has_permission(auth.uid(), 'edit_booking'));

create policy "appointments: cancel"
  on public.appointments for delete
  using (public.has_permission(auth.uid(), 'cancel_booking'));

-- ---------------------------------------------------------------------------
-- payments + invoices — finance permissions
-- ---------------------------------------------------------------------------
create policy "payments: read"
  on public.payments for select
  using (public.has_permission(auth.uid(), 'view_revenue'));

create policy "payments: write"
  on public.payments for all
  using (public.has_permission(auth.uid(), 'process_payments'))
  with check (public.has_permission(auth.uid(), 'process_payments'));

create policy "invoices: read"
  on public.invoices for select
  using (
    public.has_permission(auth.uid(), 'manage_invoices')
    OR public.has_permission(auth.uid(), 'view_revenue')
    OR exists (
      select 1 from public.clients c where c.id = client_id and c.user_id = auth.uid()
    )
  );

create policy "invoices: write"
  on public.invoices for all
  using (public.has_permission(auth.uid(), 'manage_invoices'))
  with check (public.has_permission(auth.uid(), 'manage_invoices'));

-- ---------------------------------------------------------------------------
-- promotions + gift_cards
-- ---------------------------------------------------------------------------
create policy "promotions: public read"
  on public.promotions for select using (is_active = true);

create policy "promotions: manage"
  on public.promotions for all
  using (public.has_permission(auth.uid(), 'manage_promotions'))
  with check (public.has_permission(auth.uid(), 'manage_promotions'));

create policy "gift_cards: read"
  on public.gift_cards for select
  using (
    auth.uid() = purchased_by
    OR public.has_permission(auth.uid(), 'manage_gift_cards')
  );

create policy "gift_cards: manage"
  on public.gift_cards for all
  using (public.has_permission(auth.uid(), 'manage_gift_cards'))
  with check (public.has_permission(auth.uid(), 'manage_gift_cards'));

-- ---------------------------------------------------------------------------
-- loyalty_points
-- ---------------------------------------------------------------------------
create policy "loyalty_points: own read"
  on public.loyalty_points for select
  using (
    public.has_permission(auth.uid(), 'manage_loyalty_program')
    OR exists (
      select 1 from public.clients c where c.id = client_id and c.user_id = auth.uid()
    )
  );

create policy "loyalty_points: manage"
  on public.loyalty_points for all
  using (public.has_permission(auth.uid(), 'manage_loyalty_program'))
  with check (public.has_permission(auth.uid(), 'manage_loyalty_program'));

-- ---------------------------------------------------------------------------
-- inventory + suppliers
-- ---------------------------------------------------------------------------
create policy "suppliers: read"
  on public.suppliers for select
  using (public.has_permission(auth.uid(), 'view_inventory'));

create policy "suppliers: manage"
  on public.suppliers for all
  using (public.has_permission(auth.uid(), 'manage_suppliers'))
  with check (public.has_permission(auth.uid(), 'manage_suppliers'));

create policy "inventory_items: read"
  on public.inventory_items for select
  using (public.has_permission(auth.uid(), 'view_inventory'));

create policy "inventory_items: manage"
  on public.inventory_items for all
  using (public.has_permission(auth.uid(), 'manage_inventory'))
  with check (public.has_permission(auth.uid(), 'manage_inventory'));

-- ---------------------------------------------------------------------------
-- reviews
-- ---------------------------------------------------------------------------
create policy "reviews: public read"
  on public.reviews for select
  using (is_published = true OR public.has_permission(auth.uid(), 'manage_reviews'));

create policy "reviews: own write"
  on public.reviews for insert
  with check (
    exists (select 1 from public.clients c where c.id = client_id and c.user_id = auth.uid())
  );

create policy "reviews: manage"
  on public.reviews for update
  using (public.has_permission(auth.uid(), 'manage_reviews'));

-- ---------------------------------------------------------------------------
-- notifications — own only
-- ---------------------------------------------------------------------------
create policy "notifications: own"
  on public.notifications for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id OR public.has_permission(auth.uid(), 'send_notifications'));

-- ---------------------------------------------------------------------------
-- audit_log — read: view_audit_log; insert: service role only
-- ---------------------------------------------------------------------------
create policy "audit_log: read"
  on public.audit_log for select
  using (public.has_permission(auth.uid(), 'view_audit_log'));

-- Inserts happen via service role (no user-triggered inserts)
create policy "audit_log: service insert"
  on public.audit_log for insert
  with check (false);  -- blocked for regular users; use service_role client

-- ============================== migrations/003_booking_functions.sql ==============================
-- =============================================================================
-- Shiny Beauty Center — Phase 2: Booking Engine Functions
-- Migration: 003_booking_functions.sql
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Add a public reference token column to appointments (short booking ref)
-- ---------------------------------------------------------------------------
alter table public.appointments
  add column if not exists public_token text unique;

-- Generate tokens for existing rows (backfill)
update public.appointments
set public_token = encode(gen_random_bytes(6), 'hex')
where public_token is null;

-- ---------------------------------------------------------------------------
-- Helper: get the service duration for a given service
-- ---------------------------------------------------------------------------
create or replace function public.get_service_duration(p_service_id uuid)
returns smallint
language sql stable
security definer
set search_path = public
as $$
  select duration_minutes
  from public.services
  where id = p_service_id and is_active = true
  limit 1;
$$;

-- ---------------------------------------------------------------------------
-- get_available_slots
--
-- Returns bookable start times (as timestamptz) for a given date.
-- Slot granularity: 30 minutes.
-- Logic:
--   1. For each staff member matching p_staff_id (or all active staff if null):
--      a. Check they have a working record for the day_of_week of p_date.
--      b. Generate 30-min slots within their working hours.
--      c. A slot is valid when:
--         - slot_start >= availability.start_time
--         - slot_end   <= availability.end_time
--         - No confirmed/pending appointment for that staff overlaps the slot
-- Returns rows: (staff_id uuid, staff_name text, slot_start timestamptz)
-- ---------------------------------------------------------------------------
create or replace function public.get_available_slots(
  p_service_id uuid,
  p_staff_id   uuid,      -- pass NULL for "any available staff"
  p_date       date
)
returns table (
  staff_id   uuid,
  staff_name text,
  slot_start timestamptz
)
language plpgsql stable
security definer
set search_path = public
as $$
declare
  v_duration   smallint;
  v_dow        smallint;
  v_slot_mins  smallint := 30;
begin
  -- Resolve service duration
  v_duration := public.get_service_duration(p_service_id);
  if v_duration is null then
    raise exception 'Service not found or inactive: %', p_service_id;
  end if;

  -- Day of week for the requested date (0=Sun … 6=Sat)
  v_dow := extract(dow from p_date)::smallint;

  return query
  with
    -- Staff candidates
    candidates as (
      select
        sp.id                                     as s_id,
        pr.full_name                              as s_name,
        sa.start_time                             as wk_start,
        sa.end_time                               as wk_end
      from public.staff_profiles sp
      join public.profiles pr         on pr.id = sp.user_id
      join public.staff_availability sa on sa.staff_id = sp.id
      where sp.is_active  = true
        and sa.day_of_week = v_dow
        and sa.is_available = true
        and (p_staff_id is null or sp.id = p_staff_id)
    ),
    -- All time slots within working hours for this date
    all_slots as (
      select
        c.s_id,
        c.s_name,
        -- Generate a slot every v_slot_mins minutes from wk_start to wk_end
        (p_date::timestamptz
          + (c.wk_start::interval)
          + (gs * (v_slot_mins || ' minutes')::interval)
        )                                         as slot_ts,
        (p_date::timestamptz
          + (c.wk_start::interval)
          + (gs * (v_slot_mins || ' minutes')::interval)
          + (v_duration || ' minutes')::interval
        )                                         as slot_end_ts,
        (p_date::timestamptz + c.wk_end::interval) as wk_end_ts
      from candidates c,
           generate_series(
             0,
             -- max possible slots in the day
             (extract(epoch from (c.wk_end - c.wk_start)) / (v_slot_mins * 60))::int - 1,
             1
           ) as gs
    ),
    -- Valid slots: slot must end before/at working hours end
    valid_slots as (
      select *
      from all_slots
      where slot_end_ts <= wk_end_ts
        -- Must be in the future (at least 1 hour lead time)
        and slot_ts > (now() + interval '1 hour')
    ),
    -- Existing non-cancelled appointments for these staff on this date
    busy as (
      select
        ap.staff_id,
        ap.start_at,
        ap.end_at
      from public.appointments ap
      where ap.staff_id in (select s_id from candidates)
        and ap.status  in ('pending', 'confirmed', 'checked_in')
        and ap.start_at::date = p_date
    )
  select distinct
    vs.s_id       as staff_id,
    vs.s_name     as staff_name,
    vs.slot_ts    as slot_start
  from valid_slots vs
  where not exists (
    select 1
    from busy b
    where b.staff_id = vs.s_id
      -- Overlap: the proposed slot overlaps an existing booking
      and vs.slot_ts    < b.end_at
      and vs.slot_end_ts > b.start_at
  )
  order by vs.slot_ts, vs.s_name;
end;
$$;

-- ---------------------------------------------------------------------------
-- create_appointment
--
-- SECURITY DEFINER so clients can create appointments without direct INSERT
-- access to the appointments table.
--
-- Steps:
--   1. Look up or create the client record (matched by user_id).
--   2. Re-check availability (conflict-safe: advisory lock per staff+slot).
--   3. Insert the appointment as 'confirmed' (payments off → pay at salon).
--   4. Award loyalty points (10 pts per 100 SAR, rounded down).
--   5. Return appointment id + public_token.
-- ---------------------------------------------------------------------------
create or replace function public.create_appointment(
  p_service_id  uuid,
  p_staff_id    uuid,          -- null = any; we pick the first available
  p_start_at    timestamptz,
  p_notes       text default null,
  p_client_name text default null,   -- used only if no authenticated user
  p_client_phone text default null
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
  v_user_id      uuid;
  v_client_id    uuid;
  v_duration     smallint;
  v_end_at       timestamptz;
  v_staff_id     uuid;
  v_appt_id      uuid;
  v_token        text;
  v_price        numeric(10,2);
  v_points       int;
  v_overlap_count int;
begin
  -- 1. Identify caller (may be null for walk-in / future anonymous support)
  v_user_id := auth.uid();

  -- 2. Resolve service
  select duration_minutes, price
  into   v_duration, v_price
  from   public.services
  where  id = p_service_id and is_active = true;

  if not found then
    raise exception 'Service not found: %', p_service_id;
  end if;

  v_end_at := p_start_at + (v_duration || ' minutes')::interval;

  -- 3. Resolve staff (pick first available if null)
  if p_staff_id is not null then
    v_staff_id := p_staff_id;
  else
    -- Pick any staff who has no overlap
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

  -- 4. Advisory lock to prevent concurrent double-booking on same staff+slot
  perform pg_advisory_xact_lock(
    ('x' || encode(v_staff_id::text::bytea, 'hex'))::bit(64)::bigint,
    extract(epoch from p_start_at)::bigint
  );

  -- 5. Conflict re-check after lock acquired
  select count(*) into v_overlap_count
  from   public.appointments
  where  staff_id = v_staff_id
    and  status in ('pending','confirmed','checked_in')
    and  start_at < v_end_at
    and  end_at   > p_start_at;

  if v_overlap_count > 0 then
    raise exception 'Time slot is no longer available. Please choose another time.';
  end if;

  -- 6. Resolve or create client record
  if v_user_id is not null then
    select id into v_client_id
    from   public.clients
    where  user_id = v_user_id
    limit  1;

    if v_client_id is null then
      -- Create client linked to this user
      insert into public.clients (user_id, full_name, locale)
      select v_user_id, coalesce(pr.full_name, 'Guest'), pr.locale
      from   public.profiles pr
      where  pr.id = v_user_id
      returning id into v_client_id;
    end if;
  else
    -- Walk-in / anonymous — must supply name
    if p_client_name is null then
      raise exception 'Client name is required for anonymous bookings';
    end if;
    insert into public.clients (full_name, phone)
    values (p_client_name, p_client_phone)
    returning id into v_client_id;
  end if;

  -- 7. Generate a short public token (12 hex chars)
  v_token := encode(gen_random_bytes(6), 'hex');

  -- 8. Insert appointment
  insert into public.appointments
    (client_id, staff_id, service_id, status, start_at, end_at, notes, created_by, public_token)
  values
    (v_client_id, v_staff_id, p_service_id, 'confirmed', p_start_at, v_end_at,
     p_notes, v_user_id, v_token)
  returning id into v_appt_id;

  -- 9. Award loyalty points: 10 pts per 100 SAR
  if v_user_id is not null then
    v_points := floor(v_price / 100) * 10;
    if v_points > 0 then
      insert into public.loyalty_points (client_id, points, reason, ref_type, ref_id)
      values (v_client_id, v_points, 'Booking reward', 'appointment', v_appt_id);
    end if;
  end if;

  return query select v_appt_id, v_token;
end;
$$;

-- ---------------------------------------------------------------------------
-- Update the Database types stub: add functions to Functions map
-- (SQL comment only — the TypeScript types.ts is updated separately)
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- Grant execute to authenticated and anon roles
-- ---------------------------------------------------------------------------
grant execute on function public.get_available_slots(uuid, uuid, date)    to authenticated, anon;
grant execute on function public.create_appointment(uuid, uuid, timestamptz, text, text, text) to authenticated, anon;
grant execute on function public.get_service_duration(uuid)               to authenticated, anon;

-- ============================== migrations/004_staff_functions.sql ==============================
-- =============================================================================
-- Shiny Beauty Center — Phase 3: Staff Portal Functions & Tables
-- Migration: 004_staff_functions.sql
-- =============================================================================

-- ---------------------------------------------------------------------------
-- staff_time_off
-- Status: pending (staff-created) → approved / rejected (manager — Phase 4)
-- ---------------------------------------------------------------------------
do $$ begin
  create type public.time_off_status as enum ('pending', 'approved', 'rejected');
exception when duplicate_object then null; end $$;

create table if not exists public.staff_time_off (
  id           uuid primary key default gen_random_uuid(),
  staff_id     uuid not null references public.staff_profiles(id) on delete cascade,
  date_from    date not null,
  date_to      date not null,
  reason       text,
  status       public.time_off_status not null default 'pending',
  reviewed_by  uuid references public.profiles(id),
  reviewed_at  timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint staff_time_off_dates_check check (date_to >= date_from)
);

create trigger staff_time_off_updated_at
  before update on public.staff_time_off
  for each row execute function public.set_updated_at();

create index if not exists idx_staff_time_off_staff   on public.staff_time_off(staff_id);
create index if not exists idx_staff_time_off_status  on public.staff_time_off(status);

-- ---------------------------------------------------------------------------
-- client_notes (private staff notes on a client — manage_client_notes)
-- ---------------------------------------------------------------------------
create table if not exists public.client_notes (
  id           uuid primary key default gen_random_uuid(),
  client_id    uuid not null references public.clients(id) on delete cascade,
  staff_id     uuid not null references public.staff_profiles(id) on delete cascade,
  note         text not null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create trigger client_notes_updated_at
  before update on public.client_notes
  for each row execute function public.set_updated_at();

create index if not exists idx_client_notes_client on public.client_notes(client_id);
create index if not exists idx_client_notes_staff  on public.client_notes(staff_id);

-- ---------------------------------------------------------------------------
-- RLS for new tables
-- ---------------------------------------------------------------------------
alter table public.staff_time_off enable row level security;
alter table public.client_notes   enable row level security;

-- staff_time_off: staff see/manage own; managers see all (Phase 4 adds approve)
create policy "staff_time_off: own read"
  on public.staff_time_off for select
  using (
    exists (
      select 1 from public.staff_profiles sp
      where sp.id = staff_id and sp.user_id = auth.uid()
    )
    OR public.has_permission(auth.uid(), 'manage_leave_requests')
  );

create policy "staff_time_off: own insert"
  on public.staff_time_off for insert
  with check (
    exists (
      select 1 from public.staff_profiles sp
      where sp.id = staff_id and sp.user_id = auth.uid()
    )
  );

create policy "staff_time_off: own update"
  on public.staff_time_off for update
  using (
    (
      exists (
        select 1 from public.staff_profiles sp
        where sp.id = staff_id and sp.user_id = auth.uid()
      )
      AND status = 'pending'
    )
    OR public.has_permission(auth.uid(), 'manage_leave_requests')
  );

create policy "staff_time_off: own delete"
  on public.staff_time_off for delete
  using (
    (
      exists (
        select 1 from public.staff_profiles sp
        where sp.id = staff_id and sp.user_id = auth.uid()
      )
      AND status = 'pending'
    )
    OR public.has_permission(auth.uid(), 'manage_leave_requests')
  );

-- client_notes: own or manage_client_notes
create policy "client_notes: read"
  on public.client_notes for select
  using (
    exists (
      select 1 from public.staff_profiles sp
      where sp.id = staff_id and sp.user_id = auth.uid()
    )
    OR public.has_permission(auth.uid(), 'manage_client_notes')
    OR public.has_permission(auth.uid(), 'view_client_history')
  );

create policy "client_notes: write"
  on public.client_notes for all
  using (
    exists (
      select 1 from public.staff_profiles sp
      where sp.id = staff_id and sp.user_id = auth.uid()
    )
    OR public.has_permission(auth.uid(), 'manage_client_notes')
  )
  with check (
    exists (
      select 1 from public.staff_profiles sp
      where sp.id = staff_id and sp.user_id = auth.uid()
    )
    OR public.has_permission(auth.uid(), 'manage_client_notes')
  );

-- ---------------------------------------------------------------------------
-- staff_transition_appointment
--
-- Permission-gated status transitions for staff. SECURITY DEFINER so the
-- calling staff member doesn't need direct UPDATE on appointments.
--
-- Allowed transitions:
--   pending    → confirmed   (confirm_booking)
--   confirmed  → checked_in  (check_in_client)
--   checked_in → completed   (any — staff completing their own appt)
--   pending / confirmed / checked_in → no_show  (mark_no_show)
--
-- Caller must either own the appointment (via staff_profiles.user_id)
-- or hold view_all_bookings (manager override).
-- Writes an audit_log row for every transition.
-- ---------------------------------------------------------------------------
create or replace function public.staff_transition_appointment(
  p_appointment_id uuid,
  p_new_status     text   -- 'confirmed' | 'checked_in' | 'completed' | 'no_show'
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid          uuid;
  v_staff_id     uuid;      -- staff_profiles.id of the caller
  v_appt         record;
  v_allowed      boolean := false;
  v_perm_needed  text;
  v_old_status   text;
begin
  v_uid := auth.uid();
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  -- Resolve this user's staff_profiles.id
  select id into v_staff_id
  from public.staff_profiles
  where user_id = v_uid
  limit 1;

  -- Load the appointment
  select * into v_appt
  from public.appointments
  where id = p_appointment_id;

  if not found then
    raise exception 'Appointment not found: %', p_appointment_id;
  end if;

  v_old_status := v_appt.status::text;

  -- Ownership check: caller must be the assigned staff OR have view_all_bookings
  if v_staff_id is null
     OR (v_appt.staff_id <> v_staff_id
         AND NOT public.has_permission(v_uid, 'view_all_bookings'))
  then
    raise exception 'Forbidden: you are not assigned to this appointment';
  end if;

  -- Validate the requested target status and permission required
  case p_new_status
    when 'confirmed' then
      v_perm_needed := 'confirm_booking';
      v_allowed := v_old_status IN ('pending');
    when 'checked_in' then
      v_perm_needed := 'check_in_client';
      v_allowed := v_old_status IN ('confirmed');
    when 'completed' then
      v_perm_needed := 'check_in_client'; -- same permission level as check-in
      v_allowed := v_old_status IN ('checked_in');
    when 'no_show' then
      v_perm_needed := 'mark_no_show';
      v_allowed := v_old_status IN ('pending', 'confirmed', 'checked_in');
    else
      raise exception 'Unknown target status: %', p_new_status;
  end case;

  if not v_allowed then
    raise exception 'Cannot transition from % to %', v_old_status, p_new_status;
  end if;

  -- Permission gate
  if not public.has_permission(v_uid, v_perm_needed) then
    raise exception 'Forbidden: missing permission %', v_perm_needed;
  end if;

  -- Perform the update
  update public.appointments
  set status = p_new_status::public.appointment_status
  where id = p_appointment_id;

  -- Write audit log (best-effort: ignore errors so main action never fails)
  begin
    insert into public.audit_log (user_id, action, table_name, record_id, old_data, new_data)
    values (
      v_uid,
      'UPDATE',
      'appointments',
      p_appointment_id,
      jsonb_build_object('status', v_old_status),
      jsonb_build_object('status', p_new_status)
    );
  exception when others then
    -- audit failure must not roll back the status update
    null;
  end;

  -- Notify assigned staff (in_app) of significant transitions
  -- Only insert when the staff's user_id is known
  if v_staff_id is not null and v_appt.staff_id = v_staff_id then
    -- No self-notification; appointment transitions are initiated by staff themselves
    null;
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- staff_upsert_availability
--
-- Upserts a staff_availability row for the calling staff member.
-- Requires manage_staff_availability or edit_staff_schedule permission.
-- ---------------------------------------------------------------------------
create or replace function public.staff_upsert_availability(
  p_day_of_week  smallint,    -- 0=Sun … 6=Sat
  p_start_time   time,
  p_end_time     time,
  p_is_available boolean default true
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid      uuid;
  v_staff_id uuid;
begin
  v_uid := auth.uid();
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  if not (
    public.has_permission(v_uid, 'manage_staff_availability')
    OR public.has_permission(v_uid, 'edit_staff_schedule')
  ) then
    raise exception 'Forbidden: missing manage_staff_availability or edit_staff_schedule';
  end if;

  select id into v_staff_id
  from public.staff_profiles
  where user_id = v_uid
  limit 1;

  if v_staff_id is null then
    raise exception 'No staff profile found for current user';
  end if;

  if p_end_time <= p_start_time then
    raise exception 'end_time must be after start_time';
  end if;

  insert into public.staff_availability
    (staff_id, day_of_week, start_time, end_time, is_available)
  values
    (v_staff_id, p_day_of_week, p_start_time, p_end_time, p_is_available)
  on conflict (staff_id, day_of_week)
  do update set
    start_time   = excluded.start_time,
    end_time     = excluded.end_time,
    is_available = excluded.is_available;

  -- Audit
  insert into public.audit_log (user_id, action, table_name, record_id, new_data)
  values (
    v_uid, 'UPDATE', 'staff_availability', v_staff_id,
    jsonb_build_object(
      'day_of_week', p_day_of_week,
      'start_time', p_start_time,
      'end_time', p_end_time,
      'is_available', p_is_available
    )
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- staff_request_time_off
--
-- Creates a pending time-off request for the calling staff member.
-- ---------------------------------------------------------------------------
create or replace function public.staff_request_time_off(
  p_date_from  date,
  p_date_to    date,
  p_reason     text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid      uuid;
  v_staff_id uuid;
  v_id       uuid;
begin
  v_uid := auth.uid();
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  select id into v_staff_id
  from public.staff_profiles
  where user_id = v_uid
  limit 1;

  if v_staff_id is null then
    raise exception 'No staff profile found for current user';
  end if;

  if p_date_to < p_date_from then
    raise exception 'date_to must be >= date_from';
  end if;

  insert into public.staff_time_off (staff_id, date_from, date_to, reason, status)
  values (v_staff_id, p_date_from, p_date_to, p_reason, 'pending')
  returning id into v_id;

  -- Audit
  insert into public.audit_log (user_id, action, table_name, record_id, new_data)
  values (
    v_uid, 'INSERT', 'staff_time_off', v_id,
    jsonb_build_object(
      'date_from', p_date_from,
      'date_to', p_date_to,
      'reason', p_reason
    )
  );

  return v_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- staff_add_client_note
--
-- Adds a private note to a client record. Requires manage_client_notes.
-- Returns the new note id.
-- ---------------------------------------------------------------------------
create or replace function public.staff_add_client_note(
  p_client_id uuid,
  p_note      text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid      uuid;
  v_staff_id uuid;
  v_note_id  uuid;
begin
  v_uid := auth.uid();
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  if not public.has_permission(v_uid, 'manage_client_notes') then
    raise exception 'Forbidden: missing manage_client_notes';
  end if;

  select id into v_staff_id
  from public.staff_profiles
  where user_id = v_uid
  limit 1;

  if v_staff_id is null then
    raise exception 'No staff profile found';
  end if;

  insert into public.client_notes (client_id, staff_id, note)
  values (p_client_id, v_staff_id, p_note)
  returning id into v_note_id;

  -- Audit
  insert into public.audit_log (user_id, action, table_name, record_id, new_data)
  values (
    v_uid, 'INSERT', 'client_notes', v_note_id,
    jsonb_build_object('client_id', p_client_id, 'note_preview', left(p_note, 80))
  );

  return v_note_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- notify_staff_new_assignment
--
-- Called after an appointment is assigned to a staff member.
-- Inserts an in_app notification row for that staff user.
-- Used by the booking path to populate the notifications inbox.
-- ---------------------------------------------------------------------------
create or replace function public.notify_staff_new_assignment(
  p_appointment_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_appt     record;
  v_staff_uid uuid;
  v_service_name text;
  v_client_name  text;
begin
  select a.*, s.name_en as svc_name, c.full_name as cli_name
  into v_appt
  from public.appointments a
  join public.services s on s.id = a.service_id
  join public.clients  c on c.id = a.client_id
  where a.id = p_appointment_id;

  if not found then return; end if;
  if v_appt.staff_id is null then return; end if;

  select user_id into v_staff_uid
  from public.staff_profiles
  where id = v_appt.staff_id
  limit 1;

  if v_staff_uid is null then return; end if;

  insert into public.notifications (user_id, channel, status, subject, body)
  values (
    v_staff_uid,
    'in_app',
    'pending',
    'New Booking Assigned',
    'You have a new appointment: ' || v_appt.svc_name ||
    ' with ' || v_appt.cli_name ||
    ' on ' || to_char(v_appt.start_at at time zone 'Asia/Riyadh', 'Mon DD, YYYY HH12:MI AM') || '.'
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Grant execute permissions
-- ---------------------------------------------------------------------------
grant execute on function public.staff_transition_appointment(uuid, text)
  to authenticated;

grant execute on function public.staff_upsert_availability(smallint, time, time, boolean)
  to authenticated;

grant execute on function public.staff_request_time_off(date, date, text)
  to authenticated;

grant execute on function public.staff_add_client_note(uuid, text)
  to authenticated;

grant execute on function public.notify_staff_new_assignment(uuid)
  to authenticated, service_role;

-- ============================== migrations/005_admin_metrics.sql ==============================
-- =============================================================================
-- Shiny Beauty Center — Phase 4: Admin Metrics Functions
-- Migration: 005_admin_metrics.sql
-- All functions: SECURITY DEFINER, read-only, gated on has_permission
-- =============================================================================

-- ---------------------------------------------------------------------------
-- admin_get_revenue_metrics
-- Returns revenue KPIs for a given period with % vs previous period
-- Parameters: p_period = 'today' | 'week' | 'month'
-- ---------------------------------------------------------------------------
create or replace function public.admin_get_revenue_metrics(
  p_period text default 'month'   -- 'today' | 'week' | 'month'
)
returns table (
  current_revenue  numeric,
  previous_revenue numeric,
  change_pct       numeric,
  total_bookings   bigint,
  completed_count  bigint,
  cancelled_count  bigint,
  no_show_count    bigint,
  no_show_rate     numeric
)
language plpgsql stable
security definer
set search_path = public
as $$
declare
  v_uid       uuid;
  v_now       timestamptz := now();
  v_curr_from timestamptz;
  v_curr_to   timestamptz;
  v_prev_from timestamptz;
  v_prev_to   timestamptz;
begin
  v_uid := auth.uid();
  if not public.has_permission(v_uid, 'view_dashboard') then
    raise exception 'Forbidden: view_dashboard required';
  end if;

  -- Compute period boundaries
  case p_period
    when 'today' then
      v_curr_from := date_trunc('day', v_now);
      v_curr_to   := v_curr_from + interval '1 day';
      v_prev_from := v_curr_from - interval '1 day';
      v_prev_to   := v_curr_from;
    when 'week' then
      v_curr_from := date_trunc('week', v_now);
      v_curr_to   := v_curr_from + interval '7 days';
      v_prev_from := v_curr_from - interval '7 days';
      v_prev_to   := v_curr_from;
    else -- 'month'
      v_curr_from := date_trunc('month', v_now);
      v_curr_to   := v_curr_from + interval '1 month';
      v_prev_from := v_curr_from - interval '1 month';
      v_prev_to   := v_curr_from;
  end case;

  return query
  with curr as (
    select
      coalesce(sum(s.price), 0)                              as rev,
      count(*)                                               as total,
      count(*) filter (where a.status = 'completed')         as completed,
      count(*) filter (where a.status = 'cancelled')         as cancelled,
      count(*) filter (where a.status = 'no_show')           as no_shows
    from public.appointments a
    join public.services s on s.id = a.service_id
    where a.start_at >= v_curr_from
      and a.start_at <  v_curr_to
      and a.status  != 'cancelled'
  ),
  prev as (
    select coalesce(sum(s.price), 0) as rev
    from public.appointments a
    join public.services s on s.id = a.service_id
    where a.start_at >= v_prev_from
      and a.start_at <  v_prev_to
      and a.status   != 'cancelled'
  )
  select
    curr.rev                                                              as current_revenue,
    prev.rev                                                              as previous_revenue,
    case when prev.rev = 0 then 0
         else round(((curr.rev - prev.rev) / prev.rev) * 100, 1) end     as change_pct,
    curr.total                                                            as total_bookings,
    curr.completed                                                        as completed_count,
    curr.cancelled                                                        as cancelled_count,
    curr.no_shows                                                         as no_show_count,
    case when (curr.total - curr.cancelled) = 0 then 0
         else round((curr.no_shows::numeric / (curr.total - curr.cancelled)) * 100, 1)
    end                                                                   as no_show_rate
  from curr, prev;
end;
$$;

-- ---------------------------------------------------------------------------
-- admin_get_revenue_trend
-- Returns daily revenue for the last N days (for the revenue chart)
-- ---------------------------------------------------------------------------
create or replace function public.admin_get_revenue_trend(
  p_days int default 30
)
returns table (
  day      date,
  revenue  numeric,
  bookings bigint
)
language plpgsql stable
security definer
set search_path = public
as $$
declare
  v_uid uuid;
begin
  v_uid := auth.uid();
  if not public.has_permission(v_uid, 'view_dashboard') then
    raise exception 'Forbidden: view_dashboard required';
  end if;

  return query
  select
    a.start_at::date                as day,
    coalesce(sum(s.price), 0)       as revenue,
    count(*)                        as bookings
  from public.appointments a
  join public.services s on s.id = a.service_id
  where a.start_at >= (now() - (p_days || ' days')::interval)
    and a.status not in ('cancelled')
  group by a.start_at::date
  order by a.start_at::date;
end;
$$;

-- ---------------------------------------------------------------------------
-- admin_get_peak_hours
-- Returns booking counts by hour-of-day × day-of-week for heatmap
-- ---------------------------------------------------------------------------
create or replace function public.admin_get_peak_hours(
  p_days int default 90
)
returns table (
  day_of_week smallint,
  hour_of_day smallint,
  count       bigint
)
language plpgsql stable
security definer
set search_path = public
as $$
declare
  v_uid uuid;
begin
  v_uid := auth.uid();
  if not public.has_permission(v_uid, 'view_dashboard') then
    raise exception 'Forbidden: view_dashboard required';
  end if;

  return query
  select
    extract(dow  from a.start_at at time zone 'Asia/Riyadh')::smallint as day_of_week,
    extract(hour from a.start_at at time zone 'Asia/Riyadh')::smallint as hour_of_day,
    count(*)
  from public.appointments a
  where a.start_at >= (now() - (p_days || ' days')::interval)
    and a.status not in ('cancelled', 'no_show')
  group by 1, 2
  order by 1, 2;
end;
$$;

-- ---------------------------------------------------------------------------
-- admin_get_client_metrics
-- New vs returning clients for a period
-- ---------------------------------------------------------------------------
create or replace function public.admin_get_client_metrics(
  p_period text default 'month'
)
returns table (
  total_clients   bigint,
  new_clients     bigint,
  returning_clients bigint
)
language plpgsql stable
security definer
set search_path = public
as $$
declare
  v_uid       uuid;
  v_now       timestamptz := now();
  v_curr_from timestamptz;
  v_curr_to   timestamptz;
begin
  v_uid := auth.uid();
  if not public.has_permission(v_uid, 'view_dashboard') then
    raise exception 'Forbidden: view_dashboard required';
  end if;

  case p_period
    when 'today' then
      v_curr_from := date_trunc('day', v_now);
      v_curr_to   := v_curr_from + interval '1 day';
    when 'week' then
      v_curr_from := date_trunc('week', v_now);
      v_curr_to   := v_curr_from + interval '7 days';
    else
      v_curr_from := date_trunc('month', v_now);
      v_curr_to   := v_curr_from + interval '1 month';
  end case;

  return query
  with period_clients as (
    select distinct a.client_id
    from public.appointments a
    where a.start_at >= v_curr_from
      and a.start_at <  v_curr_to
      and a.status not in ('cancelled')
  ),
  new_in_period as (
    select pc.client_id
    from period_clients pc
    join public.clients c on c.id = pc.client_id
    where c.created_at >= v_curr_from
  )
  select
    (select count(*) from period_clients)              as total_clients,
    (select count(*) from new_in_period)               as new_clients,
    (select count(*) from period_clients) -
    (select count(*) from new_in_period)               as returning_clients;
end;
$$;

-- ---------------------------------------------------------------------------
-- admin_get_staff_performance
-- Per-staff: appointments handled, revenue, utilisation %, avg rating
-- ---------------------------------------------------------------------------
create or replace function public.admin_get_staff_performance(
  p_from date default null,
  p_to   date default null
)
returns table (
  staff_id     uuid,
  staff_name   text,
  total_appts  bigint,
  completed    bigint,
  revenue      numeric,
  no_shows     bigint,
  avg_rating   numeric
)
language plpgsql stable
security definer
set search_path = public
as $$
declare
  v_uid uuid;
  v_from timestamptz;
  v_to   timestamptz;
begin
  v_uid := auth.uid();
  if not public.has_permission(v_uid, 'view_staff_performance') then
    raise exception 'Forbidden: view_staff_performance required';
  end if;

  v_from := coalesce(p_from::timestamptz, date_trunc('month', now()));
  v_to   := coalesce(p_to::timestamptz + interval '1 day', now());

  return query
  select
    sp.id                                                           as staff_id,
    pr.full_name                                                    as staff_name,
    count(a.id)                                                     as total_appts,
    count(a.id) filter (where a.status = 'completed')              as completed,
    coalesce(sum(s.price) filter (where a.status = 'completed'), 0) as revenue,
    count(a.id) filter (where a.status = 'no_show')                as no_shows,
    round(avg(r.rating), 1)                                        as avg_rating
  from public.staff_profiles sp
  join public.profiles pr on pr.id = sp.user_id
  left join public.appointments a
    on a.staff_id = sp.id
   and a.start_at >= v_from
   and a.start_at <  v_to
  left join public.services s on s.id = a.service_id
  left join public.reviews r
    on r.appointment_id = a.id
   and r.is_published = true
  where sp.is_active = true
  group by sp.id, pr.full_name
  order by revenue desc;
end;
$$;

-- ---------------------------------------------------------------------------
-- admin_get_service_popularity
-- Most-booked services with revenue breakdown
-- ---------------------------------------------------------------------------
create or replace function public.admin_get_service_popularity(
  p_from date default null,
  p_to   date default null
)
returns table (
  service_id    uuid,
  service_name  text,
  category_name text,
  booking_count bigint,
  revenue       numeric,
  avg_price     numeric
)
language plpgsql stable
security definer
set search_path = public
as $$
declare
  v_uid uuid;
  v_from timestamptz;
  v_to   timestamptz;
begin
  v_uid := auth.uid();
  if not (
    public.has_permission(v_uid, 'view_sales_reports') or
    public.has_permission(v_uid, 'view_booking_reports')
  ) then
    raise exception 'Forbidden: view_sales_reports or view_booking_reports required';
  end if;

  v_from := coalesce(p_from::timestamptz, date_trunc('month', now()));
  v_to   := coalesce(p_to::timestamptz + interval '1 day', now());

  return query
  select
    s.id                       as service_id,
    s.name_en                  as service_name,
    sc.name_en                 as category_name,
    count(a.id)                as booking_count,
    coalesce(sum(s.price) filter (where a.status = 'completed'), 0) as revenue,
    round(avg(s.price), 2)     as avg_price
  from public.services s
  join public.service_categories sc on sc.id = s.category_id
  left join public.appointments a
    on a.service_id = s.id
   and a.start_at >= v_from
   and a.start_at <  v_to
   and a.status != 'cancelled'
  where s.is_active = true
  group by s.id, s.name_en, sc.name_en
  order by booking_count desc;
end;
$$;

-- ---------------------------------------------------------------------------
-- admin_get_commission_summary
-- Staff commission (configurable rate; default 30%)
-- ---------------------------------------------------------------------------
create or replace function public.admin_get_commission_summary(
  p_from          date    default null,
  p_to            date    default null,
  p_commission_pct numeric default 30
)
returns table (
  staff_id        uuid,
  staff_name      text,
  completed_appts bigint,
  revenue         numeric,
  commission      numeric
)
language plpgsql stable
security definer
set search_path = public
as $$
declare
  v_uid uuid;
  v_from timestamptz;
  v_to   timestamptz;
begin
  v_uid := auth.uid();
  if not public.has_permission(v_uid, 'view_commission') then
    raise exception 'Forbidden: view_commission required';
  end if;

  v_from := coalesce(p_from::timestamptz, date_trunc('month', now()));
  v_to   := coalesce(p_to::timestamptz + interval '1 day', now());

  return query
  select
    sp.id                                                               as staff_id,
    pr.full_name                                                        as staff_name,
    count(a.id)                                                         as completed_appts,
    coalesce(sum(s.price), 0)                                           as revenue,
    round(coalesce(sum(s.price), 0) * p_commission_pct / 100, 2)       as commission
  from public.staff_profiles sp
  join public.profiles pr on pr.id = sp.user_id
  left join public.appointments a
    on a.staff_id = sp.id
   and a.status = 'completed'
   and a.start_at >= v_from
   and a.start_at <  v_to
  left join public.services s on s.id = a.service_id
  where sp.is_active = true
  group by sp.id, pr.full_name
  order by revenue desc;
end;
$$;

-- ---------------------------------------------------------------------------
-- admin_get_all_time_off
-- All time-off requests (pending, approved, rejected) for managers
-- ---------------------------------------------------------------------------
create or replace function public.admin_get_all_time_off()
returns table (
  id           uuid,
  staff_id     uuid,
  staff_name   text,
  date_from    date,
  date_to      date,
  reason       text,
  status       text,
  reviewed_by  uuid,
  reviewed_at  timestamptz,
  created_at   timestamptz
)
language plpgsql stable
security definer
set search_path = public
as $$
declare
  v_uid uuid;
begin
  v_uid := auth.uid();
  if not public.has_permission(v_uid, 'manage_leave_requests') then
    raise exception 'Forbidden: manage_leave_requests required';
  end if;

  return query
  select
    sto.id,
    sto.staff_id,
    pr.full_name   as staff_name,
    sto.date_from,
    sto.date_to,
    sto.reason,
    sto.status::text,
    sto.reviewed_by,
    sto.reviewed_at,
    sto.created_at
  from public.staff_time_off sto
  join public.staff_profiles sp on sp.id = sto.staff_id
  join public.profiles pr on pr.id = sp.user_id
  order by
    (sto.status = 'pending') desc,
    sto.created_at desc;
end;
$$;

-- ---------------------------------------------------------------------------
-- admin_review_time_off
-- Approve or reject a time-off request
-- ---------------------------------------------------------------------------
create or replace function public.admin_review_time_off(
  p_id     uuid,
  p_status text   -- 'approved' | 'rejected'
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid;
begin
  v_uid := auth.uid();
  if not public.has_permission(v_uid, 'manage_leave_requests') then
    raise exception 'Forbidden: manage_leave_requests required';
  end if;

  if p_status not in ('approved', 'rejected') then
    raise exception 'Invalid status: %', p_status;
  end if;

  update public.staff_time_off
  set
    status      = p_status::public.time_off_status,
    reviewed_by = v_uid,
    reviewed_at = now()
  where id = p_id;

  if not found then
    raise exception 'Time-off request not found: %', p_id;
  end if;

  -- Audit
  insert into public.audit_log (user_id, action, table_name, record_id, new_data)
  values (
    v_uid, 'UPDATE', 'staff_time_off', p_id,
    jsonb_build_object('status', p_status, 'reviewed_by', v_uid, 'reviewed_at', now())
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- admin_get_all_bookings
-- All appointments across staff, date range, for the calendar/reports
-- ---------------------------------------------------------------------------
create or replace function public.admin_get_all_bookings(
  p_from date default null,
  p_to   date default null
)
returns table (
  id           uuid,
  client_name  text,
  staff_name   text,
  service_name text,
  status       text,
  start_at     timestamptz,
  end_at       timestamptz,
  price        numeric,
  color_hex    text
)
language plpgsql stable
security definer
set search_path = public
as $$
declare
  v_uid  uuid;
  v_from timestamptz;
  v_to   timestamptz;
begin
  v_uid := auth.uid();
  if not public.has_permission(v_uid, 'view_all_bookings') then
    raise exception 'Forbidden: view_all_bookings required';
  end if;

  v_from := coalesce(p_from::timestamptz, date_trunc('week', now()));
  v_to   := coalesce(p_to::timestamptz + interval '1 day',
                     date_trunc('week', now()) + interval '7 days');

  return query
  select
    a.id,
    c.full_name           as client_name,
    pr.full_name          as staff_name,
    s.name_en             as service_name,
    a.status::text,
    a.start_at,
    a.end_at,
    s.price,
    sp.color_hex
  from public.appointments a
  join public.clients c       on c.id = a.client_id
  left join public.staff_profiles sp on sp.id = a.staff_id
  left join public.profiles pr       on pr.id = sp.user_id
  join public.services s             on s.id = a.service_id
  where a.start_at >= v_from
    and a.start_at <  v_to
  order by a.start_at;
end;
$$;

-- ---------------------------------------------------------------------------
-- admin_get_users_with_roles
-- All profiles with their roles (for the users management page)
-- ---------------------------------------------------------------------------
create or replace function public.admin_get_users_with_roles()
returns table (
  user_id    uuid,
  full_name  text,
  email      text,
  is_active  boolean,
  roles      jsonb,
  created_at timestamptz
)
language plpgsql stable
security definer
set search_path = public
as $$
declare
  v_uid uuid;
begin
  v_uid := auth.uid();
  if not (
    public.has_permission(v_uid, 'manage_permissions') or
    public.has_permission(v_uid, 'assign_roles')
  ) then
    raise exception 'Forbidden';
  end if;

  return query
  select
    p.id                                                          as user_id,
    p.full_name,
    au.email,
    p.is_active,
    coalesce(
      jsonb_agg(
        jsonb_build_object('id', r.id, 'name', r.name)
      ) filter (where r.id is not null),
      '[]'::jsonb
    )                                                             as roles,
    p.created_at
  from public.profiles p
  left join auth.users au on au.id = p.id
  left join public.user_roles ur on ur.user_id = p.id
  left join public.roles r on r.id = ur.role_id
  group by p.id, p.full_name, au.email, p.is_active, p.created_at
  order by p.created_at desc;
end;
$$;

-- ---------------------------------------------------------------------------
-- admin_assign_role / admin_remove_role
-- ---------------------------------------------------------------------------
create or replace function public.admin_assign_role(
  p_user_id uuid,
  p_role_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid;
begin
  v_uid := auth.uid();
  if not public.has_permission(v_uid, 'assign_roles') then
    raise exception 'Forbidden: assign_roles required';
  end if;

  insert into public.user_roles (user_id, role_id, assigned_by)
  values (p_user_id, p_role_id, v_uid)
  on conflict (user_id, role_id) do nothing;

  insert into public.audit_log (user_id, action, table_name, record_id, new_data)
  values (v_uid, 'INSERT', 'user_roles', p_user_id,
          jsonb_build_object('role_id', p_role_id));
end;
$$;

create or replace function public.admin_remove_role(
  p_user_id uuid,
  p_role_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid;
begin
  v_uid := auth.uid();
  if not public.has_permission(v_uid, 'assign_roles') then
    raise exception 'Forbidden: assign_roles required';
  end if;

  delete from public.user_roles
  where user_id = p_user_id and role_id = p_role_id;

  insert into public.audit_log (user_id, action, table_name, record_id, old_data)
  values (v_uid, 'DELETE', 'user_roles', p_user_id,
          jsonb_build_object('role_id', p_role_id));
end;
$$;

-- ---------------------------------------------------------------------------
-- admin_set_user_permission
-- Grant or revoke an individual permission for a user
-- granted=true → explicit grant; granted=false → explicit revoke (deny)
-- ---------------------------------------------------------------------------
create or replace function public.admin_set_user_permission(
  p_user_id      uuid,
  p_permission_id uuid,
  p_granted      boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid;
begin
  v_uid := auth.uid();
  if not public.has_permission(v_uid, 'manage_permissions') then
    raise exception 'Forbidden: manage_permissions required';
  end if;

  insert into public.user_permissions (user_id, permission_id, granted, granted_by)
  values (p_user_id, p_permission_id, p_granted, v_uid)
  on conflict (user_id, permission_id)
  do update set
    granted    = excluded.granted,
    granted_by = excluded.granted_by;

  insert into public.audit_log (user_id, action, table_name, record_id, new_data)
  values (v_uid, 'UPDATE', 'user_permissions', p_user_id,
          jsonb_build_object(
            'permission_id', p_permission_id,
            'granted', p_granted
          ));
end;
$$;

-- ---------------------------------------------------------------------------
-- admin_clear_user_permission
-- Remove an individual permission override (fall back to role)
-- ---------------------------------------------------------------------------
create or replace function public.admin_clear_user_permission(
  p_user_id      uuid,
  p_permission_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid;
begin
  v_uid := auth.uid();
  if not public.has_permission(v_uid, 'manage_permissions') then
    raise exception 'Forbidden: manage_permissions required';
  end if;

  delete from public.user_permissions
  where user_id = p_user_id and permission_id = p_permission_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Grant execute permissions
-- ---------------------------------------------------------------------------
grant execute on function public.admin_get_revenue_metrics(text)               to authenticated;
grant execute on function public.admin_get_revenue_trend(int)                  to authenticated;
grant execute on function public.admin_get_peak_hours(int)                     to authenticated;
grant execute on function public.admin_get_client_metrics(text)                to authenticated;
grant execute on function public.admin_get_staff_performance(date, date)       to authenticated;
grant execute on function public.admin_get_service_popularity(date, date)      to authenticated;
grant execute on function public.admin_get_commission_summary(date, date, numeric) to authenticated;
grant execute on function public.admin_get_all_time_off()                      to authenticated;
grant execute on function public.admin_review_time_off(uuid, text)             to authenticated;
grant execute on function public.admin_get_all_bookings(date, date)            to authenticated;
grant execute on function public.admin_get_users_with_roles()                  to authenticated;
grant execute on function public.admin_assign_role(uuid, uuid)                 to authenticated;
grant execute on function public.admin_remove_role(uuid, uuid)                 to authenticated;
grant execute on function public.admin_set_user_permission(uuid, uuid, boolean) to authenticated;
grant execute on function public.admin_clear_user_permission(uuid, uuid)       to authenticated;

-- ============================== migrations/006_payments.sql ==============================
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

-- ============================== migrations/007_reviews.sql ==============================
-- =============================================================================
-- Shiny Beauty Center — Phase 7: Reviews & Ratings
-- Migration: 007_reviews.sql
-- =============================================================================
-- What this migration adds:
--   1. service_id + staff_id columns on reviews (links review to service/staff)
--   2. is_hidden column (admin soft-delete / moderation flag)
--   3. SECURITY DEFINER RPC: submit_review — validated, one-per-appointment
--   4. SECURITY DEFINER RPC: admin_moderate_review — hide/unhide
--   5. Helper views / functions: rating stats per staff + per service
--   6. RLS updates to cover new columns
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Add missing columns to reviews
--    is_published already exists (from 001_schema.sql)
--    We add service_id, staff_id, and is_hidden
-- ---------------------------------------------------------------------------
alter table public.reviews
  add column if not exists service_id uuid references public.services(id) on delete set null,
  add column if not exists staff_id   uuid references public.staff_profiles(id) on delete set null,
  add column if not exists is_hidden  boolean not null default false;

-- Ensure is_published exists (created in 001 but guard anyway)
alter table public.reviews
  add column if not exists is_published boolean not null default false;

-- Index for fast average lookups
create index if not exists idx_reviews_staff_id   on public.reviews(staff_id)   where is_hidden = false;
create index if not exists idx_reviews_service_id on public.reviews(service_id) where is_hidden = false;
create index if not exists idx_reviews_appointment on public.reviews(appointment_id);

-- ---------------------------------------------------------------------------
-- 2. submit_review(p_appointment_id, p_rating, p_comment)
--    SECURITY DEFINER so it can bypass RLS and do all checks atomically.
--    Returns the new review id.
-- ---------------------------------------------------------------------------
create or replace function public.submit_review(
  p_appointment_id uuid,
  p_rating         smallint,
  p_comment        text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid        uuid;
  v_client_id  uuid;
  v_appt       record;
  v_review_id  uuid;
begin
  -- Who is calling?
  v_uid := auth.uid();
  if v_uid is null then
    raise exception 'Authentication required';
  end if;

  -- Rating range check
  if p_rating not between 1 and 5 then
    raise exception 'Rating must be between 1 and 5, got: %', p_rating;
  end if;

  -- Fetch the caller's client record
  select id into v_client_id
  from public.clients
  where user_id = v_uid
  limit 1;

  if v_client_id is null then
    raise exception 'Client profile not found for this user';
  end if;

  -- Fetch the appointment; lock it to prevent concurrent double-submissions
  select a.id, a.client_id, a.service_id, a.staff_id, a.status
  into v_appt
  from public.appointments a
  where a.id = p_appointment_id
  for update;

  if not found then
    raise exception 'Appointment not found: %', p_appointment_id;
  end if;

  -- Ownership check: the caller must be the client on the appointment
  if v_appt.client_id <> v_client_id then
    raise exception 'You are not the client for this appointment';
  end if;

  -- Status check: only completed appointments can be reviewed
  if v_appt.status <> 'completed' then
    raise exception 'Only completed appointments can be reviewed (status: %)', v_appt.status;
  end if;

  -- One review per appointment
  if exists (
    select 1 from public.reviews where appointment_id = p_appointment_id
  ) then
    raise exception 'A review for this appointment already exists';
  end if;

  -- Insert the review (published by default so it shows on public listings;
  -- admin can hide it via admin_moderate_review)
  insert into public.reviews (
    client_id,
    appointment_id,
    service_id,
    staff_id,
    rating,
    comment,
    is_published,
    is_hidden
  )
  values (
    v_client_id,
    p_appointment_id,
    v_appt.service_id,
    v_appt.staff_id,
    p_rating,
    p_comment,
    true,    -- published immediately; admin can hide
    false
  )
  returning id into v_review_id;

  return v_review_id;
end;
$$;

grant execute on function public.submit_review(uuid, smallint, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 3. admin_moderate_review(p_review_id, p_hide)
--    Toggle the is_hidden flag. Requires manage_reviews permission.
-- ---------------------------------------------------------------------------
create or replace function public.admin_moderate_review(
  p_review_id uuid,
  p_hide      boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid;
begin
  v_uid := auth.uid();
  if not public.has_permission(v_uid, 'manage_reviews') then
    raise exception 'Forbidden: manage_reviews required';
  end if;

  update public.reviews
  set is_hidden  = p_hide,
      is_published = not p_hide   -- hidden → unpublish; unhidden → publish
  where id = p_review_id;

  if not found then
    raise exception 'Review not found: %', p_review_id;
  end if;

  -- Audit
  insert into public.audit_log (user_id, action, table_name, record_id, new_data)
  values (
    v_uid, 'UPDATE', 'reviews', p_review_id,
    jsonb_build_object('is_hidden', p_hide, 'moderated_by', v_uid, 'moderated_at', now())
  );
end;
$$;

grant execute on function public.admin_moderate_review(uuid, boolean) to authenticated;

-- ---------------------------------------------------------------------------
-- 4. admin_get_all_reviews — for the admin moderation list
--    Requires manage_reviews permission.
-- ---------------------------------------------------------------------------
create or replace function public.admin_get_all_reviews(
  p_limit  int default 100,
  p_offset int default 0
)
returns table (
  id             uuid,
  appointment_id uuid,
  client_name    text,
  service_name   text,
  staff_name     text,
  rating         smallint,
  comment        text,
  is_published   boolean,
  is_hidden      boolean,
  created_at     timestamptz
)
language plpgsql stable
security definer
set search_path = public
as $$
declare
  v_uid uuid;
begin
  v_uid := auth.uid();
  if not public.has_permission(v_uid, 'manage_reviews') then
    raise exception 'Forbidden: manage_reviews required';
  end if;

  return query
  select
    r.id,
    r.appointment_id,
    c.full_name                as client_name,
    coalesce(s.name_en, '—')  as service_name,
    coalesce(pr.full_name, '—') as staff_name,
    r.rating,
    r.comment,
    r.is_published,
    r.is_hidden,
    r.created_at
  from public.reviews r
  join public.clients c        on c.id = r.client_id
  left join public.services s  on s.id = r.service_id
  left join public.staff_profiles sp on sp.id = r.staff_id
  left join public.profiles pr       on pr.id = sp.user_id
  order by r.created_at desc
  limit p_limit
  offset p_offset;
end;
$$;

grant execute on function public.admin_get_all_reviews(int, int) to authenticated;

-- ---------------------------------------------------------------------------
-- 5. get_staff_rating_stats(p_staff_id) — avg + count for a single staff member
--    Public read (only published, non-hidden reviews count)
-- ---------------------------------------------------------------------------
create or replace function public.get_staff_rating_stats(
  p_staff_id uuid
)
returns table (
  avg_rating   numeric,
  review_count bigint
)
language sql stable
security definer
set search_path = public
as $$
  select
    round(avg(rating)::numeric, 1) as avg_rating,
    count(*)                       as review_count
  from public.reviews
  where staff_id     = p_staff_id
    and is_published = true
    and is_hidden    = false;
$$;

grant execute on function public.get_staff_rating_stats(uuid) to authenticated, anon;

-- ---------------------------------------------------------------------------
-- 6. get_service_rating_stats(p_service_id) — avg + count for a service
-- ---------------------------------------------------------------------------
create or replace function public.get_service_rating_stats(
  p_service_id uuid
)
returns table (
  avg_rating   numeric,
  review_count bigint
)
language sql stable
security definer
set search_path = public
as $$
  select
    round(avg(rating)::numeric, 1) as avg_rating,
    count(*)                       as review_count
  from public.reviews
  where service_id   = p_service_id
    and is_published = true
    and is_hidden    = false;
$$;

grant execute on function public.get_service_rating_stats(uuid) to authenticated, anon;

-- ---------------------------------------------------------------------------
-- 7. get_my_review_for_appointment(p_appointment_id)
--    Returns the caller's review for a given appointment (or nothing).
-- ---------------------------------------------------------------------------
create or replace function public.get_my_review_for_appointment(
  p_appointment_id uuid
)
returns table (
  id         uuid,
  rating     smallint,
  comment    text,
  created_at timestamptz
)
language sql stable
security definer
set search_path = public
as $$
  select r.id, r.rating, r.comment, r.created_at
  from public.reviews r
  join public.clients c on c.id = r.client_id
  where r.appointment_id = p_appointment_id
    and c.user_id = auth.uid();
$$;

grant execute on function public.get_my_review_for_appointment(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 8. Update admin_get_staff_performance to use the corrected join
--    (the original already joins reviews; re-create to include is_hidden check)
-- ---------------------------------------------------------------------------
create or replace function public.admin_get_staff_performance(
  p_from date default null,
  p_to   date default null
)
returns table (
  staff_id     uuid,
  staff_name   text,
  total_appts  bigint,
  completed    bigint,
  revenue      numeric,
  no_shows     bigint,
  avg_rating   numeric
)
language plpgsql stable
security definer
set search_path = public
as $$
declare
  v_uid  uuid;
  v_from timestamptz;
  v_to   timestamptz;
begin
  v_uid := auth.uid();
  if not public.has_permission(v_uid, 'view_staff_performance') then
    raise exception 'Forbidden: view_staff_performance required';
  end if;

  v_from := coalesce(p_from::timestamptz, date_trunc('month', now()));
  v_to   := coalesce(p_to::timestamptz + interval '1 day', now());

  return query
  select
    sp.id                                                                 as staff_id,
    pr.full_name                                                          as staff_name,
    count(a.id)                                                           as total_appts,
    count(a.id) filter (where a.status = 'completed')                    as completed,
    coalesce(sum(s.price) filter (where a.status = 'completed'), 0)      as revenue,
    count(a.id) filter (where a.status = 'no_show')                      as no_shows,
    round(avg(r.rating) filter (where r.is_hidden = false), 1)           as avg_rating
  from public.staff_profiles sp
  join public.profiles pr on pr.id = sp.user_id
  left join public.appointments a
    on a.staff_id = sp.id
   and a.start_at >= v_from
   and a.start_at <  v_to
  left join public.services s on s.id = a.service_id
  left join public.reviews r
    on r.appointment_id = a.id
   and r.is_published = true
  where sp.is_active = true
  group by sp.id, pr.full_name
  order by revenue desc;
end;
$$;

-- ============================== seed.sql ==============================
-- =============================================================================
-- Shiny Beauty Center — Seed Data
-- Run AFTER migrations: psql -f supabase/seed.sql
-- =============================================================================

-- =============================================================================
-- PERMISSIONS (grouped by module)
-- =============================================================================
insert into public.permissions (key, module, description) values

  -- Appointments
  ('view_all_bookings',        'appointments', 'View all appointments across all clients and staff'),
  ('view_own_bookings',        'appointments', 'View own appointments only'),
  ('create_booking',           'appointments', 'Create new appointments'),
  ('edit_booking',             'appointments', 'Edit existing appointments'),
  ('reschedule_booking',       'appointments', 'Reschedule appointments to a new time'),
  ('cancel_booking',           'appointments', 'Cancel appointments'),
  ('assign_staff_to_booking',  'appointments', 'Assign or reassign staff to an appointment'),
  ('confirm_booking',          'appointments', 'Confirm pending appointments'),
  ('check_in_client',          'appointments', 'Mark a client as checked in'),
  ('mark_no_show',             'appointments', 'Mark a client as no-show'),
  ('manage_waitlist',          'appointments', 'Manage the waiting list'),

  -- Services
  ('view_services',            'services', 'View the services catalogue'),
  ('create_service',           'services', 'Add new services'),
  ('edit_service',             'services', 'Edit existing services'),
  ('delete_service',           'services', 'Remove services'),
  ('manage_service_categories','services', 'Create and edit service categories'),
  ('manage_service_pricing',   'services', 'Change service prices'),
  ('manage_service_duration',  'services', 'Change service durations'),

  -- Clients
  ('view_all_clients',         'clients', 'Browse the full client list'),
  ('view_client_details',      'clients', 'View individual client profiles'),
  ('create_client',            'clients', 'Add new client records'),
  ('edit_client',              'clients', 'Edit client information'),
  ('delete_client',            'clients', 'Delete client records'),
  ('view_client_history',      'clients', 'View a client''s booking history'),
  ('manage_client_notes',      'clients', 'Add and edit private notes on clients'),
  ('export_client_data',       'clients', 'Export client data (GDPR-aware)'),

  -- Staff / Users
  ('view_staff',               'staff', 'View staff profiles and list'),
  ('create_user',              'staff', 'Create new user accounts'),
  ('edit_user',                'staff', 'Edit user profile information'),
  ('deactivate_user',          'staff', 'Deactivate / suspend user accounts'),
  ('assign_roles',             'staff', 'Assign or remove roles from users'),
  ('manage_permissions',       'staff', 'Grant or revoke individual permissions'),
  ('view_staff_schedule',      'staff', 'View staff schedules'),
  ('edit_staff_schedule',      'staff', 'Edit staff schedules'),
  ('manage_staff_availability','staff', 'Manage staff working hours and leave'),

  -- Sales / Promotions
  ('view_sales',               'sales', 'View sales records'),
  ('create_sale',              'sales', 'Create POS sales'),
  ('apply_discount',           'sales', 'Apply discounts at checkout'),
  ('manage_promotions',        'sales', 'Create and manage promotions/coupons'),
  ('manage_gift_cards',        'sales', 'Issue and manage gift cards'),
  ('manage_packages',          'sales', 'Create and sell service packages'),
  ('view_commission',          'sales', 'View staff commission reports'),

  -- Finance
  ('view_financial_reports',   'finance', 'Access financial summary reports'),
  ('view_revenue',             'finance', 'View revenue figures and transactions'),
  ('manage_invoices',          'finance', 'Create, edit, and void invoices'),
  ('process_payments',         'finance', 'Record and process payments'),
  ('issue_refund',             'finance', 'Issue refunds to clients'),
  ('manage_expenses',          'finance', 'Log and manage business expenses'),
  ('view_payouts',             'finance', 'View staff payout records'),
  ('manage_taxes',             'finance', 'Configure tax rates'),
  ('export_financial_data',    'finance', 'Export financial data to CSV/Excel'),

  -- Inventory
  ('view_inventory',           'inventory', 'View stock levels and items'),
  ('manage_inventory',         'inventory', 'Add/edit inventory items'),
  ('adjust_stock',             'inventory', 'Adjust stock quantities'),
  ('manage_suppliers',         'inventory', 'Manage supplier contacts'),
  ('low_stock_alerts',         'inventory', 'Receive and manage low-stock alerts'),

  -- Reports
  ('view_dashboard',           'reports', 'View the main analytics dashboard'),
  ('view_sales_reports',       'reports', 'Access sales reports'),
  ('view_booking_reports',     'reports', 'Access booking/appointment reports'),
  ('view_staff_performance',   'reports', 'View staff performance metrics'),
  ('view_client_reports',      'reports', 'Access client analytics reports'),
  ('export_reports',           'reports', 'Export reports to CSV/PDF'),

  -- Marketing
  ('manage_campaigns',         'marketing', 'Create and manage marketing campaigns'),
  ('send_notifications',       'marketing', 'Send bulk notifications to clients'),
  ('manage_loyalty_program',   'marketing', 'Configure and manage loyalty rewards'),
  ('manage_reviews',           'marketing', 'Moderate client reviews'),

  -- HR
  ('view_employees',           'hr', 'View employee records'),
  ('manage_employee_records',  'hr', 'Create and edit employee records'),
  ('manage_attendance',        'hr', 'Track and manage staff attendance'),
  ('manage_leave_requests',    'hr', 'Approve or reject leave requests'),
  ('manage_payroll',           'hr', 'Manage payroll processing'),
  ('view_hr_reports',          'hr', 'Access HR analytics and reports'),

  -- Settings
  ('manage_salon_settings',         'settings', 'Configure salon profile and branding'),
  ('manage_business_hours',         'settings', 'Set salon operating hours'),
  ('manage_payment_settings',       'settings', 'Configure payment gateways'),
  ('manage_notification_settings',  'settings', 'Configure notification templates'),
  ('manage_integrations',           'settings', 'Connect third-party integrations'),
  ('view_audit_log',                'settings', 'View the audit/activity log')

on conflict (key) do nothing;

-- =============================================================================
-- ROLES
-- =============================================================================
insert into public.roles (id, name, description) values
  ('00000001-0000-0000-0000-000000000001', 'Admin',            'Full system access — salon owner / IT admin'),
  ('00000001-0000-0000-0000-000000000002', 'Manager',          'Day-to-day operations: bookings, staff, reports, promotions'),
  ('00000001-0000-0000-0000-000000000003', 'Sales',            'POS, promotions, gift cards, client creation'),
  ('00000001-0000-0000-0000-000000000004', 'Customer Service', 'Client-facing: bookings, client records, notifications'),
  ('00000001-0000-0000-0000-000000000005', 'Finance',          'Financial reports, invoices, payments, refunds'),
  ('00000001-0000-0000-0000-000000000006', 'HR',               'Employee records, attendance, leave, payroll'),
  ('00000001-0000-0000-0000-000000000007', 'Staff',            'Stylists/technicians: own schedule, own bookings, check-in'),
  ('00000001-0000-0000-0000-000000000008', 'Client',           'End-customers: browse, book, own data')
on conflict (id) do nothing;

-- =============================================================================
-- ROLE → PERMISSION ASSIGNMENTS
-- =============================================================================

-- Helper: insert role_permission by role name + permission key
-- We use a DO block to resolve UUIDs from names
create or replace function pg_temp.grant_perms(p_role uuid, p_keys text[]) returns void language sql as $fn$
  insert into public.role_permissions (role_id, permission_id)
  select p_role, id from public.permissions where key = any(p_keys)
  on conflict do nothing;
$fn$;

do $$
declare
  r_admin  uuid := '00000001-0000-0000-0000-000000000001';
  r_mgr    uuid := '00000001-0000-0000-0000-000000000002';
  r_sales  uuid := '00000001-0000-0000-0000-000000000003';
  r_cs     uuid := '00000001-0000-0000-0000-000000000004';
  r_fin    uuid := '00000001-0000-0000-0000-000000000005';
  r_hr     uuid := '00000001-0000-0000-0000-000000000006';
  r_staff  uuid := '00000001-0000-0000-0000-000000000007';
  r_client uuid := '00000001-0000-0000-0000-000000000008';
begin

  -- ---- ADMIN: all permissions ----
  insert into public.role_permissions (role_id, permission_id)
  select r_admin, id from public.permissions
  on conflict do nothing;

  -- ---- MANAGER ----
  perform pg_temp.grant_perms(r_mgr, array[
    -- Appointments (all)
    'view_all_bookings','create_booking','edit_booking','reschedule_booking',
    'cancel_booking','assign_staff_to_booking','confirm_booking','check_in_client',
    'mark_no_show','manage_waitlist',
    -- Services (all)
    'view_services','create_service','edit_service','delete_service',
    'manage_service_categories','manage_service_pricing','manage_service_duration',
    -- Clients (no export)
    'view_all_clients','view_client_details','create_client','edit_client',
    'view_client_history','manage_client_notes',
    -- Staff (no manage_permissions)
    'view_staff','edit_user','assign_roles','view_staff_schedule',
    'edit_staff_schedule','manage_staff_availability',
    -- Sales
    'view_sales','create_sale','apply_discount','manage_promotions',
    'manage_gift_cards','manage_packages','view_commission',
    -- Reports
    'view_dashboard','view_sales_reports','view_booking_reports',
    'view_staff_performance','view_client_reports','export_reports',
    -- Marketing
    'manage_campaigns','send_notifications','manage_loyalty_program','manage_reviews',
    -- Inventory
    'view_inventory','manage_inventory','adjust_stock','manage_suppliers','low_stock_alerts',
    -- Finance (read only + invoices)
    'view_financial_reports','view_revenue','manage_invoices',
    -- Settings
    'manage_salon_settings','manage_business_hours','view_audit_log'
  ]);

  -- ---- SALES ----
  perform pg_temp.grant_perms(r_sales, array[
    'view_all_bookings','create_booking','reschedule_booking','cancel_booking',
    'confirm_booking','check_in_client','mark_no_show',
    'view_services',
    'view_all_clients','view_client_details','create_client','edit_client',
    'view_client_history','manage_client_notes',
    'view_sales','create_sale','apply_discount','manage_promotions',
    'manage_gift_cards','manage_packages','view_commission',
    'manage_loyalty_program',
    'view_inventory'
  ]);

  -- ---- CUSTOMER SERVICE ----
  perform pg_temp.grant_perms(r_cs, array[
    'view_all_bookings','create_booking','reschedule_booking','cancel_booking',
    'confirm_booking','check_in_client','mark_no_show','manage_waitlist',
    'view_services',
    'view_all_clients','view_client_details','create_client','edit_client',
    'view_client_history','manage_client_notes',
    'send_notifications',
    'manage_reviews'
  ]);

  -- ---- FINANCE ----
  perform pg_temp.grant_perms(r_fin, array[
    'view_all_bookings',
    'view_all_clients','view_client_details','view_client_history',
    'view_financial_reports','view_revenue','manage_invoices','process_payments',
    'issue_refund','manage_expenses','view_payouts','manage_taxes',
    'export_financial_data',
    'view_sales_reports','export_reports',
    'view_audit_log'
  ]);

  -- ---- HR ----
  perform pg_temp.grant_perms(r_hr, array[
    'view_staff','view_staff_schedule',
    'view_employees','manage_employee_records','manage_attendance',
    'manage_leave_requests','manage_payroll','view_hr_reports',
    'manage_staff_availability',
    'view_audit_log'
  ]);

  -- ---- STAFF (stylists) ----
  perform pg_temp.grant_perms(r_staff, array[
    'view_own_bookings','check_in_client','mark_no_show',
    'view_services',
    'view_client_details','view_client_history',
    'view_staff_schedule','manage_staff_availability',
    'view_inventory'
  ]);

  -- ---- CLIENT (end-customers) ----
  perform pg_temp.grant_perms(r_client, array[
    'view_own_bookings','create_booking','reschedule_booking','cancel_booking',
    'view_services'
  ]);

end;
$$;

-- ============================== seed_catalog.sql ==============================
-- =============================================================================
-- Shiny Beauty Center — Catalog + Staff Seed (Phase 2)
-- File: supabase/seed_catalog.sql
-- Idempotent: run after 001_schema.sql and seed.sql
-- =============================================================================

-- ---------------------------------------------------------------------------
-- SERVICE CATEGORIES
-- ---------------------------------------------------------------------------
insert into public.service_categories (id, name_en, name_ar, sort_order, is_active) values
  ('c0000001-0000-0000-0000-000000000001', 'Massages',        'المساج',            1, true),
  ('c0000001-0000-0000-0000-000000000002', 'Facials',         'العناية بالبشرة',   2, true),
  ('c0000001-0000-0000-0000-000000000003', 'Lash Services',   'خدمات الرموش',      3, true),
  ('c0000001-0000-0000-0000-000000000004', 'Manicure',        'مانيكير',           4, true),
  ('c0000001-0000-0000-0000-000000000005', 'Pedicure',        'باديكير',           5, true),
  ('c0000001-0000-0000-0000-000000000006', 'Moroccan Bath',   'الحمام المغربي',    6, true)
on conflict (id) do update set
  name_en    = excluded.name_en,
  name_ar    = excluded.name_ar,
  sort_order = excluded.sort_order,
  is_active  = excluded.is_active;

-- ---------------------------------------------------------------------------
-- SERVICES
-- ---------------------------------------------------------------------------
insert into public.services
  (id, category_id, name_en, name_ar, description_en, description_ar,
   price, duration_minutes, is_active)
values

  -- ── Massages ──────────────────────────────────────────────────────────────
  ('a0000001-0000-0000-0000-000000000001',
   'c0000001-0000-0000-0000-000000000001',
   'Swedish Relaxation Massage',
   'مساج سويدي استرخائي',
   'A full-body Swedish massage using light to medium pressure to ease tension, improve circulation, and leave you deeply relaxed.',
   'مساج سويدي على الجسم كاملاً بضغط خفيف إلى متوسط لتخفيف التوتر وتحسين الدورة الدموية وترك الجسم في حالة من الاسترخاء العميق.',
   220.00, 60, true),

  ('a0000001-0000-0000-0000-000000000002',
   'c0000001-0000-0000-0000-000000000001',
   'Deep Tissue Massage',
   'مساج الأنسجة العميقة',
   'Targets deep muscle layers to release chronic tension and knots. Ideal for active women and those with persistent stiffness.',
   'يستهدف طبقات العضلات العميقة لتحرير التوتر المزمن والعقد. مثالي للنساء النشطات ومن يعانين من التيبس المستمر.',
   280.00, 75, true),

  ('a0000001-0000-0000-0000-000000000003',
   'c0000001-0000-0000-0000-000000000001',
   'Hot Stone Massage',
   'مساج الأحجار الساخنة',
   'Smooth heated basalt stones melt away tension while warm oil nourishes your skin. A truly luxurious experience.',
   'أحجار بازلتية ملساء ساخنة تذيب التوتر بينما يغذي الزيت الدافئ بشرتك. تجربة فاخرة بحق.',
   350.00, 90, true),

  -- ── Facials ───────────────────────────────────────────────────────────────
  ('a0000001-0000-0000-0000-000000000004',
   'c0000001-0000-0000-0000-000000000002',
   'Classic Hydrating Facial',
   'تنظيف بشرة كلاسيكي مرطب',
   'Deep cleanse, exfoliation, and a moisturising mask tailored to your skin type. Leaves skin glowing and refreshed.',
   'تنظيف عميق وتقشير وقناع مرطب مصمم لنوع بشرتك. يترك البشرة مشرقة ومنتعشة.',
   180.00, 60, true),

  ('a0000001-0000-0000-0000-000000000005',
   'c0000001-0000-0000-0000-000000000002',
   'Anti-Aging Facial',
   'علاج تجديد شباب البشرة',
   'Advanced firming treatment with collagen-boosting serums and a lifting massage to visibly reduce fine lines.',
   'علاج شد متقدم بأمصال مقوية للكولاجين ومساج رافع لتقليل الخطوط الدقيقة بشكل واضح.',
   320.00, 75, true),

  ('a0000001-0000-0000-0000-000000000006',
   'c0000001-0000-0000-0000-000000000002',
   'Brightening Vitamin C Facial',
   'علاج الإشراق بفيتامين سي',
   'A radiance-boosting facial using vitamin C serums and antioxidant-rich masks to even skin tone and restore natural glow.',
   'علاج لتعزيز الإشراق باستخدام أمصال فيتامين سي وأقنعة غنية بمضادات الأكسدة لتوحيد لون البشرة واستعادة التوهج الطبيعي.',
   250.00, 60, true),

  -- ── Lash Services ─────────────────────────────────────────────────────────
  ('a0000001-0000-0000-0000-000000000007',
   'c0000001-0000-0000-0000-000000000003',
   'Classic Lash Extensions',
   'وصلات رموش كلاسيكية',
   'One silk extension per natural lash for a beautifully natural, lengthened look. Long-lasting and feather-light.',
   'امتداد حريري واحد لكل رمشة طبيعية لمظهر جميل وطبيعي وممدود. طويل الأمد وخفيف كالريشة.',
   180.00, 90, true),

  ('a0000001-0000-0000-0000-000000000008',
   'c0000001-0000-0000-0000-000000000003',
   'Volume Lash Extensions',
   'وصلات رموش حجمية',
   'Multiple ultra-fine extensions per lash for dramatic, full-fan volume. Perfect for a glamorous, made-up look.',
   'امتدادات فائقة النعومة متعددة لكل رمشة لحجم مروحي ودرامي مكثف. مثالية للمظهر الجذاب.',
   260.00, 120, true),

  ('a0000001-0000-0000-0000-000000000009',
   'c0000001-0000-0000-0000-000000000003',
   'Lash Lift & Tint',
   'رفع وتلوين الرموش',
   'Curl and lift your natural lashes from the root, then tint them for a mascara-free darkened look that lasts 6–8 weeks.',
   'تجعيل ورفع رموشك الطبيعية من الجذر ثم تلوينها للحصول على مظهر داكن بدون ماسكارا يدوم 6-8 أسابيع.',
   150.00, 60, true),

  -- ── Manicure ──────────────────────────────────────────────────────────────
  ('a0000001-0000-0000-0000-000000000010',
   'c0000001-0000-0000-0000-000000000004',
   'Classic Manicure',
   'مانيكير كلاسيكي',
   'Nail shaping, cuticle care, hand massage, and your choice of polish for beautifully groomed hands.',
   'تشكيل الأظافر والعناية بالقشرة ومساج اليدين ولون طلاء من اختيارك لأيدي مرتبة بشكل جميل.',
   80.00, 45, true),

  ('a0000001-0000-0000-0000-000000000011',
   'c0000001-0000-0000-0000-000000000004',
   'Gel Manicure',
   'مانيكير جيل',
   'Long-lasting gel polish that stays chip-free for up to 3 weeks. Includes shaping, cuticle work, and UV-cured colour.',
   'طلاء جيل طويل الأمد يبقى بدون تقشير لمدة تصل إلى 3 أسابيع. يشمل التشكيل والعناية بالقشرة واللون المعالج بالأشعة فوق البنفسجية.',
   120.00, 60, true),

  ('a0000001-0000-0000-0000-000000000012',
   'c0000001-0000-0000-0000-000000000004',
   'Nail Art Design',
   'تصميم نقش الأظافر',
   'Express your personality with hand-painted nail art. From minimalist lines to intricate florals — designed just for you.',
   'عبري عن شخصيتك بنقش أظافر مرسوم يدوياً. من الخطوط البسيطة إلى الزهور المعقدة — مصمم خصيصاً لك.',
   150.00, 75, true),

  -- ── Pedicure ──────────────────────────────────────────────────────────────
  ('a0000001-0000-0000-0000-000000000013',
   'c0000001-0000-0000-0000-000000000005',
   'Classic Pedicure',
   'باديكير كلاسيكي',
   'Foot soak, callus removal, nail shaping, cuticle care, foot massage, and polish for beautifully soft feet.',
   'نقع القدمين وإزالة الجلد الميت وتشكيل الأظافر والعناية بالقشرة ومساج القدمين والطلاء لقدمين ناعمتين.',
   100.00, 60, true),

  ('a0000001-0000-0000-0000-000000000014',
   'c0000001-0000-0000-0000-000000000005',
   'Luxury Spa Pedicure',
   'باديكير سبا فاخر',
   'An indulgent pedicure with exfoliating scrub, nourishing paraffin wax, hot towel wrap, and extended foot-and-calf massage.',
   'باديكير متميز مع مقشر للجلد، شمع البارافين المغذي، ضمادة المنشفة الساخنة، ومساج موسع للقدم والساق.',
   180.00, 90, true),

  -- ── Moroccan Bath ─────────────────────────────────────────────────────────
  ('a0000001-0000-0000-0000-000000000015',
   'c0000001-0000-0000-0000-000000000006',
   'Classic Moroccan Hammam',
   'الحمام المغربي الكلاسيكي',
   'Traditional steam session followed by a thorough exfoliation with the iconic Kessa glove and black soap, then a moisturising mask.',
   'جلسة بخار تقليدية تليها تقشير شامل بقفاز الكيسة المميز والصابون البلدي ثم قناع مرطب.',
   300.00, 90, true),

  ('a0000001-0000-0000-0000-000000000016',
   'c0000001-0000-0000-0000-000000000006',
   'Signature Hammam & Massage',
   'حمام مغربي مميز مع مساج',
   'Our signature luxury experience: classic Hammam exfoliation followed by a full relaxation massage with argan-infused oil.',
   'تجربتنا الفاخرة المميزة: تقشير الحمام الكلاسيكي متبوعاً بمساج استرخاء كامل بزيت الأرغان.',
   480.00, 150, true)

on conflict (id) do update set
  name_en          = excluded.name_en,
  name_ar          = excluded.name_ar,
  description_en   = excluded.description_en,
  description_ar   = excluded.description_ar,
  price            = excluded.price,
  duration_minutes = excluded.duration_minutes,
  is_active        = excluded.is_active;

-- ---------------------------------------------------------------------------
-- STAFF PROFILES
-- Staff users live in auth.users; in seed we use profiles with fixed UUIDs
-- and link staff_profiles to them. If auth.users rows don't exist yet (offline
-- seed), we insert placeholder profiles directly.
-- ---------------------------------------------------------------------------

-- Placeholder auth user rows (only insert if not present)
insert into auth.users (id, email, role, created_at, updated_at, raw_user_meta_data)
values
  ('e0000001-0000-0000-0000-000000000001', 'layla@shiny.sa',    'authenticated', now(), now(),
   '{"full_name":"Layla Al-Rashidi"}'),
  ('e0000001-0000-0000-0000-000000000002', 'hessa@shiny.sa',    'authenticated', now(), now(),
   '{"full_name":"Hessa Al-Otaibi"}'),
  ('e0000001-0000-0000-0000-000000000003', 'noura@shiny.sa',    'authenticated', now(), now(),
   '{"full_name":"Noura Al-Harbi"}')
on conflict (id) do nothing;

-- Profiles
insert into public.profiles (id, full_name, phone, locale, is_active)
values
  ('e0000001-0000-0000-0000-000000000001', 'Layla Al-Rashidi', '+966501110001', 'ar', true),
  ('e0000001-0000-0000-0000-000000000002', 'Hessa Al-Otaibi',  '+966501110002', 'ar', true),
  ('e0000001-0000-0000-0000-000000000003', 'Noura Al-Harbi',   '+966501110003', 'ar', true)
on conflict (id) do update set
  full_name  = excluded.full_name,
  phone      = excluded.phone,
  is_active  = excluded.is_active;

-- Staff profiles
insert into public.staff_profiles (id, user_id, bio, specialties, color_hex, is_active)
values
  ('f0000001-0000-0000-0000-000000000001',
   'e0000001-0000-0000-0000-000000000001',
   'Layla is a certified massage therapist with 8 years of experience specialising in relaxation and deep-tissue techniques.',
   array['Massage','Body Treatments'],
   '#fda4af', true),

  ('f0000001-0000-0000-0000-000000000002',
   'e0000001-0000-0000-0000-000000000002',
   'Hessa is a licensed aesthetician and lash artist with 6 years of expertise in advanced facials and lash extensions.',
   array['Facials','Lash Extensions','Lash Lift'],
   '#c4b5fd', true),

  ('f0000001-0000-0000-0000-000000000003',
   'e0000001-0000-0000-0000-000000000003',
   'Noura is a nail technician and Hammam specialist with 5 years of experience creating stunning nail art and authentic Hammam experiences.',
   array['Manicure','Pedicure','Moroccan Bath'],
   '#86efac', true)
on conflict (id) do update set
  bio         = excluded.bio,
  specialties = excluded.specialties,
  color_hex   = excluded.color_hex,
  is_active   = excluded.is_active;

-- ---------------------------------------------------------------------------
-- STAFF AVAILABILITY (working hours: Sun–Thu 10:00–20:00, Fri off, Sat 11:00–18:00)
-- day_of_week: 0=Sun, 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat
-- ---------------------------------------------------------------------------
do $$
declare
  sp1 uuid := 'f0000001-0000-0000-0000-000000000001';  -- Layla
  sp2 uuid := 'f0000001-0000-0000-0000-000000000002';  -- Hessa
  sp3 uuid := 'f0000001-0000-0000-0000-000000000003';  -- Noura
  d smallint;
begin
  -- Working days Sun–Thu (0–4) for all three staff
  foreach d in array array[0,1,2,3,4] loop
    insert into public.staff_availability (staff_id, day_of_week, start_time, end_time, is_available)
    values
      (sp1, d, '10:00', '20:00', true),
      (sp2, d, '10:00', '20:00', true),
      (sp3, d, '10:00', '20:00', true)
    on conflict (staff_id, day_of_week) do update set
      start_time   = excluded.start_time,
      end_time     = excluded.end_time,
      is_available = excluded.is_available;
  end loop;

  -- Friday off
  insert into public.staff_availability (staff_id, day_of_week, start_time, end_time, is_available)
  values
    (sp1, 5, '10:00', '20:00', false),
    (sp2, 5, '10:00', '20:00', false),
    (sp3, 5, '10:00', '20:00', false)
  on conflict (staff_id, day_of_week) do update set
    is_available = false;

  -- Saturday shorter hours
  insert into public.staff_availability (staff_id, day_of_week, start_time, end_time, is_available)
  values
    (sp1, 6, '11:00', '18:00', true),
    (sp2, 6, '11:00', '18:00', true),
    (sp3, 6, '11:00', '18:00', true)
  on conflict (staff_id, day_of_week) do update set
    start_time   = excluded.start_time,
    end_time     = excluded.end_time,
    is_available = excluded.is_available;
end;
$$;

-- ---------------------------------------------------------------------------
-- CLIENTS (sample clients for dev/demo)
-- ---------------------------------------------------------------------------
insert into public.clients
  (id, user_id, full_name, phone, email, locale, is_active)
values
  ('cb000001-0000-0000-0000-000000000001',
   null, 'Sara Mohammed Al-Qasim', '+966507771001', 'sara@example.com', 'ar', true),
  ('cb000001-0000-0000-0000-000000000002',
   null, 'Fatima Khalid Al-Zahrani', '+966507771002', 'fatima@example.com', 'ar', true),
  ('cb000001-0000-0000-0000-000000000003',
   null, 'Aisha Ibrahim Al-Dosari', '+966507771003', 'aisha@example.com', 'en', true),
  ('cb000001-0000-0000-0000-000000000004',
   null, 'Rima Nasser Al-Mutairi', '+966507771004', 'rima@example.com', 'ar', true)
on conflict (id) do update set
  full_name  = excluded.full_name,
  phone      = excluded.phone,
  email      = excluded.email,
  is_active  = excluded.is_active;

-- ---------------------------------------------------------------------------
-- SAMPLE APPOINTMENTS (future dates, for My Appointments demo)
-- Calculated relative to a fixed anchor so the seed remains runnable at any time.
-- ---------------------------------------------------------------------------
insert into public.appointments
  (id, client_id, staff_id, service_id, status, start_at, end_at)
values
  -- Confirmed upcoming — Classic Facial with Hessa, 2 days from now at 11:00
  ('ad000001-0000-0000-0000-000000000001',
   'cb000001-0000-0000-0000-000000000001',
   'f0000001-0000-0000-0000-000000000002',
   'a0000001-0000-0000-0000-000000000004',
   'confirmed',
   (current_date + interval '2 days')::timestamptz + interval '11 hours',
   (current_date + interval '2 days')::timestamptz + interval '12 hours'),

  -- Confirmed upcoming — Swedish Massage with Layla, 5 days from now at 14:00
  ('ad000001-0000-0000-0000-000000000002',
   'cb000001-0000-0000-0000-000000000002',
   'f0000001-0000-0000-0000-000000000001',
   'a0000001-0000-0000-0000-000000000001',
   'confirmed',
   (current_date + interval '5 days')::timestamptz + interval '14 hours',
   (current_date + interval '5 days')::timestamptz + interval '15 hours'),

  -- Completed past — Lash Lift with Hessa, 10 days ago
  ('ad000001-0000-0000-0000-000000000003',
   'cb000001-0000-0000-0000-000000000001',
   'f0000001-0000-0000-0000-000000000002',
   'a0000001-0000-0000-0000-000000000009',
   'completed',
   (current_date - interval '10 days')::timestamptz + interval '11 hours',
   (current_date - interval '10 days')::timestamptz + interval '12 hours'),

  -- Completed past — Moroccan Hammam with Noura, 20 days ago
  ('ad000001-0000-0000-0000-000000000004',
   'cb000001-0000-0000-0000-000000000003',
   'f0000001-0000-0000-0000-000000000003',
   'a0000001-0000-0000-0000-000000000015',
   'completed',
   (current_date - interval '20 days')::timestamptz + interval '13 hours',
   (current_date - interval '20 days')::timestamptz + interval '14 hours' + interval '30 minutes')
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- LOYALTY POINTS for sample clients
-- ---------------------------------------------------------------------------
insert into public.loyalty_points (client_id, points, reason, ref_type)
values
  ('cb000001-0000-0000-0000-000000000001', 22,  'Completed appointment', 'appointment'),
  ('cb000001-0000-0000-0000-000000000001', 30,  'Completed appointment', 'appointment'),
  ('cb000001-0000-0000-0000-000000000002', 22,  'Completed appointment', 'appointment'),
  ('cb000001-0000-0000-0000-000000000003', 30,  'Completed appointment', 'appointment');

