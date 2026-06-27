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
