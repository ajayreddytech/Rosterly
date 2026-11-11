"use client";

import { useState, type FormEvent } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";
import { EVENT_TZ, isoToZoned, zonedToIso } from "@/lib/shifts";
import type { Department, Shift } from "@/lib/types";

/* ------------------------------------------------------------------
   Shift create / edit
   Admins type Toronto wall-clock times; they are stored as UTC timestamptz.
   ------------------------------------------------------------------ */
export function ShiftFormDialog({
  open,
  onOpenChange,
  shift,
  departments,
  bookedCount,
  defaultDepartmentId,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  shift: Shift | null;
  departments: Department[];
  bookedCount: number;
  defaultDepartmentId?: string;
  onSaved: () => void;
}) {
  const editing = !!shift;
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={editing ? "Edit shift" : "New shift"}
      description={`All times are Toronto time (${EVENT_TZ}).`}
    >
      {open && (
        <ShiftForm
          key={shift?.id ?? "new"}
          shift={shift}
          departments={departments}
          bookedCount={bookedCount}
          defaultDepartmentId={defaultDepartmentId}
          onSaved={() => {
            onSaved();
            onOpenChange(false);
          }}
        />
      )}
    </Dialog>
  );
}

function ShiftForm({
  shift,
  departments,
  bookedCount,
  defaultDepartmentId,
  onSaved,
}: {
  shift: Shift | null;
  departments: Department[];
  bookedCount: number;
  defaultDepartmentId?: string;
  onSaved: () => void;
}) {
  const start = shift ? isoToZoned(shift.start_time) : null;
  const end = shift ? isoToZoned(shift.end_time) : null;

  const [title, setTitle] = useState(shift?.title ?? "");
  const [description, setDescription] = useState(shift?.description ?? "");
  const [departmentId, setDepartmentId] = useState(
    shift?.department_id ?? defaultDepartmentId ?? departments[0]?.id ?? "",
  );
  const [date, setDate] = useState(start?.date ?? "2026-11-14");
  const [startTime, setStartTime] = useState(start?.time ?? "09:00");
  const [endTime, setEndTime] = useState(end?.time ?? "12:00");
  const [max, setMax] = useState(String(shift?.max_volunteers ?? 5));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const maxVolunteers = Number(max);
    if (!title.trim()) return setError("Give the shift a title.");
    if (!departmentId) return setError("Choose a department.");
    if (!Number.isInteger(maxVolunteers) || maxVolunteers < 1) {
      return setError("Required volunteers must be a whole number of at least 1.");
    }
    if (shift && maxVolunteers < bookedCount) {
      return setError(
        `${bookedCount} volunteers are already booked, so capacity cannot go below ${bookedCount}.`,
      );
    }

    const startIso = zonedToIso(date, startTime);
    const endIso = zonedToIso(date, endTime);
    if (new Date(endIso) <= new Date(startIso)) {
      return setError("End time must be after the start time.");
    }

    setError(null);
    setSaving(true);
    const supabase = createClient();
    const payload = {
      title: title.trim(),
      description: description.trim() || null,
      department_id: departmentId,
      start_time: startIso,
      end_time: endIso,
      max_volunteers: maxVolunteers,
    };
    const { error: dbError } = shift
      ? await supabase.from("shifts").update(payload).eq("id", shift.id)
      : await supabase.from("shifts").insert(payload);
    setSaving(false);

    if (dbError) {
      setError(dbError.message);
      return;
    }
    toast.success(shift ? "Shift updated" : "Shift created");
    onSaved();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      <div>
        <Label htmlFor="shift_title">Title *</Label>
        <Input id="shift_title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Lunch prasadam service" />
      </div>
      <div>
        <Label htmlFor="shift_desc">Description</Label>
        <textarea
          id="shift_desc"
          rows={3}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="What volunteers will do on this shift, what to bring, who to report to"
          className="flex w-full rounded-xl border border-amber-500/15 bg-slate-950/60 px-3.5 py-2.5 text-sm text-slate-100 placeholder:text-slate-500 focus:border-amber-400/60 focus:outline-none focus:ring-2 focus:ring-amber-400/25"
        />
      </div>
      <div>
        <Label htmlFor="shift_dept">Department *</Label>
        <Select id="shift_dept" value={departmentId} onChange={(e) => setDepartmentId(e.target.value)}>
          {departments.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </Select>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <Label htmlFor="shift_date">Date *</Label>
          <Input id="shift_date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="shift_start">Start *</Label>
          <Input id="shift_start" type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="shift_end">End *</Label>
          <Input id="shift_end" type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
        </div>
      </div>
      <div>
        <Label htmlFor="shift_max">Required volunteers *</Label>
        <Input id="shift_max" type="number" min={1} step={1} value={max} onChange={(e) => setMax(e.target.value)} />
      </div>

      {error && (
        <p role="alert" className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
          {error}
        </p>
      )}

      <div className="flex justify-end gap-2 pt-2">
        <Button type="submit" disabled={saving}>
          {saving && <Loader2 className="h-4 w-4 animate-spin" />}
          {shift ? "Save changes" : "Create shift"}
        </Button>
      </div>
    </form>
  );
}

/* ------------------------------------------------------------------
   Department create / edit
   ------------------------------------------------------------------ */
export function DepartmentFormDialog({
  open,
  onOpenChange,
  department,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  department: Department | null;
  onSaved: () => void;
}) {
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={department ? "Edit department" : "New department"}
    >
      {open && (
        <DepartmentForm
          key={department?.id ?? "new"}
          department={department}
          onSaved={() => {
            onSaved();
            onOpenChange(false);
          }}
        />
      )}
    </Dialog>
  );
}

function DepartmentForm({ department, onSaved }: { department: Department | null; onSaved: () => void }) {
  const [name, setName] = useState(department?.name ?? "");
  const [description, setDescription] = useState(department?.description ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!name.trim()) return setError("Give the department a name.");
    setError(null);
    setSaving(true);
    const supabase = createClient();
    const payload = { name: name.trim(), description: description.trim() || null };
    const { error: dbError } = department
      ? await supabase.from("departments").update(payload).eq("id", department.id)
      : await supabase.from("departments").insert(payload);
    setSaving(false);
    if (dbError) return setError(dbError.message);
    toast.success(department ? "Department updated" : "Department created");
    onSaved();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      <div>
        <Label htmlFor="dept_name">Name *</Label>
        <Input id="dept_name" value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <div>
        <Label htmlFor="dept_desc">Description</Label>
        <Input id="dept_desc" value={description} onChange={(e) => setDescription(e.target.value)} />
      </div>
      {error && (
        <p role="alert" className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
          {error}
        </p>
      )}
      <div className="flex justify-end">
        <Button type="submit" disabled={saving}>
          {saving && <Loader2 className="h-4 w-4 animate-spin" />}
          {department ? "Save changes" : "Create department"}
        </Button>
      </div>
    </form>
  );
}
