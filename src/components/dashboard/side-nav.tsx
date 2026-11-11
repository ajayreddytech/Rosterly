"use client";

import type { ComponentType } from "react";
import { motion } from "framer-motion";
import { CalendarCheck2, CalendarSearch, ScrollText } from "lucide-react";
import { cn } from "@/lib/utils";

export type TabId = "schedule" | "catalog" | "guidelines";

export const TABS: { id: TabId; label: string; icon: ComponentType<{ className?: string }> }[] = [
  { id: "schedule", label: "My Schedule", icon: CalendarCheck2 },
  { id: "catalog", label: "Available Shifts", icon: CalendarSearch },
  { id: "guidelines", label: "Guidelines", icon: ScrollText },
];

/**
 * Phones: a bar fixed to the bottom of the screen, icons with small labels.
 * Desktop: a slim vertical bar on the left-middle showing icons only; it widens on hover to reveal the labels.
 */
export function SideNav({
  tab,
  onChange,
  selectedCount,
}: {
  tab: TabId;
  onChange: (tab: TabId) => void;
  selectedCount: number;
}) {
  return (
    <nav
      aria-label="Volunteer sections"
      className="fixed bottom-3 left-1/2 z-40 w-[calc(100%-1.5rem)] max-w-md -translate-x-1/2 md:left-3 md:top-1/2 md:bottom-auto md:w-auto md:max-w-none md:-translate-y-1/2 md:translate-x-0"
    >
      <div className="group flex flex-row gap-1 rounded-2xl border border-amber-300/20 bg-indigo-950/85 p-1.5 shadow-2xl shadow-black/40 backdrop-blur-xl md:w-14 md:flex-col md:overflow-hidden md:transition-[width] md:duration-300 md:hover:w-52">
        {TABS.map((t) => {
          const active = tab === t.id;
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => onChange(t.id)}
              aria-current={active ? "page" : undefined}
              aria-label={t.label}
              title={t.label}
              className={cn(
                "relative flex flex-1 flex-col items-center justify-center gap-0.5 whitespace-nowrap rounded-xl px-2 py-2 transition-colors cursor-pointer md:flex-none md:flex-row md:justify-start md:gap-3 md:px-3 md:py-3",
                active ? "text-slate-950" : "text-slate-300 hover:bg-white/5 hover:text-amber-100",
              )}
            >
              {active && (
                <motion.span
                  layoutId="side-pill"
                  className="absolute inset-0 rounded-xl bg-gradient-to-r from-amber-300 to-orange-500 shadow-lg shadow-amber-500/30"
                  transition={{ type: "spring", stiffness: 380, damping: 32 }}
                />
              )}
              <Icon className="relative h-5 w-5 shrink-0" />
              <span className="relative text-[10px] font-medium md:text-sm md:opacity-0 md:transition-opacity md:duration-200 md:group-hover:opacity-100">
                {t.label}
              </span>
              {t.id === "catalog" && selectedCount > 0 && (
                <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-500 px-1 text-[11px] font-bold text-white shadow">
                  {selectedCount}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
