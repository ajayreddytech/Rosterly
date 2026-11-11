import * as React from "react";
import { cn } from "@/lib/utils";

/** Glassmorphism panel: backdrop-blur-md bg-slate-900/60 border border-amber-500/10 */
export function GlassCard({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-amber-500/10 bg-slate-900/60 backdrop-blur-md shadow-xl shadow-black/20",
        className,
      )}
      {...props}
    />
  );
}

export function Badge({
  className,
  tone = "amber",
  pulse = false,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & {
  tone?: "amber" | "emerald" | "rose" | "violet" | "slate";
  pulse?: boolean;
}) {
  const tones = {
    amber: "bg-amber-500/15 text-amber-200 border-amber-400/30",
    emerald: "bg-emerald-500/15 text-emerald-200 border-emerald-400/30",
    rose: "bg-rose-500/15 text-rose-200 border-rose-400/30",
    violet: "bg-violet-500/15 text-violet-200 border-violet-400/30",
    slate: "bg-slate-500/15 text-slate-200 border-slate-400/30",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium",
        tones[tone],
        pulse && "animate-pulse",
        className,
      )}
      {...props}
    />
  );
}
