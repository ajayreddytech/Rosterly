-- ============================================================================
-- 0004: profile recovery
-- Some signed-in accounts have no public.profiles row (for example accounts
-- created before the signup trigger existed). This migration:
--   1. backfills a profile for every auth user that lacks one, and
--   2. adds ensure_my_profile(), which the dashboard calls for the signed-in
--      user so a missing profile is created automatically.
-- Safe to run more than once.
-- ============================================================================

-- 1. Backfill existing auth users.
insert into public.profiles (id, email, full_name, phone)
select
  u.id,
  lower(u.email),
  coalesce(u.raw_user_meta_data ->> 'full_name', ''),
  u.raw_user_meta_data ->> 'phone'
from auth.users u
where not exists (select 1 from public.profiles p where p.id = u.id)
on conflict do nothing;

-- 2. Create the signed-in user's profile if it is missing.
create or replace function public.ensure_my_profile()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'NOT_AUTHENTICATED' using errcode = '42501';
  end if;

  insert into public.profiles (id, email, full_name, phone)
  select
    u.id,
    lower(u.email),
    coalesce(u.raw_user_meta_data ->> 'full_name', ''),
    u.raw_user_meta_data ->> 'phone'
  from auth.users u
  where u.id = auth.uid()
  on conflict do nothing;
end;
$$;

revoke all on function public.ensure_my_profile() from public, anon;
grant execute on function public.ensure_my_profile() to authenticated;
