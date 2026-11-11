import { Pencil, Phone, Ticket } from "lucide-react";
import { Badge, GlassCard } from "@/components/ui/glass-card";
import { Button } from "@/components/ui/button";
import type { Profile } from "@/lib/types";

export function ProfileBar({
  profile,
  bookedCount,
  onEdit,
}: {
  profile: Profile;
  bookedCount: number;
  onEdit: () => void;
}) {
  const firstName = profile.full_name.trim().split(" ")[0] || "Volunteer";
  return (
    <GlassCard className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
      <div className="min-w-0">
        <p className="text-xs uppercase tracking-[0.2em] text-amber-300/80">Welcome, volunteer</p>
        <h1 className="mt-1 truncate text-xl font-bold text-white sm:text-2xl">
          Hare Krishna, {firstName} 🙏
        </h1>
        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-slate-400">
          <span className="truncate">{profile.email}</span>
          {profile.phone ? (
            <span className="inline-flex items-center gap-1.5">
              <Phone className="h-3.5 w-3.5" /> {profile.phone}
            </span>
          ) : (
            <span className="text-rose-300">Phone not added yet</span>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 sm:shrink-0">
        <Badge tone={bookedCount > 0 ? "emerald" : "slate"} className="px-3 py-1.5 text-sm">
          <Ticket className="h-4 w-4" />
          {bookedCount} {bookedCount === 1 ? "shift" : "shifts"} assigned
        </Badge>
        <Button variant="outline" size="sm" onClick={onEdit} aria-label="Edit profile">
          <Pencil className="h-4 w-4" />
          <span className="hidden md:inline">Edit profile</span>
        </Button>
      </div>
    </GlassCard>
  );
}
