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
--   4. Award loyalty points (10 pts per 100 QAR, rounded down).
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

  -- 9. Award loyalty points: 10 pts per 100 QAR
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
