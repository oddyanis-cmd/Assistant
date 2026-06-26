/**
 * Hand-authored Database type stubs — matches the Phase 1 schema exactly.
 * Run `supabase gen types typescript` in later phases to replace this file
 * with the auto-generated version once a live project is connected.
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

// ---- Enums ----------------------------------------------------------------
export type AppLocale = "en" | "ar";
export type AppointmentStatus =
  | "pending"
  | "confirmed"
  | "checked_in"
  | "completed"
  | "cancelled"
  | "no_show";
export type PaymentStatus = "pending" | "paid" | "partial" | "refunded" | "failed";
export type NotificationChannel = "whatsapp" | "sms" | "email" | "in_app";
export type NotificationStatus = "pending" | "sent" | "failed" | "read";
export type AuditAction = "INSERT" | "UPDATE" | "DELETE";

// ---- Table row shapes -----------------------------------------------------
export interface Profile {
  id: string;
  full_name: string | null;
  phone: string | null;
  locale: AppLocale;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Role {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
}

export interface Permission {
  id: string;
  key: string;
  module: string;
  description: string | null;
}

export interface RolePermission {
  role_id: string;
  permission_id: string;
}

export interface UserPermission {
  id: string;
  user_id: string;
  permission_id: string;
  /** true = explicitly granted; false = explicitly revoked (deny) */
  granted: boolean;
  granted_by: string | null;
  created_at: string;
}

export interface UserRole {
  user_id: string;
  role_id: string;
  assigned_by: string | null;
  created_at: string;
}

