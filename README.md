# ISKCON 60 Gala Volunteer Dashboard

Volunteer shift signup for the ISKCON Toronto 60th Anniversary Gala — **Saturday, November 14, 2026**.

- Passwordless sign-in with a **6-digit email code** (Supabase Auth). Works on any device.
- Volunteers: browse shifts by department, book/cancel, see a live capacity counter, view expectations
- Admins (`/admin`): live attendance feed, KPIs, shift and department CRUD, filters and CSV export
- Database enforces capacity, time-overlap and race-safety (not just the UI)

Stack: Next.js 16 (App Router, TypeScript), Tailwind CSS v4, Framer Motion, Lucide, Radix Dialog, Sonner toasts, Supabase (Postgres, RLS, Realtime, Auth).

## 1. Create the Supabase project

1. Create a project at https://supabase.com.
2. **SQL Editor → New query**: run these migrations **in order**, each in its own query:
   1. [`supabase/migrations/0001_init.sql`](supabase/migrations/0001_init.sql): tables, RLS policies, booking rules, realtime wiring, the `shift_capacity` view and the three department seeds.
   2. [`supabase/migrations/0002_shift_description.sql`](supabase/migrations/0002_shift_description.sql): shift descriptions. Admins cannot create shifts without it.
   3. [`supabase/migrations/0003_shift_selections.sql`](supabase/migrations/0003_shift_selections.sql): saved shift selections. Volunteers cannot select shifts without it.
   4. [`supabase/migrations/0004_profile_recovery.sql`](supabase/migrations/0004_profile_recovery.sql): creates missing volunteer profiles.
   5. [`supabase/migrations/0005_live_selections.sql`](supabase/migrations/0005_live_selections.sql): live sync of selections across devices.
3. **Authentication → URL Configuration**
   - *Site URL*: `http://localhost:3000` (later: your production URL)
   - *Redirect URLs*: add `http://localhost:3000/auth/callback` and `https://YOUR-DOMAIN/auth/callback`
4. **Authentication → Email Templates → Magic Link**: paste in the contents of [`supabase/email-templates/magic-link.html`](supabase/email-templates/magic-link.html). It must contain `{{ .Token }}` (the 6-digit code that volunteers type on the sign-in page). Replace `{{SITE_URL}}` in the logo `src` with your production domain. Supabase does not fill that in.
5. **Authentication → Providers → Email**: keep *Email* enabled. Under the OTP settings, leave the code length at **6** and set *OTP expiry* to **900** seconds (15 minutes) so codes don't sit around for an hour.
6. **Authentication → Rate limits / SMTP**: the built-in email sender is heavily rate-limited. For event sign-ups, configure custom SMTP (Authentication → SMTP Settings) before you share the link. Then check *Rate limits → Sign-ins / OTPs* so a few hundred volunteers can each request a code.
7. **Test on your phone**: request a code on the production URL from a phone on mobile data, and sign in with it. Do this before you share the link.

## 2. Configure and run locally

```bash
npm install
cp .env.local.example .env.local   # then fill in your project URL and anon/publishable key
npm run dev
```

Open http://localhost:3000, enter your email, and follow the magic link.

## 3. Make yourself an admin

Sign in once so your profile exists, then run in the SQL Editor:

```sql
update public.profiles set role = 'admin' where email = 'you@example.com';
```

Admins can then open `/admin`. Role changes are blocked for everyone else by a database trigger.

## How the guarantees work

| Requirement | Where it is enforced |
|---|---|
| Max volunteers per shift | `enforce_shift_booking_rules()` trigger on `shift_assignments` (runs for every insert, including the `book_shift` RPC) |
| No time clashes: `(StartA < EndB) AND (EndA > StartB)` | Same trigger; the UI also checks locally and shows the explicit toast |
| Two people, last slot | Transaction advisory locks per shift and per user, so one insert waits, then fails with `SLOT_FULL` → "Slot just filled up!" |
| Live counter | `shift_capacity` view (counts only) re-read on a Realtime broadcast fired by the trigger, so volunteers see live counts without seeing other people's rows |
| Admin attendance feed | `postgres_changes` on `shift_assignments` (admins can read all rows) |
| Volunteers can't see each other | RLS: volunteers only read/insert/delete their own assignments |
| Only admins change roles | `protect_profile_fields()` trigger |

## Project layout

```
supabase/migrations/0001_init.sql   schema, RLS, triggers, RPCs, seeds
src/proxy.ts                        session refresh + protects /dashboard and /admin
src/app/login                       magic-link sign-in
src/app/auth/callback               magic-link landing → deep link (?next=)
src/app/dashboard                   volunteer portal (my schedule, available shifts, guidelines)
src/app/admin                       admin portal (live overview, CRUD, export)
src/lib/shifts.ts                   time formatting, Toronto timezone conversion, clash detection
src/hooks/use-live-capacity.ts      live remaining-slots hook
```

## Deploying

Deploy to Vercel (or any Node host) and set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`. Add the production `/auth/callback` URL to Supabase's redirect list.

## Notes

- Times are entered and shown in **America/Toronto** time.
- The Volunteer Expectations text is a draft. Replace it with ISKCON Toronto's official guidelines before publishing.
- The `profiles` table still has `emergency_contact_name` and `emergency_contact_phone` columns from the first migration, but the app no longer collects or shows them.
