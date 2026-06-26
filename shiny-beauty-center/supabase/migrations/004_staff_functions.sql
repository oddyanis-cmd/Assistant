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
