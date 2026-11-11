import { Suspense } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AppHeader } from "@/components/layout/app-header";
import { AmbientBackground } from "@/components/layout/ambient-background";
import { PageSkeleton } from "@/components/layout/page-skeleton";
import { AdminDashboard } from "@/components/admin/admin-dashboard";
import type {
  AttendanceRow,
  Department,
  Profile,
  Shift,
  ShiftCapacity,
} from "@/lib/types";

export const metadata = { title: "Admin · ISKCON 60 Gala Volunteers" };

// Per-user data is loaded inside Suspense so the shell can render instantly.
export default function AdminPage() {
  return (
    <div className="relative min-h-dvh">
      <AmbientBackground />
      <Suspense fallback={<PageSkeleton />}>
        <AdminContent />
      </Suspense>
    </div>
  );
}

async function AdminContent() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/admin");

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  // Authorization: only admins may view this page. RLS enforces it again on every query.
  if (!profile || (profile as Profile).role !== "admin") redirect("/dashboard");

  const [deptRes, shiftRes, capacityRes, attendanceRes, volunteerCountRes] = await Promise.all([
    supabase.from("departments").select("*").order("name"),
    supabase.from("shifts").select("*").order("start_time"),
    supabase.from("shift_capacity").select("*"),
    supabase
      .from("shift_assignments")
      .select("id, shift_id, assigned_at, profiles(full_name, email, phone)")
      .order("assigned_at", { ascending: true }),
    supabase
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("role", "volunteer"),
  ]);

  return (
    <>
      <AppHeader isAdmin title="Admin · Gala Volunteer Control" />
      <main className="relative mx-auto w-full max-w-7xl px-4 pb-16 pt-6 sm:px-6">
        <AdminDashboard
          departments={(deptRes.data ?? []) as Department[]}
          shifts={(shiftRes.data ?? []) as Shift[]}
          capacity={(capacityRes.data ?? []) as ShiftCapacity[]}
          attendance={(attendanceRes.data ?? []) as unknown as AttendanceRow[]}
          volunteerCount={volunteerCountRes.count ?? 0}
        />
      </main>
    </>
  );
}
