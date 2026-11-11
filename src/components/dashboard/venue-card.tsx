import { CalendarDays, MapPin } from "lucide-react";
import { GlassCard } from "@/components/ui/glass-card";
import { GALA_DATE, VENUE_ADDRESS, VENUE_NAME } from "@/lib/venue";

/** Shows the gala date on top and the venue below. */
export function VenueCard() {
  return (
    <GlassCard className="flex flex-col gap-4 p-4 text-sm sm:flex-row sm:gap-8">
      <div className="flex items-center gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-400/20 text-amber-200">
          <CalendarDays className="h-4 w-4" />
        </span>
        <p className="font-semibold text-amber-100">{GALA_DATE}</p>
      </div>
      <div className="flex items-center gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-400/20 text-amber-200">
          <MapPin className="h-4 w-4" />
        </span>
        <div>
          <p className="font-semibold text-amber-100">{VENUE_NAME}</p>
          <p className="text-slate-200">{VENUE_ADDRESS}</p>
        </div>
      </div>
    </GlassCard>
  );
}
