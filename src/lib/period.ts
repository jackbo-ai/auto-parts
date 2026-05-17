// Périodes proposées sur le tableau de bord, type Getaround Fleet.
// `null` = pas de filtre date (tout l'historique).
export const PERIOD_RANGES = ["7d", "30d", "month", "year", "all"] as const;

export type PeriodRange = (typeof PERIOD_RANGES)[number];

export const DEFAULT_PERIOD: PeriodRange = "30d";

export const PERIOD_LABELS: Record<PeriodRange, string> = {
  "7d": "7 jours",
  "30d": "30 jours",
  month: "Ce mois",
  year: "Cette année",
  all: "Tout",
};

export function parsePeriod(value: string | undefined): PeriodRange {
  return (PERIOD_RANGES as readonly string[]).includes(value ?? "")
    ? (value as PeriodRange)
    : DEFAULT_PERIOD;
}

// Renvoie la date de début (incluse) pour la période donnée, ou null si "all".
export function periodStart(range: PeriodRange, now: Date = new Date()): Date | null {
  const d = new Date(now);
  switch (range) {
    case "7d":
      d.setDate(d.getDate() - 7);
      return d;
    case "30d":
      d.setDate(d.getDate() - 30);
      return d;
    case "month":
      return new Date(now.getFullYear(), now.getMonth(), 1);
    case "year":
      return new Date(now.getFullYear(), 0, 1);
    case "all":
    default:
      return null;
  }
}
