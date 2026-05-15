import Link from "next/link";

type Tone = "default" | "success" | "warning" | "danger" | "info";

const ACCENT: Record<Tone, string> = {
  default: "text-teal-300",
  success: "text-emerald-300",
  warning: "text-amber-100",
  danger: "text-rose-100",
  info: "text-sky-100",
};

const RING: Record<Tone, string> = {
  default: "ring-teal-500/20",
  success: "ring-emerald-500/30",
  warning: "ring-amber-400/40",
  danger: "ring-rose-300/40",
  info: "ring-sky-300/40",
};

// Couleur de la tuile : navy par défaut, vert sombre pour "success", orange
// pour "warning", rouge sombre pour "danger", bleu azur pour "info". Les
// teintes -900 / sky-700 restent lisibles sous l'overlay scanlines.
const BG: Record<Tone, string> = {
  default: "bg-[#0B1F3A]",
  success: "bg-emerald-900",
  warning: "bg-[#7C3A09]",
  danger: "bg-red-900",
  info: "bg-sky-700",
};

const GLOW: Record<Tone, string> = {
  default: "0 0 12px rgba(20,184,166,0.35)",
  success: "0 0 12px rgba(16,185,129,0.35)",
  warning: "0 0 12px rgba(251,146,60,0.55)",
  danger: "0 0 12px rgba(244,63,94,0.35)",
  info: "0 0 12px rgba(56,189,248,0.45)",
};

// Odomètre numérique : chiffres en monospace lumineux sur fond navy. Le
// suffixe reste lisible mais discret grâce à text-current/60.
export function DigitalReadout({
  label,
  value,
  href,
  tone = "default",
  icon,
}: {
  label: string;
  value: React.ReactNode;
  href?: string;
  tone?: Tone;
  icon?: React.ReactNode;
}) {
  const accent = ACCENT[tone];
  const ring = RING[tone];
  const bg = BG[tone];
  const glow = GLOW[tone];

  const card = (
    <div
      className={`relative flex h-full min-h-[140px] flex-col overflow-hidden rounded-lg ${bg} p-5 text-white shadow-lg ring-1 ${ring} transition-all hover:-translate-y-0.5`}
    >
      {/* Subtle scanlines effect to evoke an LCD screen */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.06]"
        style={{
          backgroundImage:
            "repeating-linear-gradient(0deg, rgba(255,255,255,0.4) 0px, rgba(255,255,255,0.4) 1px, transparent 1px, transparent 3px)",
        }}
      />
      <div className="relative flex items-center justify-between gap-2">
        <span className="text-[10px] uppercase tracking-[0.2em] text-slate-400">
          {label}
        </span>
        {icon && <span className="text-slate-400">{icon}</span>}
      </div>
      <div
        className={`relative mt-auto pt-3 font-mono text-3xl font-semibold tabular-nums ${accent}`}
        style={{ textShadow: glow }}
      >
        {value}
      </div>
    </div>
  );

  return href ? (
    <Link href={href} className="block h-full">
      {card}
    </Link>
  ) : (
    card
  );
}
