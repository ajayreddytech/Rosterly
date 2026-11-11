"use client";

import { motion, AnimatePresence } from "framer-motion";
import { AlertTriangle, CalendarDays, CheckCircle2, Clock, Loader2, Users, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge, GlassCard } from "@/components/ui/glass-card";
import { formatDay, formatDuration, formatRange12 } from "@/lib/shifts";
import type { CapacityMap, Department, Shift } from "@/lib/types";
import { cn } from "@/lib/utils";

interface CatalogProps {
  departments: Department[];
  shifts: Shift[];
  capacity: CapacityMap;
  /** Shifts the volunteer is already booked into. */
  bookedIds: Set<string>;
  /** Shifts selected but not yet submitted. */
  draftIds: Set<string>;
  /** First already-booked or selected shift that clashes with the given shift, if any. */
  conflictFor: (shift: Shift) => Shift | undefined;
  busy: boolean;
  onToggle: (shift: Shift) => void;
  /** Opens the emergency-cancel confirmation for a confirmed shift. */
  onCancelRequest: (shift: Shift) => void;
}

/** Setup and logistics teams come first, Govindas last, everything else in between. */
function teamRank(name: string) {
  const n = name.toLowerCase();
  if (n.includes("setup") || n.includes("logistic")) return 0;
  if (n.includes("govinda")) return 2;
  return 1;
}

