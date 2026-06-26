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
