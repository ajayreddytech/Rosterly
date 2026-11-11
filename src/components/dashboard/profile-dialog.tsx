"use client";

import { useState, type FormEvent } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";
import type { Profile } from "@/lib/types";

interface Props {
  open: boolean;
  profile: Profile;
  required: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: (profile: Profile) => void;
}

export function ProfileDialog({ open, profile, required, onOpenChange, onSaved }: Props) {
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      dismissible={!required}
      title={required ? "Complete your volunteer profile" : "Edit your profile"}
      description={
        required
          ? "Your name and phone number are needed so the team can reach you on the day."
          : "Keep your contact details current for the gala team."
      }
    >
      {/* Re-mount on open so the form always starts from the latest saved values */}
      {open && (
        <ProfileForm
          key={profile.id + String(profile.full_name) + String(profile.phone)}
          profile={profile}
          required={required}
          onSaved={onSaved}
        />
      )}
    </Dialog>
  );
}

function ProfileForm({
  profile,
  required,
  onSaved,
}: {
  profile: Profile;
  required: boolean;
  onSaved: (profile: Profile) => void;
}) {
  const [fullName, setFullName] = useState(profile.full_name);
  const [phone, setPhone] = useState(profile.phone ?? "");
  const [ecName, setEcName] = useState(profile.emergency_contact_name ?? "");
  const [ecPhone, setEcPhone] = useState(profile.emergency_contact_phone ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!fullName.trim()) return setError("Please enter your full name.");
    if (!/^\+?[0-9 ()\-]{7,20}$/.test(phone.trim())) {
      return setError("Please enter a valid phone number.");
    }
    setError(null);
    setSaving(true);

    const updates = {
      full_name: fullName.trim(),
      phone: phone.trim(),
      emergency_contact_name: ecName.trim() || null,
      emergency_contact_phone: ecPhone.trim() || null,
    };

    const supabase = createClient();
    const { data, error: dbError } = await supabase
      .from("profiles")
      .update(updates)
      .eq("id", profile.id)
      .select("*")
      .single();

    setSaving(false);
    if (dbError || !data) {
      setError("Could not save your profile. Please try again.");
      toast.error("Could not save your profile");
      return;
    }
    onSaved(data as Profile);
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      <div>
        <Label htmlFor="full_name">Full name *</Label>
        <Input id="full_name" value={fullName} onChange={(e) => setFullName(e.target.value)} autoComplete="name" />
      </div>
      <div>
        <Label htmlFor="phone">Phone *</Label>
        <Input
          id="phone"
          type="tel"
          inputMode="tel"
          placeholder="+1 416 555 0123"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          autoComplete="tel"
        />
      </div>

      <div className="rounded-xl border border-white/5 bg-white/[0.02] p-4">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-rose-200">
          Emergency contact (optional)
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="ec_name">Name</Label>
            <Input id="ec_name" value={ecName} onChange={(e) => setEcName(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="ec_phone">Phone</Label>
            <Input id="ec_phone" type="tel" value={ecPhone} onChange={(e) => setEcPhone(e.target.value)} />
          </div>
        </div>
      </div>

      {error && (
        <p role="alert" className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
          {error}
        </p>
      )}

      <div className="flex justify-end pt-2">
        <Button type="submit" disabled={saving}>
          {saving && <Loader2 className="h-4 w-4 animate-spin" />}
          Save profile
        </Button>
      </div>
      {required && (
        <p className="text-center text-xs text-slate-500">Fields marked * are required.</p>
      )}
    </form>
  );
}
