import { Suspense } from "react";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { AmbientBackground } from "@/components/layout/ambient-background";
import { PageSkeleton } from "@/components/layout/page-skeleton";
import { DashboardClient } from "@/components/dashboard/dashboard-client";
import type { Assignment, Department, Profile, Shift, ShiftCapacity } from "@/lib/types";

export const metadata = { title: "Volunteer Dashboard" };

// Per-user data is loaded inside Suspense so the shell can render instantly.
export default function DashboardPage() {
  return (
    <div className="relative min-h-dvh">
      <AmbientBackground />
      <Suspense fallback={<PageSkeleton />}>
        <DashboardContent />
      </Suspense>
    </div>
  );
}

async function DashboardContent() {
  // Per-user, time-sensitive data: render at request time, never prerender.
  await connection();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/dashboard");

  const [profileRes, deptRes, shiftRes, capacityRes, assignmentRes, selectionRes] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user.id).single(),
    supabase.from("departments").select("*").order("name"),
    supabase.from("shifts").select("*").order("start_time"),
    supabase.from("shift_capacity").select("*"),
    supabase.from("shift_assignments").select("*").eq("user_id", user.id),
    supabase.from("shift_selections").select("shift_id").eq("user_id", user.id),
  ]);

  let profile = profileRes.data as Profile | null;
  if (!profile) {
    // Signed in, but no profile row yet: create it, then try again.
    // If the migration (0004) has not been run, this call fails and we fall through to sign-out.
    const ensured = await supabase.rpc("ensure_my_profile");
    if (ensured.error) console.error("[dashboard] ensure_my_profile failed:", ensured.error);
    const retry = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
    if (retry.error) console.error("[dashboard] profile retry failed:", retry.error);
    profile = retry.data as Profile | null;
    if (!profile) console.error("[dashboard] no profile for user", user.id, user.email);
  }
  if (!profile) {
    // Still no profile: sign this browser out automatically and clear its session cookies.
    redirect("/auth/reset?reason=profile");
  }

  const assignments = (assignmentRes.data ?? []) as Assignment[];

  return (
    <>
      <DashboardClient
        isAdmin={profile.role === "admin"}
        profile={profile}
        departments={(deptRes.data ?? []) as Department[]}
        shifts={(shiftRes.data ?? []) as Shift[]}
        capacity={(capacityRes.data ?? []) as ShiftCapacity[]}
        assignedShiftIds={assignments.map((a) => a.shift_id)}
        draftShiftIds={((selectionRes.data ?? []) as { shift_id: string }[]).map((s) => s.shift_id)}
      />
    </>
  );
}
