-- Adds a volunteer-facing description to each shift (shown in Available Shifts and My Schedule).
alter table public.shifts add column if not exists description text;
