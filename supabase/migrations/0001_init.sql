-- ============================================================================
-- ISKCON 60 Gala Volunteer Shift Signup — initial schema
-- Run in Supabase SQL editor (or `supabase db push`).
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id                       uuid primary key references auth.users(id) on delete cascade,
  email                    text not null unique,
  full_name                text not null default '',
  phone                    text,
  role                     text not null default 'volunteer'
                           check (role in ('volunteer', 'admin')),
  emergency_contact_name   text,
  emergency_contact_phone  text,
  created_at               timestamptz not null default now()
);

create table if not exists public.departments (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  description text
);

create table if not exists public.shifts (
  id              uuid primary key default gen_random_uuid(),
  department_id   uuid not null references public.departments(id) on delete cascade,
  title           text not null,
  start_time      timestamptz not null,
  end_time        timestamptz not null,
  max_volunteers  int  not null check (max_volunteers > 0),
  created_at      timestamptz not null default now(),
  constraint shifts_end_after_start check (end_time > start_time)
);

create table if not exists public.shift_assignments (
  id           uuid primary key default gen_random_uuid(),
  shift_id     uuid not null references public.shifts(id) on delete cascade,
  user_id      uuid not null references public.profiles(id) on delete cascade,
  assigned_at  timestamptz not null default now(),
  constraint shift_assignments_shift_user_key unique (shift_id, user_id)
);

create index if not exists shift_assignments_user_idx on public.shift_assignments (user_id);
create index if not exists shifts_department_idx on public.shifts (department_id);
create index if not exists shifts_start_idx on public.shifts (start_time);

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------
-- SECURITY DEFINER avoids RLS recursion when policies on profiles call it.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  );
$$;

