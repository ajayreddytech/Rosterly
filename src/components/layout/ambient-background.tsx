/**
 * Immersive, non-interactive backdrop in the logo's palette: a slowly shifting royal-navy
 * gradient, a warm gold glow, drifting gold and blue orbs, cream sparkles and a gold lotus pattern.
 */
export function AmbientBackground() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-[#001a38]">
      <div className="bg-animated absolute inset-0" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(230,184,79,0.28),_transparent_55%),radial-gradient(ellipse_at_bottom_right,_rgba(51,104,173,0.35),_transparent_60%)]" />
      <div className="absolute inset-0 pattern-mandala opacity-[0.10]" />
      <div className="sparkles absolute inset-0 opacity-80" />
      <div className="orb orb-gold -left-24 top-10 h-80 w-80" />
      <div className="orb orb-rose -right-20 top-1/3 h-96 w-96" />
      <div className="orb orb-teal bottom-0 left-1/3 h-80 w-80" />
      <div className="orb orb-violet top-2/3 -left-10 h-72 w-72" />
      <div className="orb orb-sky -right-10 bottom-10 h-72 w-72" />
    </div>
  );
}
