"use client";

import { useMemo, useState, type ComponentType } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CalendarCheck2, IdCard, ScrollText, Store } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { useLiveCapacity } from "@/hooks/use-live-capacity";
import { friendlyBookingError } from "@/lib/booking-errors";
import { findConflict, timeConflictMessage } from "@/lib/shifts";
import { cn } from "@/lib/utils";
import type { Department, Profile, Shift, ShiftCapacity } from "@/lib/types";
import { ProfileBar } from "./profile-bar";
import { ShiftCatalog } from "./shift-catalog";
import { MySchedule } from "./my-schedule";
import { Expectations } from "./expectations";
import { RedTicket } from "./red-ticket";
import { ProfileDialog } from "./profile-dialog";

type TabId = "catalog" | "schedule" | "expectations" | "ticket";

const TABS: { id: TabId; label: string; icon: ComponentType<{ className?: string }> }[] = [
  { id: "catalog", label: "Shift Catalog", icon: Store },
  { id: "schedule", label: "My Schedule", icon: CalendarCheck2 },
  { id: "expectations", label: "Expectations", icon: ScrollText },
  { id: "ticket", label: "Red Ticket", icon: IdCard },
];

interface Props {
  profile: Profile;
  departments: Department[];
  shifts: Shift[];
  capacity: ShiftCapacity[];
  assignedShiftIds: string[];
}

export function DashboardClient({
  profile: initialProfile,
  departments,
  shifts,
  capacity,
  assignedShiftIds,
}: Props) {
  const [profile, setProfile] = useState(initialProfile);
  const [tab, setTab] = useState<TabId>("catalog");
  const [mySet, setMySet] = useState<Set<string>>(() => new Set(assignedShiftIds));
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [profileOpen, setProfileOpen] = useState(
    !initialProfile.full_name.trim() || !initialProfile.phone?.trim(),
  );

  const { capacity: capacityMap, refresh } = useLiveCapacity(capacity);

  const bookedShifts = useMemo(
    () => shifts.filter((s) => mySet.has(s.id)),
    [shifts, mySet],
  );

  async function bookShift(shift: Shift) {
    const conflict = findConflict(shift, bookedShifts);
    if (conflict) {
      toast.error(timeConflictMessage(conflict));
      return;
    }
    setPendingId(shift.id);
    const supabase = createClient();
    const { error } = await supabase.rpc("book_shift", { p_shift_id: shift.id });
    setPendingId(null);

    if (error) {
      toast.error(friendlyBookingError(error.message));
      void refresh();
      return;
    }
    setMySet((prev) => new Set(prev).add(shift.id));
    toast.success(`You're booked: ${shift.title}`);
    void refresh();
  }

  async function cancelShift(shift: Shift) {
    setPendingId(shift.id);
    const supabase = createClient();
    const { error } = await supabase.rpc("cancel_shift", { p_shift_id: shift.id });
    setPendingId(null);

    if (error) {
      toast.error(friendlyBookingError(error.message));
      return;
    }
    setMySet((prev) => {
      const next = new Set(prev);
      next.delete(shift.id);
      return next;
    });
    toast(`Removed: ${shift.title}`);
    void refresh();
  }

  return (
    <main className="relative mx-auto w-full max-w-7xl px-4 pb-16 pt-6 sm:px-6">
      <ProfileBar
        profile={profile}
        bookedCount={bookedShifts.length}
        onEdit={() => setProfileOpen(true)}
      />

      {/* Tabs: horizontally scrollable on phones, full width on desktop */}
      <nav
        aria-label="Volunteer sections"
        className="mt-6 -mx-4 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0 [scrollbar-width:none]"
      >
        <div className="inline-flex min-w-full gap-1 rounded-2xl border border-amber-500/10 bg-slate-900/60 p-1.5 backdrop-blur-md sm:min-w-0">
          {TABS.map((t) => {
            const active = tab === t.id;
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative flex flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-xl px-4 py-2.5 text-sm font-medium transition-colors cursor-pointer sm:flex-none",
                  active ? "text-slate-950" : "text-slate-400 hover:text-amber-100",
                )}
              >
                {active && (
                  <motion.span
                    layoutId="tab-pill"
                    className="absolute inset-0 rounded-xl bg-gradient-to-r from-amber-300 to-orange-500 shadow-lg shadow-amber-500/20"
                    transition={{ type: "spring", stiffness: 380, damping: 32 }}
                  />
                )}
                <Icon className="relative h-4 w-4" />
                <span className="relative">{t.label}</span>
              </button>
            );
          })}
        </div>
      </nav>

      <div className="mt-6">
        <AnimatePresence mode="wait">
          <motion.section
            key={tab}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.22 }}
          >
            {tab === "catalog" && (
              <ShiftCatalog
                departments={departments}
                shifts={shifts}
                capacity={capacityMap}
                bookedIds={mySet}
                bookedShifts={bookedShifts}
                pendingId={pendingId}
                onBook={bookShift}
                onCancel={cancelShift}
              />
            )}
            {tab === "schedule" && (
              <MySchedule
                shifts={bookedShifts}
                departments={departments}
                pendingId={pendingId}
                onCancel={cancelShift}
                onBrowse={() => setTab("catalog")}
              />
            )}
            {tab === "expectations" && <Expectations />}
            {tab === "ticket" && (
              <RedTicket
                profile={profile}
                shifts={bookedShifts}
                departments={departments}
                onEdit={() => setProfileOpen(true)}
              />
            )}
          </motion.section>
        </AnimatePresence>
      </div>

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
    </main>
  );
}
