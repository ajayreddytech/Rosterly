-- ============================================================================
-- Email scheduler setup. Run this ONCE in the Supabase SQL editor, AFTER
-- migration 0007_email_notifications.sql and after enabling the pg_cron and
-- pg_net extensions (Database -> Extensions).
--
-- Replace the two placeholders before running:
--   <SITE_URL>     your live site, e.g. https://your-site.netlify.app   (no trailing slash)
--   <CRON_SECRET>  the same long random value you set as CRON_SECRET in Netlify
--
-- This file is NOT a migration: it contains a secret, so do not add it to git
-- with the real value filled in.
-- ============================================================================

-- Every minute: queue any reminders that are due, then send the pending emails.
select cron.schedule(
  'gala-emails',
  '* * * * *',
  $$
  select net.http_post(
    url     := '<SITE_URL>/api/cron/emails',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', '<CRON_SECRET>'),
    body    := '{}'::jsonb
  );
  $$
);

-- To stop it later:   select cron.unschedule('gala-emails');
-- To see recent runs: select * from cron.job_run_details order by start_time desc limit 20;
