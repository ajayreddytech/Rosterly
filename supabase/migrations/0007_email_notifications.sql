-- ============================================================================
-- 0007: email notifications (outbox + triggers + reminder schedule)
--
-- Every outgoing email is a row in email_outbox. A cron job (see
-- supabase/setup/email-cron.sql) calls /api/cron/emails every minute, which
-- sends the pending rows through SendGrid.
--
--   signup_incomplete  sent by the admin button to volunteers with no shift
--   booking_confirmed  queued automatically when a shift is booked
--   booking_cancelled  queued automatically when a booking is removed (cancel or swap)
--   reminder           queued by enqueue_due_reminders() on the schedule below
--
-- Reminder schedule (Toronto time, by shift start):
--   starts before 12:00 -> previous day at 16:00
--   starts at 12:00 or later -> same day at 08:00
--
-- Safe to run more than once.
-- ============================================================================

create table if not exists public.email_outbox (
  id                  uuid primary key default gen_random_uuid(),
  kind                text not null check (kind in ('signup_incomplete', 'booking_confirmed', 'booking_cancelled', 'reminder')),
  -- No foreign keys on purpose: a cancellation email must still be storable
  -- while the rows it refers to are being deleted.
  user_id             uuid not null,
  shift_id            uuid,
  send_at             timestamptz not null default now(),
  payload             jsonb not null default '{}'::jsonb,
  status              text not null default 'pending' check (status in ('pending', 'sending', 'sent', 'failed')),
  attempts            int not null default 0,
  last_error          text,
  provider_message_id text,
  created_at          timestamptz not null default now(),
  sent_at             timestamptz
);

create index if not exists email_outbox_due_idx on public.email_outbox (status, send_at);
create index if not exists email_outbox_kind_idx on public.email_outbox (kind, status);

-- A volunteer gets at most one reminder per shift, and one sign-up nudge in total.
create unique index if not exists email_outbox_reminder_key
  on public.email_outbox (user_id, shift_id) where kind = 'reminder';
create unique index if not exists email_outbox_signup_key
  on public.email_outbox (user_id) where kind = 'signup_incomplete';

alter table public.email_outbox enable row level security;

drop policy if exists email_outbox_admin_read on public.email_outbox;
create policy email_outbox_admin_read on public.email_outbox for select to authenticated
  using (public.is_admin());

revoke all on public.email_outbox from anon;
grant select on public.email_outbox to authenticated;

-- ---------------------------------------------------------------------------
-- Booking triggers: confirmation on insert, cancellation on delete.
-- A swap is a booking followed by a cancellation, so it produces both emails.
-- The details are copied into payload at queue time, so the email still
-- reads correctly after the shift or profile changes.
-- ---------------------------------------------------------------------------
create or replace function public.queue_booking_confirmed()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.email_outbox (kind, user_id, shift_id, payload)
  select 'booking_confirmed', p.id, s.id,
         jsonb_build_object(
           'full_name', p.full_name, 'email', p.email,
           'title', s.title, 'department', d.name,
           'start_time', s.start_time, 'end_time', s.end_time)
  from public.profiles p
  join public.shifts s on s.id = new.shift_id
  join public.departments d on d.id = s.department_id
  where p.id = new.user_id;
  return null;
end;
$$;

create or replace function public.queue_booking_cancelled()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.email_outbox (kind, user_id, shift_id, payload)
  select 'booking_cancelled', p.id, s.id,
         jsonb_build_object(
           'full_name', p.full_name, 'email', p.email,
           'title', s.title, 'department', d.name,
           'start_time', s.start_time, 'end_time', s.end_time)
  from public.profiles p
  join public.shifts s on s.id = old.shift_id
  join public.departments d on d.id = s.department_id
  where p.id = old.user_id;
  return null;
end;
$$;

drop trigger if exists trg_queue_booking_confirmed on public.shift_assignments;
create trigger trg_queue_booking_confirmed
  after insert on public.shift_assignments
  for each row execute function public.queue_booking_confirmed();

drop trigger if exists trg_queue_booking_cancelled on public.shift_assignments;
create trigger trg_queue_booking_cancelled
  after delete on public.shift_assignments
  for each row execute function public.queue_booking_cancelled();

-- ---------------------------------------------------------------------------
-- Reminder schedule
-- ---------------------------------------------------------------------------
create or replace function public.reminder_send_at(p_start timestamptz)
returns timestamptz
language plpgsql
stable
as $$
declare
  v_local timestamp := p_start at time zone 'America/Toronto';
begin
  if extract(hour from v_local) < 12 then
    -- Morning shift: previous day, 4:00 PM
    return ((v_local::date - 1) + time '16:00') at time zone 'America/Toronto';
  end if;
  -- Afternoon or evening shift: same day, 8:00 AM
  return (v_local::date + time '08:00') at time zone 'America/Toronto';
end;
$$;

-- Queues a reminder for every current booking whose send time has arrived.
-- Re-running is harmless: the unique key stops duplicates. Bookings and swaps
-- made later are picked up on the next run.
create or replace function public.enqueue_due_reminders()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count int;
begin
  insert into public.email_outbox (kind, user_id, shift_id, send_at, payload)
  select 'reminder', a.user_id, s.id, public.reminder_send_at(s.start_time),
         jsonb_build_object(
           'full_name', p.full_name, 'email', p.email,
           'title', s.title, 'department', d.name,
           'start_time', s.start_time, 'end_time', s.end_time)
  from public.shift_assignments a
  join public.shifts s on s.id = a.shift_id
  join public.departments d on d.id = s.department_id
  join public.profiles p on p.id = a.user_id
  where p.role = 'volunteer'
    and s.start_time > now()
    and public.reminder_send_at(s.start_time) <= now()
  on conflict (user_id, shift_id) where kind = 'reminder' do nothing;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- Live updates for the admin email panel.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    begin
      alter publication supabase_realtime add table public.email_outbox;
    exception when duplicate_object then
      null;
    end;
  end if;
end $$;
