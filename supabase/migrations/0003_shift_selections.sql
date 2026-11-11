-- Shifts a volunteer has picked but not yet submitted. Stored in the database so the
-- selection follows the volunteer to any device. Each volunteer can only see and change their own rows.
create table if not exists public.shift_selections (
  user_id      uuid not null references public.profiles(id) on delete cascade,
  shift_id     uuid not null references public.shifts(id) on delete cascade,
  selected_at  timestamptz not null default now(),
  primary key (user_id, shift_id)
);

alter table public.shift_selections enable row level security;

drop policy if exists selections_own on public.shift_selections;
create policy selections_own on public.shift_selections
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
