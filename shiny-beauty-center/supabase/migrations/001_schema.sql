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
