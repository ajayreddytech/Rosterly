-- ============================================================================
-- 0008: switch to Brevo and one-email-per-volunteer reminders
--
-- Run AFTER 0007_email_notifications.sql. Safe to run more than once.
--
-- Email kinds after this migration:
--   booking_confirmed  queued automatically when a shift is booked (trigger)
--   booking_cancelled  queued automatically when a booking is removed (trigger)
--   reminder_morning   one email per volunteer with a shift before 12:00,
--                      sent today at 4:00 PM (the day before the shift)
--   reminder_later     one email per volunteer whose shifts all start at 12:00
--                      or later, sent at 7:00 AM on the day of the shift
--   reminder_event     volunteers with no shift at all, sent at 7:00 AM on the
--                      gala day (the approved event email)
--
-- The schedule itself is computed in TypeScript (src/lib/email/plan.ts), so the
-- old SQL reminder functions are removed here.
-- ============================================================================

-- Each reminder is unique per volunteer and group. dedupe_key holds that
-- identity, so the cron job can re-run every minute without double-sending.
alter table public.email_outbox add column if not exists dedupe_key text;

drop index if exists public.email_outbox_reminder_key;
drop index if exists public.email_outbox_signup_key;

create unique index if not exists email_outbox_dedupe_key
  on public.email_outbox (dedupe_key);

-- Move the old sign-up nudge onto the new event kind, so anyone already emailed
-- is not emailed again.
update public.email_outbox
   set kind = 'reminder_event',
       dedupe_key = 'reminder_event:' || user_id::text
 where kind = 'signup_incomplete';

-- Old per-shift reminders are replaced by per-volunteer reminders. They cannot
-- be converted to the new shape, so the rows are removed (this also clears any
-- sent history for them). The kind check below would reject them otherwise.
delete from public.email_outbox where kind = 'reminder';

alter table public.email_outbox drop constraint if exists email_outbox_kind_check;
alter table public.email_outbox add constraint email_outbox_kind_check
  check (kind in ('booking_confirmed', 'booking_cancelled', 'reminder_morning', 'reminder_later', 'reminder_event'));

drop function if exists public.enqueue_due_reminders();
drop function if exists public.reminder_send_at(timestamptz);
