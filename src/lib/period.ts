import { formatDate } from "@/lib/utils";

// Périodes proposées sur le tableau de bord, type Getaround Fleet.
// `null` = pas de filtre date (tout l'historique).
export const PERIOD_RANGES = [
  "7d",
  "30d",
  "month",
  "year",
  "all",
  "custom",
] as const;

export type PeriodRange = (typeof PERIOD_RANGES)[number];

// Les presets affichés en boutons (l'option « custom » est gérée à part par
// le sélecteur de dates).
export const PRESET_RANGES: PeriodRange[] = [
  "7d",
  "30d",
  "month",
  "year",
  "all",
];

export const DEFAULT_PERIOD: PeriodRange = "30d";

export const PERIOD_LABELS: Record<PeriodRange, string> = {
  "7d": "7 jours",
  "30d": "30 jours",
  month: "Ce mois",
  year: "Cette année",
  all: "Tout",
  custom: "Personnalisé",
};

export function parsePeriod(value: string | undefined): PeriodRange {
  return (PERIOD_RANGES as readonly string[]).includes(value ?? "")
    ? (value as PeriodRange)
    : DEFAULT_PERIOD;
}

export type PeriodBounds = { start: Date | null; end: Date | null };

// Lit une date au format yyyy-MM-dd telle que rendue par <input type="date">.
// Renvoie null si la chaîne est vide ou invalide. `endOfDay` cale la borne sur
// 23:59:59.999 pour rendre l'intervalle inclusif côté supérieur.
function parseISODate(value: string | undefined, endOfDay = false): Date | null {
  if (!value) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!m) return null;
  const [, y, mo, d] = m;
  const date = new Date(
    Number(y),
    Number(mo) - 1,
    Number(d),
    endOfDay ? 23 : 0,
    endOfDay ? 59 : 0,
    endOfDay ? 59 : 0,
    endOfDay ? 999 : 0,
  );
  return Number.isNaN(date.getTime()) ? null : date;
}

// Renvoie les bornes (incluses) pour la période demandée. start/end peuvent
// être null pour signaler une borne ouverte.
export function periodBounds(
  range: PeriodRange,
  custom: { from?: string; to?: string } = {},
  now: Date = new Date(),
): PeriodBounds {
  const d = new Date(now);
  switch (range) {
    case "7d":
      d.setDate(d.getDate() - 7);
      return { start: d, end: null };
    case "30d":
      d.setDate(d.getDate() - 30);
      return { start: d, end: null };
    case "month":
      return { start: new Date(now.getFullYear(), now.getMonth(), 1), end: null };
    case "year":
      return { start: new Date(now.getFullYear(), 0, 1), end: null };
    case "custom":
      return {
        start: parseISODate(custom.from),
        end: parseISODate(custom.to, true),
      };
    case "all":
    default:
      return { start: null, end: null };
  }
}

// Libellé humain de la période courante — utilisé sous le titre et dans les
// en-têtes de cartes.
export function describePeriod(
  range: PeriodRange,
  bounds: PeriodBounds,
): string {
  if (range !== "custom") return PERIOD_LABELS[range];
  const { start, end } = bounds;
  if (start && end) return `Du ${formatDate(start)} au ${formatDate(end)}`;
  if (start) return `Depuis le ${formatDate(start)}`;
  if (end) return `Jusqu'au ${formatDate(end)}`;
  return PERIOD_LABELS.custom;
}
