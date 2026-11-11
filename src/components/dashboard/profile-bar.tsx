import { Ticket } from "lucide-react";
import { Badge, GlassCard } from "@/components/ui/glass-card";
import type { Profile } from "@/lib/types";

export function ProfileBar({ profile, bookedCount }: { profile: Profile; bookedCount: number }) {
  const fullName = profile.full_name.trim() || "Volunteer";
  return (
    <GlassCard className="relative flex flex-col gap-4 overflow-hidden bg-slate-900/70 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
      <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-gradient-to-br from-amber-300/25 via-rose-400/15 to-violet-500/20 blur-2xl" aria-hidden />

      <div className="relative flex min-w-0 items-center gap-4">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-amber-200">Hare Krishna, {fullName} 🙏</p>
          <h1 className="mt-1 text-xl font-bold sm:text-2xl">
            <span className="text-shimmer">Welcome to ISKCON 60 Gala Volunteer Dashboard</span>
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-slate-200">
            Be a part of this landmark celebration and serve our wonderful community during this historic
            milestone and once-in-a-lifetime event.
          </p>
        </div>
      </div>

      <Badge tone={bookedCount > 0 ? "emerald" : "slate"} className="relative self-start px-3 py-1.5 text-sm sm:shrink-0">
        <Ticket className="h-4 w-4" />
        {bookedCount} {bookedCount === 1 ? "shift" : "shifts"} confirmed
      </Badge>
    </GlassCard>
  );
}
