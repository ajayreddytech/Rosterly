"use client";

import { Fragment, useCallback, useEffect, useMemo, useState, type ComponentType } from "react";
import { AnimatePresence, animate, motion } from "framer-motion";
import {
  Building2,
  CalendarRange,
  ChevronDown,
  Download,
  Gauge,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  RotateCcw,
  Trash2,
  Users,
  Workflow,
} from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { useLiveCapacity } from "@/hooks/use-live-capacity";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Badge, GlassCard } from "@/components/ui/glass-card";
import { Select } from "@/components/ui/input";
import { downloadText, toCsv } from "@/lib/csv";
import {
  EVENT_TZ,
  formatDay,
  formatRange12,
  formatTime12,
  zonedToIso,
} from "@/lib/shifts";
import type {
  AttendanceRow,
  Department,
  Shift,
  ShiftCapacity,
} from "@/lib/types";
import { cn } from "@/lib/utils";
import { DepartmentFormDialog, ShiftFormDialog } from "./forms";

interface Props {
  departments: Department[];
  shifts: Shift[];
  capacity: ShiftCapacity[];
  attendance: AttendanceRow[];
  volunteerCount: number;
  bookedVolunteerCount: number;
}

type DeleteTarget =
  | { type: "shift"; id: string; name: string; booked: number }
  | { type: "department"; id: string; name: string; shiftCount: number };

