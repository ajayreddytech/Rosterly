"use client";

import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Animated modal built on Radix Dialog (focus trap, Esc, aria) with Framer Motion
 * for the overlay and panel transitions.
 */
export function Dialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  className,
  dismissible = true,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
  dismissible?: boolean;
}) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={dismissible ? onOpenChange : undefined}>
      <AnimatePresence>
        {open && (
          <DialogPrimitive.Portal forceMount>
            <DialogPrimitive.Overlay asChild>
              <motion.div
                key="overlay"
                className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              />
            </DialogPrimitive.Overlay>
            <DialogPrimitive.Content asChild onEscapeKeyDown={(e) => !dismissible && e.preventDefault()}>
              <motion.div
                key="panel"
                initial={{ opacity: 0, scale: 0.96, y: 12 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.96, y: 12 }}
                transition={{ duration: 0.2, ease: "easeOut" }}
                className={cn(
                  "fixed left-1/2 top-1/2 z-50 flex max-h-[90dvh] w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-2xl border border-amber-500/20 bg-slate-900/90 shadow-2xl shadow-black/50 backdrop-blur-xl focus:outline-none",
                  className,
                )}
              >
                <div className="flex items-start justify-between gap-4 border-b border-white/5 p-5">
                  <div>
                    <DialogPrimitive.Title className="font-display text-lg font-semibold text-amber-100">
                      {title}
                    </DialogPrimitive.Title>
                    {description && (
                      <DialogPrimitive.Description className="mt-1 text-sm text-slate-400">
                        {description}
                      </DialogPrimitive.Description>
                    )}
                  </div>
                  {dismissible && (
                    <DialogPrimitive.Close
                      aria-label="Close"
                      className="rounded-lg p-1.5 text-slate-400 transition hover:bg-white/5 hover:text-white"
                    >
                      <X className="h-4 w-4" />
                    </DialogPrimitive.Close>
                  )}
                </div>
                <div className="overflow-y-auto p-5">{children}</div>
              </motion.div>
            </DialogPrimitive.Content>
          </DialogPrimitive.Portal>
        )}
      </AnimatePresence>
    </DialogPrimitive.Root>
  );
}
