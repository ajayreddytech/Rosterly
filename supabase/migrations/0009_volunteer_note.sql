-- ============================================================================
-- 0009: volunteer note
-- Free-text note on each volunteer, used for arrival/departure preferences
-- (for example "4 PM to 8 PM"). Visible to the volunteer and to admins through
-- the existing profiles policies.
-- Safe to run more than once.
-- ============================================================================

alter table public.profiles add column if not exists note text;