export interface StaffProfile {
  id: string;
  user_id: string;
  bio: string | null;
  specialties: string[] | null;
  color_hex: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface StaffAvailability {
  id: string;
  staff_id: string;
  day_of_week: number; // 0=Sun … 6=Sat
  start_time: string;  // HH:MM
  end_time: string;    // HH:MM
  is_available: boolean;
}

export interface Client {
  id: string;
  user_id: string | null; // null = walk-in / phone-only
  full_name: string;
  phone: string | null;
  email: string | null;
  date_of_birth: string | null;
  notes: string | null;
  locale: AppLocale;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ServiceCategory {
  id: string;
  name_en: string;
  name_ar: string;
  sort_order: number;
  is_active: boolean;
}

export interface Service {
  id: string;
  category_id: string;
  name_en: string;
  name_ar: string;
  description_en: string | null;
  description_ar: string | null;
  price: number;
  duration_minutes: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Appointment {
  id: string;
  client_id: string;
  staff_id: string | null;
  service_id: string;
  status: AppointmentStatus;
  start_at: string;
  end_at: string;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface Payment {
  id: string;
  appointment_id: string | null;
  invoice_id: string | null;
  amount: number;
  currency: string;
  status: PaymentStatus;
  provider: string | null;
  provider_ref: string | null;
  created_at: string;
  updated_at: string;
}

export interface Invoice {
  id: string;
  client_id: string;
  appointment_id: string | null;
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  status: PaymentStatus;
  issued_at: string;
  due_at: string | null;
  paid_at: string | null;
  created_at: string;
}

export interface Promotion {
  id: string;
  code: string | null;
  description_en: string | null;
  description_ar: string | null;
  discount_type: "percent" | "fixed";
  discount_value: number;
  min_purchase: number | null;
  max_uses: number | null;
  used_count: number;
  valid_from: string | null;
  valid_until: string | null;
  is_active: boolean;
  created_at: string;
}

export interface GiftCard {
  id: string;
  code: string;
  initial_value: number;
  remaining_value: number;
  currency: string;
  purchased_by: string | null;
  expires_at: string | null;
  is_active: boolean;
  created_at: string;
}

export interface LoyaltyPoint {
  id: string;
  client_id: string;
  points: number;
  reason: string | null;
  ref_type: string | null;
  ref_id: string | null;
  created_at: string;
}

export interface InventoryItem {
  id: string;
  name_en: string;
  name_ar: string;
  sku: string | null;
  quantity: number;
  unit: string | null;
  low_stock_threshold: number | null;
  supplier_id: string | null;
  cost: number | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Supplier {
  id: string;
  name: string;
  contact_name: string | null;
  phone: string | null;
  email: string | null;
  notes: string | null;
  is_active: boolean;
  created_at: string;
}

export interface Review {
  id: string;
  client_id: string;
  appointment_id: string | null;
  rating: number;
  comment: string | null;
  is_published: boolean;
  created_at: string;
}

export interface Notification {
  id: string;
  user_id: string;
  channel: NotificationChannel;
  status: NotificationStatus;
  subject: string | null;
  body: string;
  sent_at: string | null;
  read_at: string | null;
  created_at: string;
}

export interface AuditLog {
  id: string;
  user_id: string | null;
  action: AuditAction;
  table_name: string;
  record_id: string | null;
  old_data: Json | null;
  new_data: Json | null;
  ip_address: string | null;
  created_at: string;
}

// ---- Database shape for @supabase/supabase-js generics -------------------
export interface Database {
  public: {
    Tables: {
      profiles: { Row: Profile; Insert: Omit<Profile, "created_at" | "updated_at">; Update: Partial<Profile> };
      roles: { Row: Role; Insert: Omit<Role, "created_at">; Update: Partial<Role> };
      permissions: { Row: Permission; Insert: Permission; Update: Partial<Permission> };
      role_permissions: { Row: RolePermission; Insert: RolePermission; Update: Partial<RolePermission> };
      user_permissions: { Row: UserPermission; Insert: Omit<UserPermission, "id" | "created_at">; Update: Partial<UserPermission> };
      user_roles: { Row: UserRole; Insert: Omit<UserRole, "created_at">; Update: Partial<UserRole> };
      staff_profiles: { Row: StaffProfile; Insert: Omit<StaffProfile, "id" | "created_at" | "updated_at">; Update: Partial<StaffProfile> };
      staff_availability: { Row: StaffAvailability; Insert: Omit<StaffAvailability, "id">; Update: Partial<StaffAvailability> };
      clients: { Row: Client; Insert: Omit<Client, "id" | "created_at" | "updated_at">; Update: Partial<Client> };
      service_categories: { Row: ServiceCategory; Insert: Omit<ServiceCategory, "id">; Update: Partial<ServiceCategory> };
      services: { Row: Service; Insert: Omit<Service, "id" | "created_at" | "updated_at">; Update: Partial<Service> };
      appointments: { Row: Appointment; Insert: Omit<Appointment, "id" | "created_at" | "updated_at">; Update: Partial<Appointment> };
      payments: { Row: Payment; Insert: Omit<Payment, "id" | "created_at" | "updated_at">; Update: Partial<Payment> };
      invoices: { Row: Invoice; Insert: Omit<Invoice, "id" | "created_at">; Update: Partial<Invoice> };
      promotions: { Row: Promotion; Insert: Omit<Promotion, "id" | "created_at">; Update: Partial<Promotion> };
      gift_cards: { Row: GiftCard; Insert: Omit<GiftCard, "id" | "created_at">; Update: Partial<GiftCard> };
      loyalty_points: { Row: LoyaltyPoint; Insert: Omit<LoyaltyPoint, "id" | "created_at">; Update: Partial<LoyaltyPoint> };
      inventory_items: { Row: InventoryItem; Insert: Omit<InventoryItem, "id" | "created_at" | "updated_at">; Update: Partial<InventoryItem> };
      suppliers: { Row: Supplier; Insert: Omit<Supplier, "id" | "created_at">; Update: Partial<Supplier> };
      reviews: { Row: Review; Insert: Omit<Review, "id" | "created_at">; Update: Partial<Review> };
      notifications: { Row: Notification; Insert: Omit<Notification, "id" | "created_at">; Update: Partial<Notification> };
      audit_log: { Row: AuditLog; Insert: Omit<AuditLog, "id" | "created_at">; Update: never };
    };
    Functions: {
      has_permission: {
        Args: { uid: string; perm: string };
        Returns: boolean;
      };
    };
  };
}
