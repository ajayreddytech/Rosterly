import Link from "next/link";
import { CalendarHeart, LogOut, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";

export function AppHeader({ isAdmin, title }: { isAdmin?: boolean; title?: string }) {
  return (
    <header className="sticky top-0 z-30 border-b border-amber-500/10 bg-slate-950/50 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <Link href="/dashboard" className="flex items-center gap-2.5 min-w-0">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-amber-300 to-orange-600 text-slate-950">
            <CalendarHeart className="h-5 w-5" />
          </span>
          <span className="truncate text-sm font-semibold text-amber-100 sm:text-base">
            {title ?? "Iskcon 60 Gala volunteer Shift Signup"}
          </span>
        </Link>

        <div className="flex items-center gap-2">
          {isAdmin && (
            <Link href="/admin">
              <Button variant="outline" size="sm">
                <ShieldCheck className="h-4 w-4" />
                <span className="hidden sm:inline">Admin</span>
              </Button>
            </Link>
          )}
          <form action="/auth/signout" method="post">
            <Button type="submit" variant="ghost" size="sm" aria-label="Log out">
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:inline">Log out</span>
            </Button>
          </form>
        </div>
      </div>
    </header>
  );
}
