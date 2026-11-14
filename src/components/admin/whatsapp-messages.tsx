"use client";

import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Copy, Download, Loader2, MessageCircle } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatDay, formatRange12 } from "@/lib/shifts";
import { CONTACTS } from "@/lib/venue";
import type { Department, Shift } from "@/lib/types";
import { cn } from "@/lib/utils";
import { noteShifts } from "@/lib/volunteer-note";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  shifts: Shift[];
  departments: Department[];
}

/**
 * A time slot to list in the message. A booked shift has a department and title.
 * A time from a volunteer's note (check-in/check-out) has neither, so it shows only the day and time.
 */
type VolunteerSlot = Pick<Shift, "start_time" | "end_time"> & Partial<Pick<Shift, "department_id" | "title">>;

/** One volunteer with every slot they are signed up for: booked shifts, or times from their note. */
interface VolunteerShifts {
  userId: string;
  fullName: string;
  phone: string | null;
  shifts: VolunteerSlot[];
}

/* Mirrors the wording of the reminder email (src/lib/email/templates.ts).
 * WhatsApp formatting: *bold*, "- " lists. Placeholders are filled per volunteer. */
const DEFAULT_TEMPLATE = [
  "🙏 Hare Krishna, {name}! 🌸",
  "",
  "Thank you for signing up for the ISKCON 60th Anniversary Gala 🎉 Your support is deeply appreciated 💛",
  "",
  "📅 This is a reminder of your upcoming volunteer {shift_word}:",
  "",
  "{shifts}",
  "",
  "👗 Dress code: Black Tie / Formal / Indian Devotional / Festival Attire",
  "",
  "🔗 *Volunteer Resources*",
  "📖 Volunteer Guidelines: {guidelines}",
  "🖥️ Volunteer Dashboard: {dashboard}",
  "",
  "🙏 Thank you for your time, devotion, and selfless service,",
  "*ISKCON 60th Anniversary Gala Organizing Team* ✨",
  "",
  "🆘 *Need help?*",
  "Please contact one of our volunteer coordinators.",
  "{contacts}",
].join("\n");

/** Digits only, with a leading country code. Numbers with 10 digits are assumed to be North American (+1). */
export function toWhatsAppNumber(phone: string | null): string | null {
  const digits = (phone ?? "").replace(/\D/g, "");
  if (digits.length === 10) return `1${digits}`;
  if (digits.length >= 11 && digits.length <= 15) return digits;
  return null;
}

/** One shift as a block, the same layout the email uses: "Dept: Title" then the day and time. */
function shiftBlock(s: VolunteerSlot, departments: Department[]): string {
  const dept = departments.find((d) => d.id === s.department_id)?.name;
  const label = [dept, s.title].filter(Boolean).join(": ");
  const when = `${formatDay(s.start_time)}, ${formatRange12(s.start_time, s.end_time)}`;
  return label ? `🌟 *${label}*\n🗓️ ${when}` : `🗓️ ${when}`;
}

/** The message text for one volunteer, with their own shifts listed. */
export function buildMessage(
  template: string,
  fullName: string,
  shifts: VolunteerSlot[],
  departments: Department[],
): string {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const firstName = fullName.trim().split(/\s+/)[0] || "Volunteer";
  const contacts = CONTACTS.map((c) => `- ${c.name}: ${c.phone}`).join("\n");
  return template
    .replace(/\{name\}/g, firstName)
    .replace(/\{shift_word\}/g, shifts.length > 1 ? "shifts" : "shift")
    .replace(/\{shifts\}/g, shifts.map((s) => shiftBlock(s, departments)).join("\n\n"))
    .replace(/\{guidelines\}/g, `${origin}/dashboard?tab=guidelines`)
    .replace(/\{dashboard\}/g, `${origin}/dashboard`)
    .replace(/\{contacts\}/g, contacts);
}

export function WhatsAppMessages({ open, onOpenChange, shifts, departments }: Props) {
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="WhatsApp messages"
      description="Each volunteer gets a message with their own shifts. Tap Send, check the message in WhatsApp, then press send there."
      className="max-w-2xl"
    >
      {/* Mounted only while open, so the list reloads and "sent" marks reset on every open. */}
      <WhatsAppList shifts={shifts} departments={departments} />
    </Dialog>
  );
}

