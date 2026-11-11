"use client";

import { QRCodeSVG } from "qrcode.react";
import { Calendar, Clock, Phone, ShieldAlert, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge, GlassCard } from "@/components/ui/glass-card";
import { formatDay, formatRange12 } from "@/lib/shifts";
import { passCode } from "@/lib/utils";
import type { Department, Profile, Shift } from "@/lib/types";

interface Props {
  profile: Profile;
  shifts: Shift[];
  departments: Department[];
  onEdit: () => void;
}

export function RedTicket({ profile, shifts, departments, onEdit }: Props) {
  const code = passCode(profile.id);
  const sorted = [...shifts].sort(
    (a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime(),
  );
  const hasEmergency = !!profile.emergency_contact_name && !!profile.emergency_contact_phone;

  return (
    <div className="mx-auto max-w-2xl">
      {/* Ticket body: red gradient stub with a perforated divider */}
      <div className="relative overflow-hidden rounded-3xl border border-rose-400/30 bg-gradient-to-br from-rose-700 via-red-700 to-amber-600 p-[1px] shadow-2xl shadow-rose-950/50">
        <div className="relative rounded-[calc(1.5rem-1px)] bg-slate-950/90 backdrop-blur-xl">
          <div className="absolute inset-0 pattern-mandala opacity-[0.05]" aria-hidden />

          {/* Header */}
          <div className="relative flex items-center justify-between gap-4 bg-gradient-to-r from-rose-600 to-amber-500 px-6 py-4 text-slate-950">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.3em]">Volunteer Red Ticket</p>
              <p className="text-base font-extrabold">ISKCON Toronto · 60th Anniversary Gala</p>
            </div>
            <Badge tone="slate" className="border-slate-950/30 bg-slate-950/20 text-slate-950">
              {profile.role === "admin" ? "Admin" : "Volunteer"}
            </Badge>
          </div>

          <div className="relative grid gap-6 p-6 sm:grid-cols-[1fr_auto] sm:p-8">
            {/* Details */}
            <div className="min-w-0 space-y-5">
              <div>
                <p className="text-xs uppercase tracking-wide text-amber-300/80">Name</p>
                <p className="mt-0.5 truncate text-2xl font-bold text-white">
                  {profile.full_name || "Name not added"}
                </p>
              </div>

              <dl className="grid gap-3 text-sm sm:grid-cols-2">
                <div>
                  <dt className="text-xs uppercase tracking-wide text-slate-500">Email</dt>
                  <dd className="truncate text-slate-200">{profile.email}</dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wide text-slate-500">Phone</dt>
                  <dd className="text-slate-200">{profile.phone || "—"}</dd>
                </div>
              </dl>

              <div>
                <p className="mb-2 flex items-center gap-2 text-xs uppercase tracking-wide text-slate-500">
                  <Calendar className="h-3.5 w-3.5" /> Assigned shifts
                </p>
                {sorted.length === 0 ? (
                  <p className="text-sm text-slate-400">No shifts yet. Book one from the catalog.</p>
                ) : (
                  <ul className="space-y-2">
                    {sorted.map((s) => {
                      const dept = departments.find((d) => d.id === s.department_id);
                      return (
                        <li
                          key={s.id}
                          className="rounded-xl border border-amber-500/15 bg-white/[0.03] px-3.5 py-2.5"
                        >
                          <p className="text-sm font-semibold text-white">{s.title}</p>
                          <p className="mt-0.5 flex flex-wrap items-center gap-x-3 text-xs text-slate-400">
                            <span className="inline-flex items-center gap-1">
                              <Clock className="h-3 w-3" /> {formatDay(s.start_time)} ·{" "}
                              {formatRange12(s.start_time, s.end_time)}
                            </span>
                            {dept && <span>{dept.name}</span>}
                          </p>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>

              <div className="rounded-xl border border-rose-400/20 bg-rose-500/5 p-4">
                <p className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-rose-200">
                  <ShieldAlert className="h-3.5 w-3.5" /> Emergency contact
                </p>
                {hasEmergency ? (
                  <p className="text-sm text-slate-200">
                    <span className="font-medium">{profile.emergency_contact_name}</span>
                    <span className="mx-2 text-slate-600">·</span>
                    <span className="inline-flex items-center gap-1">
                      <Phone className="h-3.5 w-3.5" /> {profile.emergency_contact_phone}
                    </span>
                  </p>
                ) : (
                  <p className="text-sm text-slate-400">
                    Not provided yet.{" "}
                    <button
                      type="button"
                      onClick={onEdit}
                      className="text-amber-300 underline-offset-4 hover:underline cursor-pointer"
                    >
                      Add it now
                    </button>
                  </p>
                )}
              </div>
            </div>

            {/* Stub: pass code + QR */}
            <div className="flex flex-col items-center justify-start gap-3 sm:w-44">
              <div className="rounded-2xl bg-white p-3 shadow-lg shadow-black/40">
                <QRCodeSVG
                  value={`GALA60-VOL|${code}`}
                  size={148}
                  level="M"
                  bgColor="#ffffff"
                  fgColor="#0f172a"
                />
              </div>
              <div className="text-center">
                <p className="text-[10px] uppercase tracking-[0.25em] text-slate-500">Pass code</p>
                <p className="font-mono text-lg font-bold tracking-widest text-amber-200">{code}</p>
              </div>
            </div>
          </div>

          <div className="relative flex flex-wrap items-center justify-between gap-3 border-t border-dashed border-amber-500/20 px-6 py-4 sm:px-8">
            <p className="flex items-center gap-2 text-xs text-slate-400">
              <UserRound className="h-3.5 w-3.5" /> Show this pass at the Guest Welcoming desk on arrival.
            </p>
            <Button variant="outline" size="sm" onClick={onEdit}>
              Edit details
            </Button>
          </div>
        </div>
      </div>

      <GlassCard className="mt-6 p-4 text-center text-xs text-slate-500">
        Keep this pass private. It identifies you as a registered volunteer for the 60th Anniversary Gala.
      </GlassCard>
    </div>
  );
}
