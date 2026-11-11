"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";
import { KeyRound, Loader2, Mail, Sparkles } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { GlassCard } from "@/components/ui/glass-card";

const CODE_LENGTH = 6;
/** Supabase allows one code request per email every 60 seconds. */
const RESEND_COOLDOWN_SECONDS = 60;

/** Only same-site relative paths, so the code step cannot redirect off-site. */
function safeNext(value: string | null): string {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return "/dashboard";
  return value;
}

export function LoginForm() {
  const params = useSearchParams();
  const next = safeNext(params.get("next"));
  const authError = params.get("error");

  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  // "code" step: the email was sent and the volunteer is typing the code.
  const [step, setStep] = useState<"email" | "code">("email");
  const [status, setStatus] = useState<"idle" | "sending" | "verifying" | "error">(
    authError ? "error" : "idle",
  );
  const [message, setMessage] = useState<string | null>(
    authError ? "That sign-in link is invalid or has expired. Request a new code." : null,
  );
  const [cooldown, setCooldown] = useState(0);

  // Count down the resend cooldown one second at a time.
  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  async function sendCode(address: string) {
    setStatus("sending");
    setMessage(null);
    setCode("");

    const supabase = createClient();
    // No emailRedirectTo: the email carries a 6-digit code, so it works on any device.
    const { error } = await supabase.auth.signInWithOtp({
      email: address,
      options: { shouldCreateUser: true },
    });

    if (error) {
      setStatus("error");
      setMessage(error.message);
      return;
    }
    setEmail(address);
    setCooldown(RESEND_COOLDOWN_SECONDS);
    setStatus("idle");
    setStep("code");
  }

  async function onSubmitEmail(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const trimmed = email.trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(trimmed)) {
      setStatus("error");
      setMessage("Please enter a valid email address.");
      return;
    }
    await sendCode(trimmed);
  }

  async function verifyCode(value: string) {
    setStatus("verifying");
    setMessage(null);

    const supabase = createClient();
    const { error } = await supabase.auth.verifyOtp({
      email,
      token: value,
      type: "email",
    });

    if (error) {
      setStatus("idle");
      setCode("");
      setMessage(
        error.message.toLowerCase().includes("expired")
          ? "That code has expired. Request a new one below."
          : "That code is not correct. Check the email and try again.",
      );
      return;
    }
    // Full page load so the server sees the new session cookies straight away.
    window.location.assign(next);
  }

  function onCodeChange(raw: string) {
    const digits = raw.replace(/\D/g, "").slice(0, CODE_LENGTH);
    setCode(digits);
    if (digits.length === CODE_LENGTH) void verifyCode(digits);
  }

  function onSubmitCode(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (code.length !== CODE_LENGTH) {
      setMessage(`Please enter the ${CODE_LENGTH}-digit code from the email.`);
      return;
    }
    void verifyCode(code);
  }

  const busy = status === "sending" || status === "verifying";

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
          {step === "code" ? (
            <motion.form
              key="code"
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              onSubmit={onSubmitCode}
              className="space-y-5"
              noValidate
            >
              <div className="text-center">
                <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-300">
                  <KeyRound className="h-7 w-7" />
                </div>
                <h2 className="text-lg font-semibold text-white">Enter your 6-digit code</h2>
                <p className="mt-2 text-sm text-slate-300">
                  We emailed a code to <span className="break-all text-amber-200">{email}</span>. Enter it
                  here on any device.
                </p>
              </div>

              <div>
                <Label htmlFor="otp">Sign-in code</Label>
                <Input
                  id="otp"
                  name="otp"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  pattern="[0-9]*"
                  maxLength={CODE_LENGTH}
                  placeholder="123456"
                  value={code}
                  onChange={(e) => onCodeChange(e.target.value)}
                  disabled={busy}
                  autoFocus
                  className="h-14 text-center font-mono text-2xl tracking-[0.5em]"
                />
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

              <Button type="submit" size="lg" className="w-full" disabled={busy || code.length !== CODE_LENGTH}>
                {status === "verifying" ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> Checking code…
                  </>
                ) : (
                  "Sign in"
                )}
              </Button>

              <div className="flex flex-col items-center gap-3 text-sm">
                <button
                  type="button"
                  onClick={() => void sendCode(email)}
                  disabled={busy || cooldown > 0}
                  className="text-amber-300 underline-offset-4 hover:underline cursor-pointer disabled:cursor-not-allowed disabled:text-slate-500 disabled:no-underline"
                >
                  {cooldown > 0 ? `Send a new code in ${cooldown}s` : "Send a new code"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setStep("email");
                    setStatus("idle");
                    setCode("");
                    setMessage(null);
                  }}
                  disabled={busy}
                  className="text-slate-400 underline-offset-4 hover:underline cursor-pointer"
                >
                  Use a different email
                </button>
              </div>
            </motion.form>
          ) : (
            <motion.form key="form" onSubmit={onSubmitEmail} className="space-y-5" noValidate>
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
                    disabled={busy}
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

              <Button type="submit" size="lg" className="w-full" disabled={busy}>
                {status === "sending" ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> Sending code…
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4" /> Send sign-in code
                  </>
                )}
              </Button>

              <p className="text-center text-xs text-slate-500">
                No password needed. We will email you a 6-digit code.
              </p>
            </motion.form>
          )}
        </AnimatePresence>
      </GlassCard>
    </motion.div>
  );
}
