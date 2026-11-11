"use client";

import { useState } from "react";
import { HeartHandshake } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { formatDay, formatRange12 } from "@/lib/shifts";
import type { Shift } from "@/lib/types";

/** Gentle speed-bump before a volunteer gives up a shift they already hold. */
export function EmergencyCancelDialog({
  shift,
  busy,
  onConfirm,
  onClose,
}: {
  shift: Shift | null;
  busy: boolean;
  onConfirm: (shift: Shift) => void;
  onClose: () => void;
}) {
  return (
    <Dialog
      open={!!shift}
      onOpenChange={(open) => !open && onClose()}
      title="Last-minute cancellation"
      description={
        shift ? `${shift.title} · ${formatDay(shift.start_time)}, ${formatRange12(shift.start_time, shift.end_time)}` : undefined
      }
    >
      {shift && <CancelForm key={shift.id} shift={shift} busy={busy} onConfirm={onConfirm} onKeep={onClose} />}
    </Dialog>
  );
}

function CancelForm({
  shift,
  busy,
  onConfirm,
  onKeep,
}: {
  shift: Shift;
  busy: boolean;
  onConfirm: (shift: Shift) => void;
  onKeep: () => void;
}) {
  const [confirmed, setConfirmed] = useState(false);

  return (
    <div className="space-y-5">
      <div className="flex gap-3 rounded-xl border border-amber-400/30 bg-amber-500/10 p-4 text-sm leading-relaxed text-amber-50">
        <HeartHandshake className="mt-0.5 h-5 w-5 shrink-0 text-amber-300" />
        <p>
          Your team is counting on you. Cancelling this close to the day leaves the shift short-staffed.
          If you can still make it, please keep your spot. Cancel only in a genuine emergency.
        </p>
      </div>

      <label className="flex cursor-pointer items-start gap-3 text-sm text-slate-200">
        <input
          type="checkbox"
          checked={confirmed}
          onChange={(e) => setConfirmed(e.target.checked)}
          className="mt-1 h-4 w-4 shrink-0 accent-amber-400"
        />
        <span>Yes, this is a genuine emergency and I cannot attend this shift.</span>
      </label>

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button variant="outline" onClick={onKeep}>
          Keep my shift
        </Button>
        <Button variant="danger" onClick={() => onConfirm(shift)} disabled={!confirmed || busy}>
          Cancel this shift
        </Button>
      </div>
    </div>
  );
}
