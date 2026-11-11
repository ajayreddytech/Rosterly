-- ============================================================================
-- 0005: live selections
-- Publishes shift_selections to Supabase Realtime so a volunteer's selections
-- appear on all their devices without a refresh. RLS still applies: each
-- volunteer only receives changes to their own rows.
-- Safe to run more than once.
-- ============================================================================
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    begin
      alter publication supabase_realtime add table public.shift_selections;
    exception when duplicate_object then null;
    end;
  end if;
end;
$$;
