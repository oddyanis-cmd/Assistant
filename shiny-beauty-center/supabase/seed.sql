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

  procedure grant_perms(role_id uuid, perm_keys text[]) as $$
  declare
    pkey text;
    perm_id uuid;
  begin
    foreach pkey in array perm_keys loop
      select id into perm_id from public.permissions where key = pkey;
      if perm_id is not null then
        insert into public.role_permissions (role_id, permission_id)
        values (role_id, perm_id)
        on conflict do nothing;
      end if;
    end loop;
  end;
  $$;

begin

  -- ---- ADMIN: all permissions ----
  insert into public.role_permissions (role_id, permission_id)
  select r_admin, id from public.permissions
  on conflict do nothing;

  -- ---- MANAGER ----
  call grant_perms(r_mgr, array[
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
  call grant_perms(r_sales, array[
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
  call grant_perms(r_cs, array[
    'view_all_bookings','create_booking','reschedule_booking','cancel_booking',
    'confirm_booking','check_in_client','mark_no_show','manage_waitlist',
    'view_services',
    'view_all_clients','view_client_details','create_client','edit_client',
    'view_client_history','manage_client_notes',
    'send_notifications',
    'manage_reviews'
  ]);

  -- ---- FINANCE ----
  call grant_perms(r_fin, array[
    'view_all_bookings',
    'view_all_clients','view_client_details','view_client_history',
    'view_financial_reports','view_revenue','manage_invoices','process_payments',
    'issue_refund','manage_expenses','view_payouts','manage_taxes',
    'export_financial_data',
    'view_sales_reports','export_reports',
    'view_audit_log'
  ]);

  -- ---- HR ----
  call grant_perms(r_hr, array[
    'view_staff','view_staff_schedule',
    'view_employees','manage_employee_records','manage_attendance',
    'manage_leave_requests','manage_payroll','view_hr_reports',
    'manage_staff_availability',
    'view_audit_log'
  ]);

  -- ---- STAFF (stylists) ----
  call grant_perms(r_staff, array[
    'view_own_bookings','check_in_client','mark_no_show',
    'view_services',
    'view_client_details','view_client_history',
    'view_staff_schedule','manage_staff_availability',
    'view_inventory'
  ]);

  -- ---- CLIENT (end-customers) ----
  call grant_perms(r_client, array[
    'view_own_bookings','create_booking','reschedule_booking','cancel_booking',
    'view_services'
  ]);

end;
$$;
