"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { CapacityMap, ShiftCapacity } from "@/lib/types";

function toMap(rows: ShiftCapacity[]): CapacityMap {
  return Object.fromEntries(rows.map((r) => [r.shift_id, r]));
}

/**
 * Live `remaining_slots = max_volunteers - COUNT(shift_assignments)` per shift.
 *
 * Volunteers cannot read other people's assignment rows, so the database
 * broadcasts a lightweight "capacity_changed" signal on every change and the
 * hook re-reads the aggregate `shift_capacity` view. `onSignal` lets a caller
 * (e.g. the admin dashboard) also reload anything else that depends on shifts.
 */
export function useLiveCapacity(initial: ShiftCapacity[], onSignal?: () => void) {
  const [capacity, setCapacity] = useState<CapacityMap>(() => toMap(initial));

  const signalRef = useRef(onSignal);
  useEffect(() => {
    signalRef.current = onSignal;
  });

  const refresh = useCallback(async () => {
    const supabase = createClient();
    const { data, error } = await supabase.from("shift_capacity").select("*");
    if (!error && data) setCapacity(toMap(data as ShiftCapacity[]));
  }, []);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel("shift-capacity")
      .on("broadcast", { event: "capacity_changed" }, () => {
        void refresh();
        signalRef.current?.();
      })
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [refresh]);

  return { capacity, refresh };
}
