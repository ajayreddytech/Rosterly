"use client";

import { useState, type FormEvent } from "react";
import { useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";
import { Loader2, Mail, MailCheck, Sparkles } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { GlassCard } from "@/components/ui/glass-card";

export function LoginForm() {
  const params = useSearchParams();
  const next = params.get("next") ?? "/dashboard";
  const authError = params.get("error");

  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">(
    authError ? "error" : "idle",
  );
  const [message, setMessage] = useState<string | null>(
    authError ? "That sign-in link is invalid or has expired. Request a new one." : null,
  );

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const trimmed = email.trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(trimmed)) {
      setStatus("error");
      setMessage("Please enter a valid email address.");
      return;
    }

    setStatus("sending");
    setMessage(null);

    const supabase = createClient();
    const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`;
    const { error } = await supabase.auth.signInWithOtp({
      email: trimmed,
      options: { emailRedirectTo: redirectTo, shouldCreateUser: true },
    });

    if (error) {
      setStatus("error");
      setMessage(error.message);
      return;
    }
    setStatus("sent");
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
      className="w-full max-w-md"
    >
      <div className="mb-8 text-center">
        <motion.div
          initial={{ scale: 0.6, rotate: -12 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: "spring", stiffness: 180, damping: 12 }}
          className="mx-auto mb-4 h-28 w-28 overflow-hidden rounded-full bg-indigo-950 shadow-2xl shadow-amber-500/40 ring-4 ring-amber-300/80"
        >
          <Image src="/brand/logo-circle.png" alt="ISKCON 60 logo" width={1024} height={1024} className="h-full w-full object-cover" priority />
        </motion.div>
        <p className="text-xs font-semibold uppercase tracking-[0.25em] text-amber-200">
          60th Anniversary · Gala 2026
        </p>
        <h1 className="mt-2 text-2xl font-bold sm:text-3xl">
          <span className="text-shimmer">ISKCON 60 Gala Volunteer Dashboard</span>
        </h1>
        <p className="mt-2 text-sm text-slate-300">Saturday, November 14, 2026 · Toronto</p>
      </div>

      <GlassCard className="p-6 sm:p-8">
        <AnimatePresence mode="wait">
          {status === "sent" ? (
            <motion.div
              key="sent"
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="py-6 text-center"
            >
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-300">
                <MailCheck className="h-7 w-7" />
              </div>
              <h2 className="text-lg font-semibold text-white">Check your email for your login link</h2>
              <p className="mt-2 text-sm text-slate-300">
                We sent a login link to <span className="text-amber-200">{email}</span>. Open it on this
                device to sign in. You can close this tab once you are signed in.
              </p>
              <button
                type="button"
                onClick={() => setStatus("idle")}
                className="mt-6 text-sm text-amber-300 underline-offset-4 hover:underline cursor-pointer"
              >
                Use a different email
              </button>
            </motion.div>
          ) : (
            <motion.form key="form" onSubmit={onSubmit} className="space-y-5" noValidate>
              <div>
                <Label htmlFor="email">Email address</Label>
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    inputMode="email"
                    autoComplete="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    disabled={status === "sending"}
                    className="pl-10"
                  />
                </div>
              </div>

              <AnimatePresence>
                {message && (
                  <motion.p
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    role="alert"
                    className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-200"
                  >
                    {message}
                  </motion.p>
                )}
              </AnimatePresence>

              <Button type="submit" size="lg" className="w-full" disabled={status === "sending"}>
                {status === "sending" ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> Sending link…
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4" /> Send login link
                  </>
                )}
              </Button>

              <p className="text-center text-xs text-slate-500">
                No password needed. We will email you a secure one-time sign-in link.
              </p>
            </motion.form>
          )}
        </AnimatePresence>
      </GlassCard>
    </motion.div>
  );
}
