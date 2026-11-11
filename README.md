# Iskcon 60 Gala volunteer Shift Signup

Volunteer shift signup for the ISKCON Toronto 60th Anniversary Gala — **Saturday, November 14, 2026**.

- Passwordless **magic-link** sign-in (Supabase Auth)
- Volunteers: browse shifts by department, book/cancel, see a live capacity counter, view expectations and a digital **Red Ticket** pass
- Admins (`/admin`): live attendance feed, KPIs, shift and department CRUD, filters and CSV export
- Database enforces capacity, time-overlap and race-safety (not just the UI)

Stack: Next.js 16 (App Router, TypeScript), Tailwind CSS v4, Framer Motion, Lucide, Radix Dialog, Sonner toasts, Supabase (Postgres, RLS, Realtime, Auth).

## 1. Create the Supabase project

1. Create a project at https://supabase.com.
2. **SQL Editor → New query**: paste the contents of [`supabase/migrations/0001_init.sql`](supabase/migrations/0001_init.sql) and run it. This creates the tables, RLS policies, booking rules, realtime wiring, the `shift_capacity` view and the three department seeds.
3. **Authentication → URL Configuration**
   - *Site URL*: `http://localhost:3000` (later: your production URL)
   - *Redirect URLs*: add `http://localhost:3000/auth/callback` and `https://YOUR-DOMAIN/auth/callback`
4. **Authentication → Email Templates → Magic Link**: make sure the body contains `{{ .ConfirmationURL }}`.
5. **Authentication → Rate limits / SMTP**: the built-in email sender is heavily rate-limited. For event sign-ups, configure custom SMTP (Authentication → SMTP Settings).

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
src/app/dashboard                   volunteer portal (catalog, schedule, expectations, red ticket)
src/app/admin                       admin portal (live overview, CRUD, export)
src/lib/shifts.ts                   time formatting, Toronto timezone conversion, clash detection
src/hooks/use-live-capacity.ts      live remaining-slots hook
```

## Deploying

Deploy to Vercel (or any Node host) and set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`. Add the production `/auth/callback` URL to Supabase's redirect list.

## Notes

- Times are entered and shown in **America/Toronto** time.
- The Volunteer Expectations text is a draft. Replace it with ISKCON Toronto's official guidelines before publishing.
- Emergency contact fields are an addition to the spec's `profiles` table (`emergency_contact_name`, `emergency_contact_phone`), needed for the Red Ticket.
