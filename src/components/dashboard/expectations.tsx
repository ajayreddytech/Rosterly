import { motion } from "framer-motion";
import { Clock3, HeartHandshake, Shirt, ShieldCheck, Sparkles } from "lucide-react";
import { GlassCard } from "@/components/ui/glass-card";

const SECTIONS = [
  {
    icon: ShieldCheck,
    title: "Code of Conduct",
    items: [
      "Serve with devotion, humility and respect for every guest, elder and fellow volunteer.",
      "Keep language, music and conduct appropriate to a sacred Vaishnava festival.",
      "No alcohol, smoking or non-vegetarian food on the premises, at any time.",
      "Report any safety concern, injury or lost item to a Stage & Logistics lead immediately.",
    ],
  },
  {
    icon: Clock3,
    title: "Punctuality",
    items: [
      "Arrive at least 15 minutes before your shift starts to check in and receive instructions.",
      "If you cannot make your shift, remove it from My Schedule as early as possible so someone else can take it.",
      "Late arrivals may be asked to wait for the next available task.",
      "Stay for your full shift. If you must leave early, inform your team lead first.",
    ],
  },
  {
    icon: Shirt,
    title: "Attire",
    items: [
      "Modest, clean and comfortable clothing. Traditional Indian attire is warmly welcome.",
      "Closed-toe shoes for Stage & Logistics and Kitchen shifts.",
      "Hair tied back and no loose jewellery when working in the Prasadam & Kitchen.",
      "Your volunteer pass must be visible at all times while on duty.",
    ],
  },
  {
    icon: Sparkles,
    title: "Gala Guidelines",
    items: [
      "Check in at your department desk on arrival; check out before you leave.",
      "Follow hygiene rules strictly when handling prasadam: wash hands, use gloves where provided.",
      "Guests come first: direct questions you cannot answer to the Guest Welcoming desk.",
      "Photos are welcome, but please ask before photographing guests, especially children.",
    ],
  },
];

export function Expectations() {
  return (
    <div className="space-y-6">
      <GlassCard className="relative overflow-hidden p-6 sm:p-8">
        <div className="pointer-events-none absolute -right-10 -top-10 h-44 w-44 rounded-full bg-amber-400/10 blur-3xl" />
        <div className="relative flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-300 to-orange-600 text-slate-950">
            <HeartHandshake className="h-6 w-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">Thank you for serving</h2>
            <p className="mt-2 text-sm leading-relaxed text-slate-300">
              As a volunteer you are part of the 60th Anniversary celebration. Please read these
              expectations before your first shift. Questions? Ask the Stage &amp; Logistics lead
              on the day.
            </p>
          </div>
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
              <GlassCard className="h-full p-6">
                <div className="mb-4 flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/10 text-amber-300">
                    <Icon className="h-5 w-5" />
                  </span>
                  <h3 className="text-base font-semibold text-amber-100">{section.title}</h3>
                </div>
                <ul className="space-y-2.5 text-sm text-slate-300">
                  {section.items.map((item) => (
                    <li key={item} className="flex gap-2.5">
                      <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-400" />
                      <span className="leading-relaxed">{item}</span>
                    </li>
                  ))}
                </ul>
              </GlassCard>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
