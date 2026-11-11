"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Loader2, Send } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { useLiveCapacity } from "@/hooks/use-live-capacity";
import { friendlyBookingError } from "@/lib/booking-errors";
import { cn } from "@/lib/utils";
import { findConflict, timeConflictMessage } from "@/lib/shifts";
import type { Department, Profile, Shift, ShiftCapacity } from "@/lib/types";
import { AppHeader } from "@/components/layout/app-header";
import { ProfileBar } from "./profile-bar";
import { SideNav, type TabId } from "./side-nav";
import { ShiftCatalog } from "./shift-catalog";
import { MySchedule } from "./my-schedule";
import { Expectations } from "./expectations";
import { VenueCard } from "./venue-card";
import { EmergencyCancelDialog } from "./emergency-cancel-dialog";
import { ProfileDialog } from "./profile-dialog";

interface Props {
  isAdmin: boolean;
  profile: Profile;
  departments: Department[];
  shifts: Shift[];
  capacity: ShiftCapacity[];
  assignedShiftIds: string[];
  draftShiftIds: string[];
}

export function DashboardClient({
  isAdmin,
  profile: initialProfile,
  departments,
  shifts,
  capacity,
  assignedShiftIds,
  draftShiftIds,
}: Props) {
  const [profile, setProfile] = useState(initialProfile);
  const [tab, setTab] = useState<TabId>("schedule");
  /** Shifts the volunteer is confirmed in. */
  const [mySet, setMySet] = useState<Set<string>>(() => new Set(assignedShiftIds));
  /** Shifts selected in Available Shifts but not yet submitted. Saved in the database. */
  const [draft, setDraft] = useState<Set<string>>(() => new Set(draftShiftIds));
  const [busy, setBusy] = useState(false);
  const [cancelTarget, setCancelTarget] = useState<Shift | null>(null);
  /** The confirmed shift being replaced. Set by "Switch shift"; released when the new selection is submitted. */
  const [switchFrom, setSwitchFrom] = useState<Shift | null>(null);

  // Every section opens from its beginning, not from wherever the previous one was scrolled to.
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "auto" });
  }, [tab]);
  const [profileOpen, setProfileOpen] = useState(
    !initialProfile.full_name.trim() || !initialProfile.phone?.trim(),
  );

  /** Shifts and teams, kept current when admins change them. */
  const [shiftList, setShiftList] = useState<Shift[]>(shifts);
  const [deptList, setDeptList] = useState<Department[]>(departments);

  const reloadStructure = useCallback(async () => {
    const supabase = createClient();
    const [d, s] = await Promise.all([
      supabase.from("departments").select("*").order("name"),
      supabase.from("shifts").select("*").order("start_time"),
    ]);
    if (!d.error && d.data) setDeptList(d.data as Department[]);
    if (!s.error && s.data) setShiftList(s.data as Shift[]);
  }, []);

  const { capacity: capacityMap, refresh } = useLiveCapacity(capacity, reloadStructure);

  // Keep this volunteer's selections and bookings in step across all their devices.
  useEffect(() => {
    const supabase = createClient();
    async function reloadMine() {
      const [sel, asg] = await Promise.all([
        supabase.from("shift_selections").select("shift_id").eq("user_id", profile.id),
        supabase.from("shift_assignments").select("shift_id").eq("user_id", profile.id),
      ]);
      if (!sel.error && sel.data) setDraft(new Set(sel.data.map((r) => r.shift_id as string)));
      if (!asg.error && asg.data) setMySet(new Set(asg.data.map((r) => r.shift_id as string)));
    }
    const channel = supabase
      .channel(`my-shifts-${profile.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "shift_selections", filter: `user_id=eq.${profile.id}` },
        () => void reloadMine(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "shift_assignments", filter: `user_id=eq.${profile.id}` },
        () => void reloadMine(),
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [profile.id]);

  const bookedShifts = useMemo(() => shiftList.filter((s) => mySet.has(s.id)), [shiftList, mySet]);
  const draftShifts = useMemo(() => shiftList.filter((s) => draft.has(s.id)), [shiftList, draft]);

  /** A shift clashes if it overlaps anything confirmed or selected (the shift itself is ignored). */
  function conflictFor(shift: Shift) {
    // Includes the shift being switched away from, so an overlapping switch is blocked here,
    // not rejected by the database on Submit.
    return findConflict(shift, [...bookedShifts, ...draftShifts]);
  }

  /** Selects or deselects a shift. The change is saved to the database straight away. */
  async function toggleDraft(shift: Shift) {
    const supabase = createClient();
    const removing = draft.has(shift.id);

    if (!removing) {
      const conflict = conflictFor(shift);
      if (conflict) {
        toast.error(timeConflictMessage(conflict));
        return;
      }
    }

    const setMembership = (on: boolean) =>
      setDraft((prev) => {
        const next = new Set(prev);
        if (on) next.add(shift.id);
        else next.delete(shift.id);
        return next;
      });

    setMembership(!removing);
    // Upsert with ignoreDuplicates: a leftover row for this shift must not block a fresh selection.
    const { error } = removing
      ? await supabase.from("shift_selections").delete().eq("user_id", profile.id).eq("shift_id", shift.id)
      : await supabase
          .from("shift_selections")
          .upsert({ user_id: profile.id, shift_id: shift.id }, { onConflict: "user_id,shift_id", ignoreDuplicates: true });

    if (error) {
      console.error("shift_selections write failed", error);
      setMembership(removing);
      toast.error("Could not update your selection. Please try again.", { description: error.message });
    } else if (!removing) {
      toast.success("Shift selected", {
        description: "Not submitted yet. Press Submit to confirm your shift.",
        duration: 6000,
      });
    }
  }

  /** Removes every unsubmitted selection, here and in the database. */
  async function clearDraft() {
    const previous = draft;
    setDraft(new Set());
    const { error } = await createClient().from("shift_selections").delete().eq("user_id", profile.id);
    if (error) {
      setDraft(previous);
      toast.error("Could not clear your selection. Please try again.");
    }
  }

  /** Books every selected shift in one go, then clears the saved selection. */
  async function submitDraft() {
    if (draftShifts.length === 0) return;
    setBusy(true);
    const supabase = createClient();
    const okIds: string[] = [];
    const problems: string[] = [];

    for (const shift of draftShifts) {
      const { error } = await supabase.rpc("book_shift", { p_shift_id: shift.id });
      if (error) problems.push(`${shift.title}: ${friendlyBookingError(error.message)}`);
      else okIds.push(shift.id);
    }

    // A switch releases the old shift, but only once at least one new booking has gone through.
    let released = false;
    if (switchFrom && okIds.length > 0 && mySet.has(switchFrom.id)) {
      const { error: releaseError } = await supabase.rpc("cancel_shift", { p_shift_id: switchFrom.id });
      if (releaseError) {
        problems.push(`${switchFrom.title}: could not be released. ${friendlyBookingError(releaseError.message)}`);
      } else {
        released = true;
      }
    }

    // Clear the saved selection for every shift that was booked (or attempted), not just the ones that
    // succeeded, so nothing stale is left behind to block the next selection.
    const { error: clearError } = await supabase
      .from("shift_selections")
      .delete()
      .eq("user_id", profile.id);
    if (clearError) console.error("Clearing submitted selections failed", clearError);

    setBusy(false);
    setMySet((prev) => {
      const next = new Set([...prev, ...okIds]);
      if (released && switchFrom) next.delete(switchFrom.id);
      return next;
    });
    setDraft(new Set());
    if (okIds.length > 0) setSwitchFrom(null);
    void refresh();
    if (clearError) toast.error("Your selection could not be fully cleared.", { description: clearError.message });

    if (okIds.length > 0) {
      toast.success(
        released && switchFrom
          ? `Switched! ${switchFrom.title} has been released.`
          : `Submitted! You're booked for ${okIds.length} shift${okIds.length === 1 ? "" : "s"}.`,
      );
    }
    problems.forEach((p) => toast.error(p));
  }

  /** Confirmed cancellation, reached only through the emergency dialog. */
  async function confirmCancel(shift: Shift) {
    setBusy(true);
    const supabase = createClient();
    const { error } = await supabase.rpc("cancel_shift", { p_shift_id: shift.id });
    setBusy(false);
    setCancelTarget(null);

    if (error) {
      toast.error(friendlyBookingError(error.message));
      return;
    }
    setMySet((prev) => {
      const next = new Set(prev);
      next.delete(shift.id);
      return next;
    });
    toast(`Cancelled: ${shift.title}`);
    void refresh();
  }

  return (
    <>
      <AppHeader
        isAdmin={isAdmin}
        title="Celebrating 60 Years of ISKCON"
        onEditProfile={() => setProfileOpen(true)}
      />

      {/* Extra bottom space while the Submit bar is showing, so the last card can scroll clear of it. */}
      <main
        className={cn(
          "relative mx-auto w-full max-w-6xl px-4 pt-6 sm:px-6 md:pl-24",
          draftShifts.length > 0 ? "pb-60 md:pb-44" : "pb-32 md:pb-16",
        )}
      >
        <SideNav tab={tab} onChange={setTab} selectedCount={draftShifts.length} />

        <ProfileBar profile={profile} bookedCount={bookedShifts.length} />

        <div className="mt-6">
          <VenueCard />
        </div>

        <div className="mt-6">
          <AnimatePresence mode="wait">
            <motion.section
              key={tab}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.22 }}
            >
              {tab === "schedule" && (
                <MySchedule
                  shifts={bookedShifts}
                  departments={deptList}
                  busy={busy}
                  onCancelRequest={setCancelTarget}
                  onBrowse={() => setTab("catalog")}
                  onSwitch={(shift) => {
                    setSwitchFrom(shift);
                    setTab("catalog");
                  }}
                />
              )}
              {tab === "catalog" && (
                <>
                {switchFrom && (
                  <div className="mb-6 flex flex-col gap-3 rounded-2xl border border-amber-300/40 bg-amber-500/10 p-4 text-sm text-amber-50 sm:flex-row sm:items-center sm:justify-between">
                    <p>
                      Switching from <span className="font-semibold">{switchFrom.title}</span>. Select your new shift
                      and press Submit. {switchFrom.title} will be released once the new shift is booked.
                    </p>
                    <Button variant="ghost" size="sm" onClick={() => setSwitchFrom(null)} disabled={busy}>
                      Stop switching
                    </Button>
                  </div>
                )}
                <ShiftCatalog
                  departments={deptList}
                  shifts={shiftList}
                  capacity={capacityMap}
                  bookedIds={mySet}
                  draftIds={draft}
                  conflictFor={conflictFor}
                  busy={busy}
                  onToggle={toggleDraft}
                  onCancelRequest={setCancelTarget}
                />
                </>
              )}
              {tab === "guidelines" && <Expectations />}
            </motion.section>
          </AnimatePresence>
        </div>
      </main>

      <AnimatePresence>
        {draftShifts.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 24 }}
            className="pointer-events-none fixed inset-x-0 bottom-24 z-40 flex justify-center px-4 md:bottom-4"
          >
            <div className="pointer-events-auto flex flex-wrap items-center justify-center gap-3 rounded-2xl border border-amber-300/30 bg-indigo-950/90 px-4 py-3 shadow-2xl shadow-black/50 backdrop-blur-xl">
              <p className="text-sm text-amber-50">
                <span className="font-bold">{draftShifts.length}</span> selected
                <span className="block text-xs text-amber-200">Not submitted yet. Press Submit to confirm.</span>
              </p>
              <Button variant="ghost" size="sm" onClick={clearDraft} disabled={busy}>
                Clear
              </Button>
              <Button onClick={submitDraft} disabled={busy}>
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                Submit
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <EmergencyCancelDialog
        shift={cancelTarget}
        busy={busy}
        onConfirm={confirmCancel}
        onClose={() => setCancelTarget(null)}
      />

      <ProfileDialog
        open={profileOpen}
        profile={profile}
        required={!profile.full_name.trim() || !profile.phone?.trim()}
        onOpenChange={setProfileOpen}
        onSaved={(updated) => {
          setProfile(updated);
          setProfileOpen(false);
          toast.success("Profile saved");
        }}
      />
    </>
  );
}
