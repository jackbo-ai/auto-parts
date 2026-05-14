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

export function slugify(input: string) {
  return input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}
