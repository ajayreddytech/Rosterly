"use client";

import { motion } from "framer-motion";
import { ArrowLeftRight, CalendarDays, CalendarPlus, Clock, Loader2, MapPin, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge, GlassCard } from "@/components/ui/glass-card";
import { formatDay, formatDuration, formatRange12 } from "@/lib/shifts";
import type { Department, Shift } from "@/lib/types";

interface Props {
  shifts: Shift[];
  departments: Department[];
  busy: boolean;
  onCancelRequest: (shift: Shift) => void;
  onBrowse: () => void;
}

export function MySchedule({ shifts, departments, busy, onCancelRequest, onBrowse }: Props) {
  const sorted = [...shifts].sort(
    (a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime(),
  );

  if (sorted.length === 0) {
    return (
      <GlassCard className="flex flex-col items-center gap-4 p-10 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-amber-400/20 text-amber-200">
          <CalendarPlus className="h-7 w-7" />
        </div>
        <div className="max-w-md">
          <h2 className="text-lg font-semibold text-white">You have not picked any shifts yet</h2>
          <p className="mt-2 text-sm leading-relaxed text-slate-300">
            Pick a shift to get started. Browse the available shifts, select the times that suit you,
            then press <span className="font-semibold text-amber-200">Submit</span> to confirm them.
          </p>
        </div>
        <Button onClick={onBrowse}>Pick a shift</Button>
      </GlassCard>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
      <ol className="relative space-y-4 border-l border-amber-300/50 pl-6 sm:pl-8">
        {sorted.map((shift, i) => {
          const dept = departments.find((d) => d.id === shift.department_id);
          return (
            <motion.li
              key={shift.id}
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.06 }}
              className="relative"
            >
              <span className="absolute -left-[33px] top-6 flex h-4 w-4 items-center justify-center rounded-full bg-amber-300 ring-4 ring-indigo-950 sm:-left-[41px]" />
              <GlassCard className="flex flex-col gap-4 bg-slate-900/70 p-5 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="flex items-center gap-1.5 text-sm font-semibold text-amber-200">
                    <CalendarDays className="h-3.5 w-3.5 shrink-0" />
                    {formatDay(shift.start_time)}
                  </p>
                  <p className="mt-1 flex items-center gap-1.5 text-sm text-slate-300">
                    <Clock className="h-3.5 w-3.5 shrink-0" />
                    {formatRange12(shift.start_time, shift.end_time)}
                  </p>
                  <h3 className="mt-1 text-base font-semibold text-white">{shift.title}</h3>
                  {shift.description && (
                    <p className="mt-1 text-sm leading-relaxed text-slate-300">{shift.description}</p>
                  )}
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-300">
                    <Badge tone="violet">{formatDuration(shift.start_time, shift.end_time)}</Badge>
                    {dept && (
                      <span className="inline-flex items-center gap-1">
                        <MapPin className="h-3.5 w-3.5" /> {dept.name}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex shrink-0 gap-2">
                  <Button variant="outline" size="sm" onClick={onBrowse}>
                    <ArrowLeftRight className="h-4 w-4" /> Switch shift
                  </Button>
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={() => onCancelRequest(shift)}
                    disabled={busy}
                    aria-label={`Cancel ${shift.title}`}
                  >
                    {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                    Cancel
                  </Button>
                </div>
              </GlassCard>
            </motion.li>
          );
        })}
      </ol>

      <GlassCard className="h-fit bg-slate-900/70 p-5">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-amber-200">Summary</h3>
        <dl className="mt-4 space-y-3 text-sm">
          <div className="flex justify-between">
            <dt className="text-slate-300">Shifts booked</dt>
            <dd className="font-semibold text-white">{sorted.length}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-slate-300">Total hours</dt>
            <dd className="font-semibold text-white">
              {(
                sorted.reduce(
                  (sum, s) =>
                    sum +
                    (new Date(s.end_time).getTime() - new Date(s.start_time).getTime()) / 3_600_000,
                  0,
                )
              ).toFixed(1)}
            </dd>
          </div>
        </dl>
        <p className="mt-4 text-xs leading-relaxed text-slate-400">
          Cancellations are for genuine emergencies only. Please give the team as much notice as you can.
        </p>
      </GlassCard>
    </div>
  );
}
