"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { LogOut, Menu, Pencil, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function AppHeader({
  isAdmin,
  title,
  onEditProfile,
}: {
  isAdmin?: boolean;
  title?: string;
  onEditProfile?: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Phones only: close the dropdown on an outside tap or the Escape key.
  useEffect(() => {
    if (!menuOpen) return;
    function onPointer(e: PointerEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setMenuOpen(false);
    }
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  return (
    <header className="sticky top-0 z-30 border-b border-white/10 bg-indigo-950/60 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <Link href="/dashboard" className="flex min-w-0 items-center gap-3">
          <Image
            src="/brand/logo-circle.png"
            alt="ISKCON 60 logo"
            width={1024}
            height={1024}
            priority
            className="h-14 w-14 shrink-0 rounded-full sm:h-20 sm:w-20"
          />
          <span className="truncate text-sm font-semibold text-amber-100 sm:text-base">
            {title ?? "Celebrating 60 Years of ISKCON"}
          </span>
        </Link>

        {/* Desktop and tablet: every action is visible. */}
        <div className="hidden shrink-0 items-center gap-2 sm:flex">
          {isAdmin && (
            <Link href="/admin">
              <Button variant="outline" size="sm">
                <ShieldCheck className="h-4 w-4" />
                Admin
              </Button>
            </Link>
          )}
          {onEditProfile && (
            <Button variant="outline" size="sm" onClick={onEditProfile}>
              <Pencil className="h-4 w-4" />
              Edit profile
            </Button>
          )}
          <form action="/auth/signout" method="post">
            <Button type="submit" variant="ghost" size="sm">
              <LogOut className="h-4 w-4" />
              Log out
            </Button>
          </form>
        </div>

        {/* Phones: the same actions sit in a dropdown behind the menu icon. */}
        <div ref={menuRef} className="relative shrink-0 sm:hidden">
          <Button
            variant="outline"
            size="icon"
            onClick={() => setMenuOpen((open) => !open)}
            aria-label="Open menu"
            aria-expanded={menuOpen}
            aria-haspopup="menu"
          >
            <Menu className="h-5 w-5" />
          </Button>

          {menuOpen && (
            <div
              role="menu"
              className="absolute right-0 top-full z-40 mt-2 w-48 overflow-hidden rounded-xl border border-amber-300/30 bg-indigo-950/95 p-1.5 shadow-2xl shadow-black/50 backdrop-blur-xl"
            >
              {isAdmin && (
                <Link
                  href="/admin"
                  role="menuitem"
                  onClick={() => setMenuOpen(false)}
                  className={menuItemClass}
                >
                  <ShieldCheck className="h-4 w-4 text-amber-200" />
                  Admin
                </Link>
              )}
              {onEditProfile && (
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setMenuOpen(false);
                    onEditProfile();
                  }}
                  className={menuItemClass}
                >
                  <Pencil className="h-4 w-4 text-amber-200" />
                  Edit profile
                </button>
              )}
              <form action="/auth/signout" method="post">
                <button type="submit" role="menuitem" className={cn(menuItemClass, "text-rose-200")}>
                  <LogOut className="h-4 w-4" />
                  Log out
                </button>
              </form>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

const menuItemClass =
  "flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-sm font-medium text-slate-100 transition-colors hover:bg-white/10";