export function ShiftCatalog(props: CatalogProps) {
  const { departments, shifts, capacity, bookedIds, draftIds, conflictFor, busy, onToggle, onCancelRequest } = props;

  if (departments.length === 0) {
    return <EmptyState text="No teams have been set up yet. Check back soon." />;
  }

  const orderedDepartments = [...departments].sort((a, b) => teamRank(a.name) - teamRank(b.name));

  return (
    <div className="space-y-10">
      {orderedDepartments.map((dept, deptIndex) => {
        const deptShifts = shifts.filter((s) => s.department_id === dept.id);
        return (
          <motion.div
            key={dept.id}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: deptIndex * 0.08, duration: 0.4 }}
          >
            <div className="mb-4 flex flex-col gap-1 border-l-2 border-amber-300 pl-4">
              <h2 className="text-lg font-semibold text-amber-100 sm:text-xl">{dept.name}</h2>
              {dept.description && <p className="text-sm text-slate-300">{dept.description}</p>}
            </div>

            {deptShifts.length === 0 ? (
              <EmptyState text="No shifts posted for this team yet." compact />
            ) : (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                <AnimatePresence initial={false}>
                  {deptShifts.map((shift) => (
                    <ShiftCard
                      key={shift.id}
                      shift={shift}
                      maxVolunteers={shift.max_volunteers}
                      remaining={capacity[shift.id]?.remaining_slots ?? shift.max_volunteers}
                      booked={bookedIds.has(shift.id)}
                      selected={draftIds.has(shift.id)}
                      conflictWith={bookedIds.has(shift.id) ? undefined : conflictFor(shift)}
                      busy={busy}
                      onToggle={() => onToggle(shift)}
                      onCancelRequest={() => onCancelRequest(shift)}
                    />
                  ))}
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
  selected: boolean;
  conflictWith?: Shift;
  busy: boolean;
  onToggle: () => void;
  onCancelRequest: () => void;
}

function ShiftCard({
  shift,
  maxVolunteers,
  remaining,
  booked,
  selected,
  conflictWith,
  busy,
  onToggle,
  onCancelRequest,
}: ShiftCardProps) {
  const full = remaining <= 0 && !booked && !selected;
  const lowStock = !booked && !selected && remaining > 0 && remaining < 2;
  const filledPct = Math.min(100, Math.round(((maxVolunteers - remaining) / maxVolunteers) * 100));

  return (
    <motion.article
      layout
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.97 }}
      transition={{ duration: 0.25 }}
      className={cn(
        "group relative flex flex-col gap-4 overflow-hidden rounded-2xl border bg-slate-900/70 p-5 shadow-xl shadow-black/20 backdrop-blur-md transition-colors",
        booked && "border-emerald-400/50 shadow-emerald-900/30",
        selected && "border-amber-300/70 ring-2 ring-amber-300/30",
        !booked && !selected && "border-white/10 hover:border-amber-300/40",
        full && "opacity-70",
      )}
    >
      {(booked || selected) && (
        <div
          className={cn(
            "pointer-events-none absolute inset-x-0 top-0 h-1",
            booked ? "bg-gradient-to-r from-emerald-400 to-teal-300" : "bg-gradient-to-r from-amber-300 to-pink-400",
          )}
        />
      )}

      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-base font-semibold text-white">{shift.title}</h3>
          <p className="mt-1 flex items-center gap-1.5 text-sm font-semibold text-amber-200">
            <CalendarDays className="h-3.5 w-3.5 shrink-0" />
            <span>{formatDay(shift.start_time)}</span>
          </p>
          <p className="mt-1 flex items-center gap-1.5 text-sm text-slate-300">
            <Clock className="h-3.5 w-3.5 shrink-0" />
            <span>{formatRange12(shift.start_time, shift.end_time)}</span>
          </p>
        </div>
        <Badge tone="violet" className="shrink-0">
          {formatDuration(shift.start_time, shift.end_time)}
        </Badge>
      </div>

      {shift.description && <p className="text-sm leading-relaxed text-slate-300">{shift.description}</p>}

      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm text-slate-200">
          <Users className="h-4 w-4 text-amber-300" />
          <span className="inline-flex items-baseline gap-1.5">
            <span className="font-bold tabular-nums text-amber-200">{Math.max(remaining, 0)}</span>
            <span>of {maxVolunteers} slots left</span>
          </span>
        </div>

        {booked ? null : selected ? (
          <Badge tone="amber">Selected</Badge>
        ) : full ? (
          <Badge tone="rose">Full</Badge>
        ) : lowStock ? (
          <Badge tone="amber" pulse>
            Almost full
          </Badge>
        ) : null}
      </div>

      <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10" aria-hidden>
        <motion.div
          className="h-full rounded-full bg-gradient-to-r from-amber-400 to-orange-500"
          initial={false}
          animate={{ width: `${filledPct}%` }}
          transition={{ duration: 0.6, ease: "easeOut" }}
        />
      </div>

      {conflictWith && (
        <p className="flex items-start gap-2 rounded-lg border border-rose-400/30 bg-rose-500/15 px-3 py-2 text-xs text-rose-100">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          Clashes with “{conflictWith.title}”
        </p>
      )}

      <div className="mt-auto">
        {booked ? (
          // Only the button itself flips to "Cancel" on hover; hovering the card does nothing.
          <Button
            variant="outline"
            className="group/btn w-full border-emerald-400/50 text-emerald-200 hover:border-rose-400/60 hover:bg-rose-500/15 hover:text-rose-200"
            onClick={onCancelRequest}
            disabled={busy}
          >
            <CheckCircle2 className="h-4 w-4 group-hover/btn:hidden" />
            <XCircle className="hidden h-4 w-4 group-hover/btn:block" />
            <span className="group-hover/btn:hidden">Confirmed</span>
            <span className="hidden group-hover/btn:inline">Cancel</span>
          </Button>
        ) : selected ? (
          <Button variant="outline" className="w-full" onClick={onToggle} disabled={busy}>
            ✓ Selected · tap to remove
          </Button>
        ) : (
          // Clashing shifts use aria-disabled (not disabled) so a click still shows the clash message.
          <Button
            className={cn("w-full", conflictWith && "opacity-50 cursor-not-allowed")}
            onClick={onToggle}
            disabled={full || busy}
            aria-disabled={!!conflictWith}
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {full ? "Shift full" : conflictWith ? "Time conflict" : "Select shift"}
          </Button>
        )}
      </div>
    </motion.article>
  );
}

function EmptyState({ text, compact }: { text: string; compact?: boolean }) {
  return <GlassCard className={cn("p-8 text-center text-sm text-slate-300", compact && "p-5")}>{text}</GlassCard>;
}
