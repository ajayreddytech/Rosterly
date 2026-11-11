import { motion } from "framer-motion";
import Image from "next/image";
import { Clock3, HeartHandshake, MessageCircle, Phone, Shirt, ShieldCheck, Sparkles, UtensilsCrossed } from "lucide-react";
import { GlassCard } from "@/components/ui/glass-card";
import { CONTACTS } from "@/lib/venue";

const SECTIONS = [
  {
    icon: Shirt,
    title: "Dress Code",
    items: [
      "The dress code is black tie, Indian formal, or devotional attire.",
      "Volunteers joining the morning setup are encouraged to get a spare dress while serving in the morning. You are welcome to change in the ashram area and get fully dressed before the main event begins at 4:00 p.m.",
      "Volunteers joining the evening shift from 4:00 p.m. onwards should come in the dress code of the event.",
    ],
  },
  {
    icon: ShieldCheck,
    title: "Care of the Temple Hall",
    items: [
      "Some services involve lifting, moving, and stacking tables, chairs, and other items.",
      "Please do not drag or drop any items in the temple hall, as this leaves scratches on the wooden floor.",
      "If you need help, please ask for assistance, or lift one item at a time.",
    ],
  },
  {
    icon: Clock3,
    title: "Punctuality & Check-In",
    items: [
      "Please arrive at least 15 minutes before your shift.",
      "Please check in with the volunteer coordinator when you arrive for your shift.",
      "Please check out with the volunteer coordinator when you leave after completing your shift.",
      "Last-minute cancellations are treated as such, unless they are due to an emergency.",
    ],
  },
  {
    icon: UtensilsCrossed,
    title: "Food Service & Prasadam",
    items: [
      "Volunteers serving or handling food must follow the highest standards of cleanliness, and must wear gloves and a hairnet.",
      "Prasadam for all volunteers will be arranged in the Prasadam Hall downstairs, not in the Govindas.",
    ],
  },
  {
    icon: Sparkles,
    title: "Conduct & Belongings",
    items: [
      "Please note: this is a closed, invite-only event, and this form is intended only for onboarding interested volunteers.",
      "Please be polite, professional, and pleasant, so that every event attendee has a pleasant experience.",
      "Please be respectful to everybody.",
      "Please take care of your personal belongings. ISKCON is not responsible for any losses.",
    ],
  },
];

export function Expectations() {
  return (
    <div className="space-y-6">
      <GlassCard className="bg-slate-900/70 p-6 sm:p-8">
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-300 to-orange-600 text-slate-950">
            <HeartHandshake className="h-6 w-6" />
          </div>
          <h2 className="text-xl font-bold text-white">Volunteer Guidelines</h2>
        </div>
      </GlassCard>

      <div className="grid gap-5 md:grid-cols-2">
        {SECTIONS.map((section, i) => {
          const Icon = section.icon;
          return (
            <motion.div
              key={section.title}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.07 }}
            >
              <GlassCard className="h-full bg-slate-900/70 p-6">
                <div className="mb-4 flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-400/20 text-amber-200">
                    <Icon className="h-5 w-5" />
                  </span>
                  <h3 className="text-base font-semibold text-amber-100">{section.title}</h3>
                </div>
                <ul className="space-y-2.5 text-sm text-slate-200">
                  {section.items.map((item) => (
                    <li key={item} className="flex gap-2.5">
                      <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-300" />
                      <span className="leading-relaxed">{item}</span>
                    </li>
                  ))}
                </ul>
              </GlassCard>
            </motion.div>
          );
        })}

        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: SECTIONS.length * 0.07 }}
        >
          <GlassCard className="flex h-full flex-col bg-slate-900/70 p-6">
            <div className="mb-4 flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-400/20 text-amber-200">
                <MessageCircle className="h-5 w-5" />
              </span>
              <h3 className="text-base font-semibold text-amber-100">Join our WhatsApp group</h3>
            </div>
            <ul className="space-y-2.5 text-sm text-slate-200">
              <li className="flex gap-2.5">
                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-300" />
                <span className="leading-relaxed">All volunteers are required to join the WhatsApp group.</span>
              </li>
              <li className="flex gap-2.5">
                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-300" />
                <span className="leading-relaxed">Scan the QR code with your phone camera to join.</span>
              </li>
            </ul>
            <div className="mt-5 flex justify-center">
              <div className="rounded-2xl bg-white p-2.5 shadow-lg shadow-amber-500/20 ring-2 ring-amber-300/70">
                <Image
                  src="/brand/whatsapp-qr.png"
                  alt="QR code to join the volunteer WhatsApp group"
                  width={601}
                  height={569}
                  className="h-auto w-36"
                />
              </div>
            </div>
          </GlassCard>
        </motion.div>
      </div>

      <GlassCard className="bg-slate-900/70 p-6 sm:p-8">
        <h2 className="text-base font-semibold text-amber-100">Need help?</h2>
        <p className="mt-1 text-sm text-slate-200">Please call or text one of our volunteer coordinators.</p>
        <ul className="mt-4 grid gap-3 sm:grid-cols-2">
          {CONTACTS.map((c) => (
            <li key={c.name}>
              <a
                href={`tel:${c.phone.replace(/\s/g, "")}`}
                className="flex items-center gap-3 rounded-xl border border-amber-300/20 bg-white/[0.04] px-4 py-3 transition-colors hover:border-amber-300/50 hover:bg-white/[0.08]"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-400/20 text-amber-200">
                  <Phone className="h-4 w-4" />
                </span>
                <span>
                  <span className="block text-sm font-semibold text-white">{c.name}</span>
                  <span className="block text-sm text-amber-200">{c.phone}</span>
                </span>
              </a>
            </li>
          ))}
        </ul>
      </GlassCard>
    </div>
  );
}
