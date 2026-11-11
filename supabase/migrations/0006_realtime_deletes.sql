-- ============================================================================
-- 0006: live cancellations
-- Realtime only sends the primary key of a DELETED row, so the per-user filter
-- (user_id=eq.<id>) drops every delete and cancellations never reach the
-- volunteer's other devices. REPLICA IDENTITY FULL makes deletes carry the full
-- row, so the filter can match them. Safe to run more than once.
-- ============================================================================
alter table public.shift_selections replica identity full;
alter table public.shift_assignments replica identity full;