function WhatsAppList({ shifts, departments }: Omit<Props, "open" | "onOpenChange">) {
  const [loading, setLoading] = useState(true);
  const [volunteers, setVolunteers] = useState<VolunteerShifts[]>([]);
  const [template, setTemplate] = useState(DEFAULT_TEMPLATE);
  const [sent, setSent] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");

  // Load every volunteer who is signed up: a shift booking, or a note with check-in/check-out times.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const supabase = createClient();
      const [assignmentsRes, profilesRes] = await Promise.all([
        supabase.from("shift_assignments").select("user_id, shift_id"),
        supabase.from("profiles").select("id, full_name, phone, note"),
      ]);
      if (cancelled) return;
      setLoading(false);
      const error = assignmentsRes.error ?? profilesRes.error;
      if (error) {
        toast.error(error.message);
        return;
      }
      const shiftById = new Map(shifts.map((s) => [s.id, s]));
      const bookedByUser = new Map<string, Shift[]>();
      for (const row of (assignmentsRes.data ?? []) as { user_id: string; shift_id: string }[]) {
        const shift = shiftById.get(row.shift_id);
        if (!shift) continue;
        const booked = bookedByUser.get(row.user_id) ?? [];
        booked.push(shift);
        bookedByUser.set(row.user_id, booked);
      }
      const list: VolunteerShifts[] = [];
      for (const p of (profilesRes.data ?? []) as {
        id: string;
        full_name: string | null;
        phone: string | null;
        note: string | null;
      }[]) {
        // Booked shifts take priority. A volunteer with no booking uses the times in their note.
        const booked = bookedByUser.get(p.id) ?? [];
        const slots: VolunteerSlot[] = booked.length > 0 ? booked : noteShifts(p.note);
        if (slots.length === 0) continue;
        list.push({
          userId: p.id,
          fullName: p.full_name ?? "",
          phone: p.phone ?? null,
          shifts: [...slots].sort((a, b) => a.start_time.localeCompare(b.start_time)),
        });
      }
      list.sort((a, b) => a.fullName.localeCompare(b.fullName));
      setVolunteers(list);
    })();
    return () => {
      cancelled = true;
    };
  }, [shifts]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q ? volunteers.filter((v) => v.fullName.toLowerCase().includes(q)) : volunteers;
  }, [volunteers, search]);

  /** Copies the exact text (emojis included) so it can be pasted into WhatsApp. */
  async function copyMessage(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Message copied. Paste it into WhatsApp.");
    } catch {
      toast.error("Could not copy. Select the text manually.");
    }
  }

  function markSent(userId: string) {
    setSent((prev) => new Set(prev).add(userId));
  }

  return (
    <div className="space-y-4">
        <div className="flex flex-col gap-3 rounded-xl border border-amber-500/15 bg-slate-950/40 p-3.5 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-slate-300">
            <strong className="text-amber-200">Send the poster first.</strong> WhatsApp links can&apos;t attach files, so
            for each volunteer: tap <em>Send on WhatsApp</em>, attach the poster (📎 → Photo) and send it, then send the
            text message.
          </p>
          <a
            href="/brand/gala-poster.png"
            download="ISKCON-60th-Gala-Poster.png"
            className="inline-flex h-9 shrink-0 items-center justify-center gap-2 rounded-xl bg-amber-500/15 px-3.5 text-sm font-medium text-amber-100 ring-1 ring-amber-400/30 transition hover:bg-amber-500/25"
          >
            <Download className="h-4 w-4" /> Download poster
          </a>
        </div>
        <div>
          <label htmlFor="wa_template" className="mb-1.5 block text-xs uppercase tracking-wide text-slate-400">
            Message template
          </label>
          <textarea
            id="wa_template"
            rows={12}
            value={template}
            onChange={(e) => setTemplate(e.target.value)}
            className="w-full rounded-xl border border-amber-500/15 bg-slate-950/60 px-3.5 py-2.5 text-sm text-slate-100 focus:border-amber-400/60 focus:outline-none focus:ring-2 focus:ring-amber-400/25"
          />
          <p className="mt-1 text-xs text-slate-500">
            Placeholders filled in per volunteer: {"{name}"} first name, {"{shifts}"} their shift list, {"{shift_word}"} shift or shifts,
            {" {guidelines}, {dashboard}, {contacts}"} links and contacts.
          </p>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Input
            placeholder="Search by name"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="sm:max-w-xs"
          />
          <p className="text-xs text-slate-400">
            {sent.size} of {volunteers.length} sent this session
          </p>
        </div>

        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-amber-300" />
          </div>
        ) : volunteers.length === 0 ? (
          <p className="py-6 text-center text-sm text-slate-400">No volunteers have a shift yet.</p>
        ) : (
          <ul className="max-h-[50dvh] divide-y divide-white/5 overflow-y-auto pr-1">
            {visible.map((v) => {
              const number = toWhatsAppNumber(v.phone);
              const text = buildMessage(template, v.fullName, v.shifts, departments);
              const isSent = sent.has(v.userId);
              return (
                <li key={v.userId} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <p className="font-medium text-slate-100">
                      {v.fullName || "(no name)"}
                      {isSent && <CheckCircle2 className="ml-2 inline h-4 w-4 text-emerald-400" />}
                    </p>
                    <p className="text-xs text-slate-400">
                      {v.shifts.length} shift{v.shifts.length === 1 ? "" : "s"} · {v.phone || "No phone number"}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-wrap gap-2">
                  <Button variant="outline" size="sm" onClick={() => void copyMessage(text)}>
                    <Copy className="h-4 w-4" /> Copy
                  </Button>
                  {number ? (
                    <a
                      href={`https://wa.me/${number}?text=${encodeURIComponent(text)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() => markSent(v.userId)}
                      className={cn(
                        "inline-flex h-9 shrink-0 items-center justify-center gap-2 rounded-xl px-3.5 text-sm font-medium transition",
                        "bg-emerald-500/15 text-emerald-200 ring-1 ring-emerald-400/30 hover:bg-emerald-500/25",
                      )}
                    >
                      <MessageCircle className="h-4 w-4" />
                      {isSent ? "Send again" : "Send on WhatsApp"}
                    </a>
                  ) : (
                    <Button variant="outline" size="sm" disabled title="Add a valid phone number to this volunteer's profile">
                      No valid number
                    </Button>
                  )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
    </div>
  );
}
