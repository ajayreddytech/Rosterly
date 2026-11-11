/**
 * Immersive, non-interactive backdrop: celebratory radial gradients, drifting
 * glowing orbs, and a subtle geometric (lotus/mandala-inspired) SVG pattern.
 */
export function AmbientBackground() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-[#090D16]">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(245,158,11,0.18),_transparent_55%),radial-gradient(ellipse_at_bottom_right,_rgba(139,92,246,0.22),_transparent_60%),linear-gradient(180deg,_#0F172A_0%,_#090D16_100%)]" />
      <div className="absolute inset-0 pattern-mandala opacity-[0.07]" />
      <div className="orb orb-gold -left-24 top-10 h-72 w-72" />
      <div className="orb orb-purple -right-20 top-1/3 h-96 w-96" />
      <div className="orb orb-amber bottom-0 left-1/3 h-80 w-80" />
    </div>
  );
}