export function AdminDashboard(props: Props) {
  const [departments, setDepartments] = useState(props.departments);
  const [shifts, setShifts] = useState(props.shifts);
  const [attendance, setAttendance] = useState(props.attendance);
  const [volunteerCount, setVolunteerCount] = useState(props.volunteerCount);
  const [bookedVolunteerCount, setBookedVolunteerCount] = useState(props.bookedVolunteerCount);

  const [deptFilter, setDeptFilter] = useState<string>("all");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const [shiftDialog, setShiftDialog] = useState<{ open: boolean; shift: Shift | null }>({
    open: false,
    shift: null,
  });
  const [deptDialog, setDeptDialog] = useState<{ open: boolean; dept: Department | null }>({
    open: false,
    dept: null,
  });
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [resetting, setResetting] = useState(false);

  /* ---------- data loading ---------- */
  const reloadStructure = useCallback(async () => {
    const supabase = createClient();
    const [d, s] = await Promise.all([
      supabase.from("departments").select("*").order("name"),
      supabase.from("shifts").select("*").order("start_time"),
    ]);
    if (d.data) setDepartments(d.data as Department[]);
    if (s.data) setShifts(s.data as Shift[]);
  }, []);

  const loadAttendance = useCallback(async () => {
    const supabase = createClient();
    const [a, c, b] = await Promise.all([
      supabase
        .from("shift_assignments")
        .select("id, shift_id, assigned_at, profiles(full_name, email, phone)")
        .order("assigned_at", { ascending: true }),
      supabase.from("profiles").select("id", { count: "exact", head: true }).eq("role", "volunteer"),
      supabase
        .from("profiles")
        .select("id, shift_assignments!inner(id)", { count: "exact", head: true })
        .eq("role", "volunteer"),
    ]);
    if (a.data) setAttendance(a.data as unknown as AttendanceRow[]);
    if (c.count !== null && c.count !== undefined) setVolunteerCount(c.count);
    if (b.count !== null && b.count !== undefined) setBookedVolunteerCount(b.count);
  }, []);

  const { capacity: capacityMap, refresh: refreshCapacity } = useLiveCapacity(
    props.capacity,
    reloadStructure,
  );

  // Live attendance feed: admins can read every assignment, so postgres_changes works here.
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel("admin-attendance")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "shift_assignments" },
        () => void loadAttendance(),
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [loadAttendance]);

  async function refreshAll() {
    setRefreshing(true);
    await Promise.all([reloadStructure(), loadAttendance(), refreshCapacity()]);
    setRefreshing(false);
  }

  /** Removes every volunteer booking so each shift is back to its full capacity. */
  async function resetAllFillings() {
    setResetting(true);
    const { error } = await createClient()
      .from("shift_assignments")
      .delete()
      .not("id", "is", null);
    setResetting(false);

    if (error) {
      toast.error("Could not reset the shift fillings.", { description: error.message });
      return;
    }
    toast.success("All shift fillings have been reset to zero");
    setResetOpen(false);
    await Promise.all([loadAttendance(), refreshCapacity()]);
  }

  /* ---------- derived data ---------- */
  const attendeesByShift = useMemo(() => {
    const map: Record<string, AttendanceRow[]> = {};
    for (const row of attendance) (map[row.shift_id] ??= []).push(row);
    return map;
  }, [attendance]);

  const fromIso = fromDate ? zonedToIso(fromDate, "00:00") : null;
  const toIso = toDate ? zonedToIso(toDate, "23:59") : null;

  const filteredShifts = useMemo(
    () =>
      shifts.filter((s) => {
        if (deptFilter !== "all" && s.department_id !== deptFilter) return false;
        if (fromIso && new Date(s.end_time) < new Date(fromIso)) return false;
        if (toIso && new Date(s.start_time) > new Date(toIso)) return false;
        return true;
      }),
    [shifts, deptFilter, fromIso, toIso],
  );

  const totals = useMemo(() => {
    let booked = 0;
    let capacity = 0;
    for (const s of shifts) {
      const cap = capacityMap[s.id];
      booked += cap?.booked_count ?? 0;
      capacity += s.max_volunteers;
    }
    return {
      booked,
      capacity,
      fillRate: capacity ? Math.round((booked / capacity) * 100) : 0,
    };
  }, [shifts, capacityMap]);

  /* ---------- actions ---------- */
  function toggleExpanded(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function exportCsv() {
    const header = [
      "Department",
      "Shift",
      "Date",
      "Start",
      "End",
      "Required",
      "Volunteer name",
      "Email",
      "Phone",
      "Assigned at",
    ];
    const rows: (string | number)[][] = [];
    for (const s of filteredShifts) {
      const dept = departments.find((d) => d.id === s.department_id)?.name ?? "";
      const base = [
        dept,
        s.title,
        formatDay(s.start_time),
        formatTime12(s.start_time),
        formatTime12(s.end_time),
        s.max_volunteers,
      ];
      const people = attendeesByShift[s.id] ?? [];
      if (people.length === 0) {
        rows.push([...base, "", "", "", ""]);
      }
      for (const p of people) {
        rows.push([
          ...base,
          p.profiles?.full_name ?? "",
          p.profiles?.email ?? "",
          p.profiles?.phone ?? "",
          new Date(p.assigned_at).toLocaleString("en-CA", { timeZone: EVENT_TZ }),
        ]);
      }
    }
    const stamp = new Date().toISOString().slice(0, 10);
    downloadText(`gala-volunteers-${stamp}.csv`, toCsv(header, rows));
    toast.success(`Exported ${rows.length} rows`);
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    const supabase = createClient();
    const { error } =
      deleteTarget.type === "shift"
        ? await supabase.from("shifts").delete().eq("id", deleteTarget.id)
        : await supabase.from("departments").delete().eq("id", deleteTarget.id);
    setDeleting(false);

    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(deleteTarget.type === "shift" ? "Shift deleted" : "Department deleted");
    setDeleteTarget(null);
    await Promise.all([reloadStructure(), loadAttendance(), refreshCapacity()]);
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"
      >
        <div>
          <p className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-amber-300/80">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
            </span>
            Live · updates automatically
          </p>
          <h1 className="mt-1 text-2xl font-bold text-white sm:text-3xl">Gala attendance overview</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="ghost" size="md" onClick={() => void refreshAll()} disabled={refreshing}>
            <RefreshCw className={cn("h-4 w-4", refreshing && "animate-spin")} /> Refresh
          </Button>
          <Button variant="outline" size="md" onClick={exportCsv}>
            <Download className="h-4 w-4" /> Export CSV
          </Button>
          <Button variant="danger" size="md" onClick={() => setResetOpen(true)}>
            <RotateCcw className="h-4 w-4" /> Reset all fillings
          </Button>
          <Button size="md" onClick={() => setShiftDialog({ open: true, shift: null })}>
            <Plus className="h-4 w-4" /> New shift
          </Button>
        </div>
      </motion.div>

      {/* KPIs */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <KpiCard
          icon={Users}
          label="Registered volunteers"
          value={volunteerCount}
          sub={`${bookedVolunteerCount} signed up for at least one shift · ${Math.max(volunteerCount - bookedVolunteerCount, 0)} signed up for none`}
        />
        <KpiCard icon={CalendarRange} label="Shifts offered" value={shifts.length} />
        <KpiCard
          icon={Gauge}
          label="Capacity filled"
          value={totals.fillRate}
          suffix="%"
          sub={`${totals.booked} of ${totals.capacity} slots`}
          progress={totals.fillRate}
        />
      </div>

      {/* Filters */}
      <GlassCard className="grid gap-4 p-4 sm:grid-cols-[1fr_auto_auto_auto] sm:items-end">
        <div>
          <label htmlFor="flt_dept" className="mb-1.5 block text-xs uppercase tracking-wide text-slate-400">
            Department
          </label>
          <Select id="flt_dept" value={deptFilter} onChange={(e) => setDeptFilter(e.target.value)}>
            <option value="all">All departments</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <label htmlFor="flt_from" className="mb-1.5 block text-xs uppercase tracking-wide text-slate-400">
            From
          </label>
          <input
            id="flt_from"
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            className="flex h-11 w-full rounded-xl border border-amber-500/15 bg-slate-950/60 px-3 text-sm text-slate-100 focus:border-amber-400/60 focus:outline-none sm:w-44"
          />
        </div>
        <div>
          <label htmlFor="flt_to" className="mb-1.5 block text-xs uppercase tracking-wide text-slate-400">
            To
          </label>
          <input
            id="flt_to"
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            className="flex h-11 w-full rounded-xl border border-amber-500/15 bg-slate-950/60 px-3 text-sm text-slate-100 focus:border-amber-400/60 focus:outline-none sm:w-44"
          />
        </div>
        <Button
          variant="ghost"
          onClick={() => {
            setDeptFilter("all");
            setFromDate("");
            setToDate("");
          }}
        >
          Reset
        </Button>
      </GlassCard>

      {/* Visual overview: department table + event flow */}
      <VisualOverview shifts={filteredShifts} departments={departments} capacityMap={capacityMap} />

      {/* Live feed */}
      <GlassCard className="overflow-hidden">
        <div className="flex items-center justify-between border-b border-white/5 px-5 py-4">
          <h2 className="font-semibold text-amber-100">Shift feed</h2>
          <span className="text-xs text-slate-500">
            {filteredShifts.length} of {shifts.length} shifts
          </span>
        </div>

        {filteredShifts.length === 0 ? (
          <p className="p-10 text-center text-sm text-slate-400">
            No shifts match these filters. Create one with “New shift”.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="text-xs uppercase tracking-wide text-slate-500">
                <tr className="border-b border-white/5">
                  <th className="px-5 py-3 font-medium">Shift</th>
                  <th className="px-3 py-3 font-medium">When</th>
                  <th className="px-3 py-3 font-medium">Capacity</th>
                  <th className="px-3 py-3 font-medium">Remaining</th>
                  <th className="px-5 py-3 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredShifts.map((shift) => {
                  const dept = departments.find((d) => d.id === shift.department_id);
                  const cap = capacityMap[shift.id];
                  const booked = cap?.booked_count ?? 0;
                  const remaining = cap?.remaining_slots ?? shift.max_volunteers;
                  const people = attendeesByShift[shift.id] ?? [];
                  const isOpen = expanded.has(shift.id);
                  const pct = Math.round((booked / shift.max_volunteers) * 100);
                  return (
                    <Fragment key={shift.id}>
                      <motion.tr
                        layout
                        className="border-b border-white/5 transition-colors hover:bg-white/[0.03]"
                      >
                        <td className="px-5 py-4">
                          <button
                            type="button"
                            onClick={() => toggleExpanded(shift.id)}
                            className="group flex items-start gap-2 text-left cursor-pointer"
                            aria-expanded={isOpen}
                          >
                            <ChevronDown
                              className={cn(
                                "mt-0.5 h-4 w-4 shrink-0 text-slate-500 transition-transform group-hover:text-amber-300",
                                isOpen && "rotate-180",
                              )}
                            />
                            <span>
                              <span className="block font-medium text-white">{shift.title}</span>
                              <span className="block text-xs text-slate-500">{dept?.name ?? "—"}</span>
                              {shift.description && (
                                <span className="mt-1 block max-w-md text-xs leading-relaxed text-slate-400">
                                  {shift.description}
                                </span>
                              )}
                            </span>
                          </button>
                        </td>
                        <td className="px-3 py-4 whitespace-nowrap text-slate-300">
                          <span className="block">{formatDay(shift.start_time)}</span>
                          <span className="block text-xs text-slate-500">
                            {formatRange12(shift.start_time, shift.end_time)}
                          </span>
                        </td>
                        <td className="px-3 py-4">
                          <div className="flex min-w-[140px] items-center gap-3">
                            <span className="tabular-nums text-slate-200">
                              {booked}/{shift.max_volunteers}
                            </span>
                            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/5">
                              <motion.div
                                className="h-full rounded-full bg-gradient-to-r from-amber-400 to-orange-500"
                                initial={false}
                                animate={{ width: `${Math.min(pct, 100)}%` }}
                                transition={{ duration: 0.5 }}
                              />
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-4">
                          <AnimatePresence mode="popLayout" initial={false}>
                            <motion.span
                              key={remaining}
                              initial={{ opacity: 0, y: -8 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0, y: 8 }}
                              className="inline-block"
                            >
                              {remaining <= 0 ? (
                                <Badge tone="rose">Full</Badge>
                              ) : remaining < 2 ? (
                                <Badge tone="amber" pulse>
                                  {remaining} left
                                </Badge>
                              ) : (
                                <Badge tone="emerald">{remaining} left</Badge>
                              )}
                            </motion.span>
                          </AnimatePresence>
                        </td>
                        <td className="px-5 py-4">
                          <div className="flex justify-end gap-1.5">
                            <Button
                              variant="ghost"
                              size="icon"
                              aria-label={`Edit ${shift.title}`}
                              onClick={() => setShiftDialog({ open: true, shift })}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              aria-label={`Delete ${shift.title}`}
                              className="hover:text-rose-300"
                              onClick={() =>
                                setDeleteTarget({
                                  type: "shift",
                                  id: shift.id,
                                  name: shift.title,
                                  booked: people.length,
                                })
                              }
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </td>
                      </motion.tr>

                      <AnimatePresence initial={false}>
                        {isOpen && (
                          <motion.tr
                            key="detail"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="border-b border-white/5 bg-slate-950/40"
                          >
                            <td colSpan={5} className="px-5 py-4">
                              {people.length === 0 ? (
                                <p className="text-sm text-slate-500">No volunteers signed up yet.</p>
                              ) : (
                                <ul className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                                  {people.map((p) => (
                                    <li
                                      key={p.id}
                                      className="rounded-xl border border-amber-500/10 bg-white/[0.02] px-3.5 py-2.5"
                                    >
                                      <p className="font-medium text-slate-100">
                                        {p.profiles?.full_name || "Unnamed volunteer"}
                                      </p>
                                      <p className="text-xs text-slate-400">
                                        {p.profiles?.phone || "No phone"} · {p.profiles?.email}
                                      </p>
                                    </li>
                                  ))}
                                </ul>
                              )}
                            </td>
                          </motion.tr>
                        )}
                      </AnimatePresence>
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </GlassCard>

      {/* Departments */}
      <GlassCard className="p-5">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="flex items-center gap-2 font-semibold text-amber-100">
            <Building2 className="h-4 w-4" /> Departments
          </h2>
          <Button size="sm" variant="outline" onClick={() => setDeptDialog({ open: true, dept: null })}>
            <Plus className="h-4 w-4" /> Add department
          </Button>
        </div>
        <ul className="divide-y divide-white/5">
          {departments.map((d) => {
            const count = shifts.filter((s) => s.department_id === d.id).length;
            return (
              <li key={d.id} className="flex items-center justify-between gap-4 py-3">
                <div className="min-w-0">
                  <p className="truncate font-medium text-slate-100">{d.name}</p>
                  <p className="truncate text-xs text-slate-500">
                    {count} {count === 1 ? "shift" : "shifts"}
                    {d.description ? ` · ${d.description}` : ""}
                  </p>
                </div>
                <div className="flex shrink-0 gap-1.5">
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Edit ${d.name}`}
                    onClick={() => setDeptDialog({ open: true, dept: d })}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Delete ${d.name}`}
                    className="hover:text-rose-300"
                    onClick={() =>
                      setDeleteTarget({ type: "department", id: d.id, name: d.name, shiftCount: count })
                    }
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      </GlassCard>

      {/* Dialogs */}
      <ShiftFormDialog
        open={shiftDialog.open}
        onOpenChange={(open) => setShiftDialog((s) => ({ ...s, open }))}
        shift={shiftDialog.shift}
        departments={departments}
        bookedCount={shiftDialog.shift ? capacityMap[shiftDialog.shift.id]?.booked_count ?? 0 : 0}
        onSaved={() => {
          void reloadStructure();
          void refreshCapacity();
        }}
      />
      <DepartmentFormDialog
        open={deptDialog.open}
        onOpenChange={(open) => setDeptDialog((s) => ({ ...s, open }))}
        department={deptDialog.dept}
        onSaved={() => void reloadStructure()}
      />

      <Dialog
        open={resetOpen}
        onOpenChange={(open) => !resetting && setResetOpen(open)}
        title="Reset all shift fillings?"
      >
        <div className="space-y-5">
          <p className="text-sm leading-relaxed text-slate-300">
            Every volunteer booking on every shift will be removed, and all shifts will show their full capacity
            again. Volunteers are not notified automatically. <span className="text-rose-300">This cannot be undone.</span>
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setResetOpen(false)} disabled={resetting}>
              Cancel
            </Button>
            <Button variant="danger" onClick={() => void resetAllFillings()} disabled={resetting}>
              {resetting ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
              Reset to zero
            </Button>
          </div>
        </div>
      </Dialog>

      <Dialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title={deleteTarget?.type === "shift" ? "Delete shift?" : "Delete department?"}
      >
        {deleteTarget && (
          <div className="space-y-5">
            <p className="text-sm leading-relaxed text-slate-300">
              {deleteTarget.type === "shift" ? (
                <>
                  <span className="font-semibold text-white">{deleteTarget.name}</span> will be removed.
                  {deleteTarget.booked > 0 && (
                    <>
                      {" "}
                      <span className="text-rose-300">
                        {deleteTarget.booked} volunteer{deleteTarget.booked === 1 ? " is" : "s are"} booked
                        and will lose this assignment.
                      </span>
                    </>
                  )}
                </>
              ) : (
                <>
                  <span className="font-semibold text-white">{deleteTarget.name}</span> will be removed
                  {deleteTarget.shiftCount > 0 && (
                    <span className="text-rose-300">
                      {" "}
                      together with its {deleteTarget.shiftCount} shift
                      {deleteTarget.shiftCount === 1 ? "" : "s"} and all volunteer bookings
                    </span>
                  )}
                  .
                </>
              )}{" "}
              This cannot be undone.
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setDeleteTarget(null)} disabled={deleting}>
                Cancel
              </Button>
              <Button variant="danger" onClick={() => void confirmDelete()} disabled={deleting}>
                <Trash2 className="h-4 w-4" /> Delete
              </Button>
            </div>
          </div>
        )}
      </Dialog>
    </div>
  );
}

function KpiCard({
  icon: Icon,
  label,
  value,
  suffix = "",
  sub,
  progress,
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  value: number;
  suffix?: string;
  sub?: string;
  progress?: number;
}) {
  return (
    <GlassCard className="relative overflow-hidden p-5">
      <div className="pointer-events-none absolute -right-8 -top-8 h-28 w-28 rounded-full bg-amber-400/10 blur-2xl" />
      <div className="flex items-center justify-between">
        <p className="text-xs uppercase tracking-wide text-slate-400">{label}</p>
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500/10 text-amber-300">
          <Icon className="h-4.5 w-4.5" />
        </span>
      </div>
      <p className="mt-3 text-3xl font-bold tabular-nums text-white">
        <CountUp to={value} />
        {suffix}
      </p>
      {sub && <p className="mt-1 text-xs text-slate-500">{sub}</p>}
      {progress !== undefined && (
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/5">
          <motion.div
            className="h-full rounded-full bg-gradient-to-r from-amber-400 to-violet-500"
            initial={false}
            animate={{ width: `${Math.min(progress, 100)}%` }}
            transition={{ duration: 0.8, ease: "easeOut" }}
          />
        </div>
      )}
    </GlassCard>
  );
}

/** Visual summary: a per-department table and a day-by-day event flow of the filtered shifts. */
function VisualOverview({
  shifts,
  departments,
  capacityMap,
}: {
  shifts: Shift[];
  departments: Department[];
  capacityMap: Record<string, ShiftCapacity>;
}) {
  const rows = departments
    .map((d) => {
      const deptShifts = shifts.filter((s) => s.department_id === d.id);
      const capacity = deptShifts.reduce((sum, s) => sum + s.max_volunteers, 0);
      const booked = deptShifts.reduce((sum, s) => sum + (capacityMap[s.id]?.booked_count ?? 0), 0);
      return {
        dept: d,
        shiftCount: deptShifts.length,
        capacity,
        booked,
        pct: capacity ? Math.round((booked / capacity) * 100) : 0,
      };
    })
    .filter((r) => r.shiftCount > 0);

  const days = new Map<string, Shift[]>();
  for (const s of shifts) {
    const key = formatDay(s.start_time);
    const list = days.get(key) ?? [];
    list.push(s);
    days.set(key, list);
  }

  const deptName = (id: string) => departments.find((d) => d.id === id)?.name ?? "—";

  return (
    <div className="grid gap-6 xl:grid-cols-[1.1fr_1fr]">
      {/* Department table */}
      <GlassCard className="overflow-hidden">
        <div className="flex items-center gap-2 border-b border-white/5 px-5 py-4">
          <Building2 className="h-4 w-4 text-amber-300" />
          <h2 className="font-semibold text-amber-100">Department overview</h2>
        </div>
        {rows.length === 0 ? (
          <p className="p-10 text-center text-sm text-slate-400">No departments match these filters.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[480px] text-left text-sm">
              <thead className="text-xs uppercase tracking-wide text-slate-500">
                <tr className="border-b border-white/5">
                  <th className="px-5 py-3 font-medium">Department</th>
                  <th className="px-3 py-3 text-right font-medium">Shifts</th>
                  <th className="px-3 py-3 text-right font-medium">Booked</th>
                  <th className="px-5 py-3 font-medium">Fill</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <motion.tr
                    key={r.dept.id}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.04 }}
                    className="border-b border-white/5 transition-colors hover:bg-white/[0.03]"
                  >
                    <td className="px-5 py-4 font-medium text-white">{r.dept.name}</td>
                    <td className="px-3 py-4 text-right tabular-nums text-slate-300">{r.shiftCount}</td>
                    <td className="px-3 py-4 text-right tabular-nums text-slate-300">
                      {r.booked}/{r.capacity}
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex min-w-[140px] items-center gap-3">
                        <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/5">
                          <motion.div
                            className="h-full rounded-full bg-gradient-to-r from-amber-400 to-violet-500"
                            initial={false}
                            animate={{ width: `${Math.min(r.pct, 100)}%` }}
                            transition={{ duration: 0.6 }}
                          />
                        </div>
                        <span className="w-10 text-right tabular-nums text-xs text-slate-400">{r.pct}%</span>
                      </div>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </GlassCard>

      {/* Event flow */}
      <GlassCard className="overflow-hidden">
        <div className="flex items-center justify-between gap-2 border-b border-white/5 px-5 py-4">
          <h2 className="flex items-center gap-2 font-semibold text-amber-100">
            <Workflow className="h-4 w-4 text-amber-300" /> Event flow
          </h2>
          <span className="text-xs text-slate-500">
            {days.size} {days.size === 1 ? "day" : "days"}
          </span>
        </div>
        {days.size === 0 ? (
          <p className="p-10 text-center text-sm text-slate-400">No shifts to show in the flow.</p>
        ) : (
          <div className="max-h-[520px] overflow-y-auto p-5">
            <ol className="ml-2 space-y-7 border-l-2 border-amber-400/20 pl-6">
              {[...days.entries()].map(([day, list], di) => (
                <li key={day} className="relative">
                  <span className="absolute -left-[33px] top-0.5 h-4 w-4 rounded-full bg-amber-400 ring-4 ring-slate-900" />
                  <p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-amber-300">{day}</p>
                  <ul className="space-y-2.5">
                    {list.map((s, si) => {
                      const booked = capacityMap[s.id]?.booked_count ?? 0;
                      const remaining = capacityMap[s.id]?.remaining_slots ?? s.max_volunteers;
                      const pct = s.max_volunteers ? Math.round((booked / s.max_volunteers) * 100) : 0;
                      return (
                        <motion.li
                          key={s.id}
                          initial={{ opacity: 0, x: -8 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: di * 0.05 + si * 0.03 }}
                          className="rounded-xl border border-amber-500/10 bg-white/[0.03] p-3.5"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="truncate font-medium text-slate-100">{s.title}</p>
                              <p className="mt-0.5 text-xs text-slate-500">
                                {formatRange12(s.start_time, s.end_time)} · {deptName(s.department_id)}
                              </p>
                            </div>
                            <div className="flex shrink-0 items-center gap-2">
                              {remaining <= 0 ? (
                                <Badge tone="rose">Full</Badge>
                              ) : remaining < 2 ? (
                                <Badge tone="amber">{remaining} left</Badge>
                              ) : (
                                <Badge tone="emerald">{remaining} left</Badge>
                              )}
                            </div>
                          </div>
                          <div className="mt-3 flex items-center gap-3">
                            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/5">
                              <motion.div
                                className="h-full rounded-full bg-gradient-to-r from-amber-400 to-orange-500"
                                initial={false}
                                animate={{ width: `${Math.min(pct, 100)}%` }}
                                transition={{ duration: 0.5 }}
                              />
                            </div>
                            <span className="tabular-nums text-xs text-slate-400">
                              {booked}/{s.max_volunteers}
                            </span>
                          </div>
                        </motion.li>
                      );
                    })}
                  </ul>
                </li>
              ))}
            </ol>
          </div>
        )}
      </GlassCard>
    </div>
  );
}

/** Animated count-up for KPI values. */
function CountUp({ to }: { to: number }) {
  const [display, setDisplay] = useState(to);
  useEffect(() => {
    const controls = animate(display, to, {
      duration: 0.6,
      ease: "easeOut",
      onUpdate: (v) => setDisplay(Math.round(v)),
    });
    return () => controls.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [to]);
  return <>{display}</>;
}
