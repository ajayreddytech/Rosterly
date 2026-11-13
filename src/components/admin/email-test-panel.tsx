"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Loader2, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { GlassCard } from "@/components/ui/glass-card";

const TESTS = [
  { kind: "reminder_morning", label: "Morning shift reminder", hint: "Sample: two shifts, 9:00 AM and 1:00 PM" },
  { kind: "reminder_later", label: "Later shift reminder", hint: "Sample: one shift, 1:00 PM" },
  { kind: "reminder_event", label: "Event email (no shift)", hint: "The approved event design" },
] as const;

type TestKind = (typeof TESTS)[number]["kind"];

interface TestResponse {
  error?: string;
  sent?: number;
  failed?: number;
  results?: { to: string; ok: boolean; error?: string }[];
}

/**
 * Admin test buttons. Sends each of the three emails, with sample data, only to
 * the addresses typed here. Nothing is written to the queue.
 */
export function EmailTestPanel() {
  const [emails, setEmails] = useState("");
  const [busy, setBusy] = useState<TestKind | null>(null);

  async function send(kind: TestKind) {
    if (!emails.trim()) {
      toast.error("Type at least one email address first.");
      return;
    }
    setBusy(kind);
    try {
      const res = await fetch("/api/admin/test-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, emails }),
      });
      const body = (await res.json().catch(() => ({}))) as TestResponse;
      if (!res.ok) {
        toast.error(body.error ?? "Could not send the test email");
        return;
      }
      if ((body.failed ?? 0) > 0) {
        const reason = body.results?.find((r) => !r.ok)?.error ?? "unknown error";
        toast.error(`Sent ${body.sent ?? 0}, failed ${body.failed}: ${reason}`, { duration: 15000 });
      } else {
        toast.success(`Test sent to ${body.sent} address${body.sent === 1 ? "" : "es"}`);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not send the test email");
    } finally {
      setBusy(null);
    }
  }

  return (
    <GlassCard className="p-5">
      <h2 className="mb-1 font-semibold text-amber-100">Test the emails</h2>
      <p className="mb-4 text-xs text-slate-500">
        Each button sends that email to the addresses below, with sample shift details and a [TEST] subject.
        Up to 10 addresses. Separate them with commas or spaces.
      </p>

      <label className="block">
        <span className="text-xs uppercase tracking-wide text-slate-400">Send test to</span>
        <textarea
          value={emails}
          onChange={(e) => setEmails(e.target.value)}
          rows={2}
          placeholder="you@example.com, friend@example.com"
          className="mt-1 w-full rounded-xl border border-white/10 bg-slate-900/60 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-600 focus:border-amber-400/60 focus:outline-none"
        />
      </label>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        {TESTS.map((t) => (
          <div key={t.kind} className="flex flex-col rounded-xl border border-white/5 p-3">
            <p className="text-sm font-medium text-slate-100">{t.label}</p>
            <p className="mt-1 flex-1 text-xs text-slate-500">{t.hint}</p>
            <Button
              size="sm"
              variant="outline"
              className="mt-3"
              disabled={busy !== null}
              onClick={() => void send(t.kind)}
            >
              {busy === t.kind ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Send test
            </Button>
          </div>
        ))}
      </div>
    </GlassCard>
  );
}
