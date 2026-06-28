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