-- Create a profile row automatically when someone signs in for the first time.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, phone)
  values (
    new.id,
    lower(new.email),
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    new.raw_user_meta_data ->> 'phone'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Volunteers may edit their own profile, but never their role or email.
-- Calls made without an auth context (SQL editor, service role) are trusted.
create or replace function public.protect_profile_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is not null and not public.is_admin() then
    if new.role is distinct from old.role then
      raise exception 'Only admins can change roles' using errcode = '42501';
    end if;
    if new.email is distinct from old.email then
      raise exception 'Email cannot be changed here' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_protect_profile_fields on public.profiles;
create trigger trg_protect_profile_fields
  before update on public.profiles
  for each row execute function public.protect_profile_fields();

-- ---------------------------------------------------------------------------
-- Booking rules: capacity + time-overlap, race-safe.
-- Runs for every insert on shift_assignments (RPC, direct insert, admin).
-- Advisory transaction locks serialise concurrent bookings for the same shift
-- and the same user, so two people taking the last slot cannot both succeed.
-- Error codes raised: SHIFT_NOT_FOUND, ALREADY_BOOKED, SLOT_FULL, TIME_CONFLICT
-- ---------------------------------------------------------------------------
create or replace function public.enforce_shift_booking_rules()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_shift     public.shifts%rowtype;
  v_count     int;
  v_conflict  boolean;
begin
  perform pg_advisory_xact_lock(hashtext('shift:' || new.shift_id::text));
  perform pg_advisory_xact_lock(hashtext('user:'  || new.user_id::text));

  select * into v_shift from public.shifts where id = new.shift_id;
  if not found then
    raise exception 'SHIFT_NOT_FOUND';
  end if;

  if exists (
    select 1 from public.shift_assignments
    where shift_id = new.shift_id and user_id = new.user_id
  ) then
    raise exception 'ALREADY_BOOKED';
  end if;

  select count(*) into v_count
  from public.shift_assignments
  where shift_id = new.shift_id;

  if v_count >= v_shift.max_volunteers then
    raise exception 'SLOT_FULL';
  end if;

  -- Interval overlap: (StartA < EndB) AND (EndA > StartB)
  select exists (
    select 1
    from public.shift_assignments sa
    join public.shifts s on s.id = sa.shift_id
    where sa.user_id = new.user_id
      and s.start_time < v_shift.end_time
      and s.end_time   > v_shift.start_time
  ) into v_conflict;

  if v_conflict then
    raise exception 'TIME_CONFLICT';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_enforce_shift_booking_rules on public.shift_assignments;
create trigger trg_enforce_shift_booking_rules
  before insert on public.shift_assignments
  for each row execute function public.enforce_shift_booking_rules();

-- ---------------------------------------------------------------------------
-- Realtime: broadcast a lightweight "capacity changed" signal so volunteers
-- (who cannot see other people's rows) still get live counter updates.
-- Skipped silently if the realtime schema is not present (plain Postgres).
-- ---------------------------------------------------------------------------
create or replace function public.broadcast_capacity_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  begin
    perform realtime.send(
      jsonb_build_object('table', TG_TABLE_NAME, 'op', TG_OP),
      'capacity_changed',
      'shift-capacity',
      false
    );
  exception when undefined_function or invalid_schema_name then
    null;
  end;
  return null;
end;
$$;

drop trigger if exists trg_broadcast_assignments on public.shift_assignments;
create trigger trg_broadcast_assignments
  after insert or delete on public.shift_assignments
  for each row execute function public.broadcast_capacity_change();

drop trigger if exists trg_broadcast_shifts on public.shifts;
create trigger trg_broadcast_shifts
  after insert or update or delete on public.shifts
  for each row execute function public.broadcast_capacity_change();

-- ---------------------------------------------------------------------------
-- Capacity view: counts only, no personal data, so volunteers can read it.
-- ---------------------------------------------------------------------------
create or replace view public.shift_capacity as
select
  s.id                                             as shift_id,
  s.department_id,
  s.max_volunteers,
  count(sa.id)::int                                as booked_count,
  greatest(s.max_volunteers - count(sa.id), 0)::int as remaining_slots
from public.shifts s
left join public.shift_assignments sa on sa.shift_id = s.id
group by s.id;

-- ---------------------------------------------------------------------------
-- RPCs used by the client
-- ---------------------------------------------------------------------------
create or replace function public.book_shift(p_shift_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'NOT_AUTHENTICATED' using errcode = '42501';
  end if;
  -- The trigger enforces capacity, overlap and duplicate rules.
  insert into public.shift_assignments (shift_id, user_id)
  values (p_shift_id, auth.uid());
end;
$$;

create or replace function public.cancel_shift(p_shift_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'NOT_AUTHENTICATED' using errcode = '42501';
  end if;
  delete from public.shift_assignments
  where shift_id = p_shift_id and user_id = auth.uid();
  if not found then
    raise exception 'NOT_BOOKED';
  end if;
end;
$$;

revoke all on function public.book_shift(uuid)   from public, anon;
revoke all on function public.cancel_shift(uuid) from public, anon;
grant execute on function public.book_shift(uuid)   to authenticated;
grant execute on function public.cancel_shift(uuid) to authenticated;
grant execute on function public.is_admin()         to authenticated;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table public.profiles          enable row level security;
alter table public.departments       enable row level security;
alter table public.shifts            enable row level security;
alter table public.shift_assignments enable row level security;

-- profiles
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles for select to authenticated
  using (id = auth.uid() or public.is_admin());

drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

drop policy if exists profiles_admin_all on public.profiles;
create policy profiles_admin_all on public.profiles for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- departments: everyone reads, admins write
drop policy if exists departments_read on public.departments;
create policy departments_read on public.departments for select to authenticated
  using (true);

drop policy if exists departments_admin_write on public.departments;
create policy departments_admin_write on public.departments for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- shifts: everyone reads, admins write
drop policy if exists shifts_read on public.shifts;
create policy shifts_read on public.shifts for select to authenticated
  using (true);

drop policy if exists shifts_admin_write on public.shifts;
create policy shifts_admin_write on public.shifts for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- shift_assignments: volunteers see/insert/delete only their own; admins see all
drop policy if exists assignments_select on public.shift_assignments;
create policy assignments_select on public.shift_assignments for select to authenticated
  using (user_id = auth.uid() or public.is_admin());

drop policy if exists assignments_insert_own on public.shift_assignments;
create policy assignments_insert_own on public.shift_assignments for insert to authenticated
  with check (user_id = auth.uid() or public.is_admin());

drop policy if exists assignments_delete_own on public.shift_assignments;
create policy assignments_delete_own on public.shift_assignments for delete to authenticated
  using (user_id = auth.uid() or public.is_admin());

drop policy if exists assignments_admin_update on public.shift_assignments;
create policy assignments_admin_update on public.shift_assignments for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- Capacity view is readable by signed-in users only.
revoke all on public.shift_capacity from anon;
grant select on public.shift_capacity to authenticated;

-- ---------------------------------------------------------------------------
-- Realtime publication (postgres_changes for the admin attendance feed)
-- ---------------------------------------------------------------------------
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    begin
      alter publication supabase_realtime add table public.shift_assignments;
    exception when duplicate_object then null;
    end;
    begin
      alter publication supabase_realtime add table public.shifts;
    exception when duplicate_object then null;
    end;
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Seed: the three gala departments
-- ---------------------------------------------------------------------------
insert into public.departments (name, description)
select * from (values
  ('Prasadam & Kitchen',
   'Prepare, serve and clean up prasadam for guests and the kitchen team.'),
  ('Guest Welcoming & Ticketing',
   'Greet guests, check tickets and guide people to their seats.'),
  ('Stage & Logistics',
   'Stage crew, setup, teardown, parking and general event logistics.')
) as v(name, description)
where not exists (
  select 1 from public.departments d where d.name = v.name
);

-- ---------------------------------------------------------------------------
-- Making an admin (run manually, after that person has signed in once):
--   update public.profiles set role = 'admin' where email = 'you@example.com';
-- ---------------------------------------------------------------------------
