"use client";

import { motion, AnimatePresence } from "framer-motion";
import { AlertTriangle, CheckCircle2, Clock, Loader2, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge, GlassCard } from "@/components/ui/glass-card";
import { findConflict, formatDay, formatDuration, formatRange12 } from "@/lib/shifts";
import type { CapacityMap, Department, Shift } from "@/lib/types";
import { cn } from "@/lib/utils";

interface CatalogProps {
  departments: Department[];
  shifts: Shift[];
  capacity: CapacityMap;
  bookedIds: Set<string>;
  bookedShifts: Shift[];
  pendingId: string | null;
  onBook: (shift: Shift) => void;
  onCancel: (shift: Shift) => void;
}

export function ShiftCatalog(props: CatalogProps) {
  const { departments, shifts, capacity, bookedIds, bookedShifts, pendingId, onBook, onCancel } = props;

  if (departments.length === 0) {
    return <EmptyState text="No departments have been set up yet. Check back soon." />;
  }

  return (
    <div className="space-y-10">
      {departments.map((dept, deptIndex) => {
        const deptShifts = shifts.filter((s) => s.department_id === dept.id);
        return (
          <motion.div
            key={dept.id}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: deptIndex * 0.08, duration: 0.4 }}
          >
            <div className="mb-4 flex flex-col gap-1 border-l-2 border-amber-400/70 pl-4">
              <h2 className="text-lg font-semibold text-amber-100 sm:text-xl">{dept.name}</h2>
              {dept.description && <p className="text-sm text-slate-400">{dept.description}</p>}
            </div>

            {deptShifts.length === 0 ? (
              <EmptyState text="No shifts posted for this team yet." compact />
            ) : (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                <AnimatePresence initial={false}>
                  {deptShifts.map((shift) => {
                    const cap = capacity[shift.id];
                    const remaining = cap?.remaining_slots ?? shift.max_volunteers;
                    const booked = bookedIds.has(shift.id);
                    const conflict = booked ? undefined : findConflict(shift, bookedShifts);
                    return (
                      <ShiftCard
                        key={shift.id}
                        shift={shift}
                        maxVolunteers={shift.max_volunteers}
                        remaining={remaining}
                        booked={booked}
                        conflictWith={conflict}
                        pending={pendingId === shift.id}
                        onBook={() => onBook(shift)}
                        onCancel={() => onCancel(shift)}
                      />
                    );
                  })}
                </AnimatePresence>
              </div>
            )}
          </motion.div>
        );
      })}
    </div>
  );
}

interface ShiftCardProps {
  shift: Shift;
  maxVolunteers: number;
  remaining: number;
  booked: boolean;
  conflictWith?: Shift;
  pending: boolean;
  onBook: () => void;
  onCancel: () => void;
}

export function ShiftCard({
  shift,
  maxVolunteers,
  remaining,
  booked,
  conflictWith,
  pending,
  onBook,
  onCancel,
}: ShiftCardProps) {
  const full = remaining <= 0 && !booked;
  const lowStock = !booked && remaining > 0 && remaining < 2;
  const filledPct = Math.min(100, Math.round(((maxVolunteers - remaining) / maxVolunteers) * 100));

  return (
    <motion.article
      layout
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.97 }}
      transition={{ duration: 0.25 }}
      className={cn(
        "group relative flex flex-col gap-4 overflow-hidden rounded-2xl border bg-slate-900/60 p-5 backdrop-blur-md transition-colors",
        booked
          ? "border-emerald-400/40 shadow-lg shadow-emerald-900/20"
          : "border-amber-500/10 hover:border-amber-400/30",
        full && "opacity-75",
      )}
    >
      {booked && (
        <div className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-emerald-400 to-teal-300" />
      )}

      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate text-base font-semibold text-white">{shift.title}</h3>
          <p className="mt-1 flex items-center gap-1.5 text-sm text-slate-400">
            <Clock className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">
              {formatDay(shift.start_time)} · {formatRange12(shift.start_time, shift.end_time)}
            </span>
          </p>
        </div>
        <Badge tone="violet" className="shrink-0">
          {formatDuration(shift.start_time, shift.end_time)}
        </Badge>
      </div>

      {/* Remaining slots counter */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm text-slate-300">
          <Users className="h-4 w-4 text-amber-300" />
          <span className="inline-flex items-baseline gap-1.5">
            <AnimatePresence mode="popLayout" initial={false}>
              <motion.span
                key={remaining}
                initial={{ y: -10, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: 10, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="inline-block font-bold tabular-nums text-amber-200"
              >
                {Math.max(remaining, 0)}
              </motion.span>
            </AnimatePresence>
            <span>of {maxVolunteers} slots left</span>
          </span>
        </div>

        {booked ? (
          <Badge tone="emerald">
            <CheckCircle2 className="h-3.5 w-3.5" /> You’re in
          </Badge>
        ) : full ? (
          <Badge tone="rose">Full</Badge>
        ) : lowStock ? (
          <Badge tone="amber" pulse>
            Almost full
          </Badge>
        ) : null}
      </div>

      <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/5" aria-hidden>
        <motion.div
          className="h-full rounded-full bg-gradient-to-r from-amber-400 to-orange-500"
          initial={false}
          animate={{ width: `${filledPct}%` }}
          transition={{ duration: 0.6, ease: "easeOut" }}
        />
      </div>

      {conflictWith && !booked && (
        <p className="flex items-start gap-2 rounded-lg border border-rose-500/25 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          Clashes with your shift “{conflictWith.title}”
        </p>
      )}

      <div className="mt-auto">
        {booked ? (
          <Button variant="danger" className="w-full" onClick={onCancel} disabled={pending}>
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Cancel Shift
          </Button>
        ) : (
          // Clashing shifts use aria-disabled (not disabled) so a click still
          // reaches the explicit "Time Conflict" toast in the booking handler.
          <Button
            className={cn("w-full", conflictWith && "opacity-50 cursor-not-allowed")}
            onClick={onBook}
            disabled={full || pending}
            aria-disabled={!!conflictWith}
            title={
              full
                ? "This shift is full"
                : conflictWith
                  ? `Time conflict with “${conflictWith.title}”`
                  : undefined
            }
          >
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {full ? "Shift Full" : conflictWith ? "Time Conflict" : "Select Shift"}
          </Button>
        )}
      </div>
    </motion.article>
  );
}

function EmptyState({ text, compact }: { text: string; compact?: boolean }) {
  return (
    <GlassCard className={cn("p-8 text-center text-sm text-slate-400", compact && "p-5")}>
      {text}
    </GlassCard>
  );
}
