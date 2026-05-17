import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const PARIS_TZ = "Europe/Paris";

export function formatDate(date: Date | string | null | undefined) {
  if (!date) return "—";
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: PARIS_TZ,
  }).format(d);
}

export function formatDateTime(date: Date | string | null | undefined) {
  if (!date) return "—";
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: PARIS_TZ,
  }).format(d);
}

export function formatEuro(amount: number | null | undefined) {
  if (amount == null) return "—";
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
  }).format(amount);
}

export function formatNumber(n: number | null | undefined) {
  if (n == null) return "—";
  return new Intl.NumberFormat("fr-FR").format(n);
}

export const DEFAULT_VAT_RATE = 0.2;

export function htToTtc(ht: number | null | undefined, vatRate = DEFAULT_VAT_RATE) {
  if (ht == null) return null;
  return Math.round(ht * (1 + vatRate) * 100) / 100;
}

// Marge brute en EUR et en % à partir des prix HT. Renvoie null si l'un des
// deux prix manque.
export function margin(
  purchaseHt: number | null | undefined,
  saleHt: number | null | undefined,
) {
  if (purchaseHt == null || saleHt == null) return null;
  const value = Math.round((saleHt - purchaseHt) * 100) / 100;
  const pct = saleHt === 0 ? 0 : Math.round((value / saleHt) * 1000) / 10;
  return { value, pct };
}

// Palette pastel pour les chips de catégorie : on hash le libellé pour assigner
// une teinte stable à chaque catégorie, indépendamment de sa position en base.
const CATEGORY_TONES = [
  "border-rose-300 bg-rose-100 text-rose-800",
  "border-amber-300 bg-amber-100 text-amber-800",
  "border-emerald-300 bg-emerald-100 text-emerald-800",
  "border-sky-300 bg-sky-100 text-sky-800",
  "border-violet-300 bg-violet-100 text-violet-800",
  "border-fuchsia-300 bg-fuchsia-100 text-fuchsia-800",
  "border-orange-300 bg-orange-100 text-orange-800",
  "border-teal-300 bg-teal-100 text-teal-800",
  "border-indigo-300 bg-indigo-100 text-indigo-800",
  "border-lime-300 bg-lime-100 text-lime-800",
];

export function categoryTone(key: string | null | undefined) {
  if (!key) return "border-slate-300 bg-slate-100 text-slate-700";
  let h = 0;
  for (let i = 0; i < key.length; i++) {
    h = (h * 31 + key.charCodeAt(i)) | 0;
  }
  return CATEGORY_TONES[Math.abs(h) % CATEGORY_TONES.length];
}

export function slugify(input: string) {
  return input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}
