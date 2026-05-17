import {
  Ban,
  CheckCircle2,
  PackageCheck,
  Pencil,
  Receipt,
  ShoppingCart,
  type LucideIcon,
} from "lucide-react";
import { PurchaseOrderStatus, SalesOrderStatus } from "@prisma/client";

export const PURCHASE_STATUS_LABELS: Record<PurchaseOrderStatus, string> = {
  DRAFT: "Brouillon",
  ORDERED: "Commandée",
  RECEIVED: "Réceptionnée",
  CANCELLED: "Annulée",
};

export const SALES_STATUS_LABELS: Record<SalesOrderStatus, string> = {
  DRAFT: "Brouillon",
  CONFIRMED: "Confirmée",
  DELIVERED: "Livrée",
  INVOICED: "Facturée",
  CANCELLED: "Annulée",
};

// Classes Tailwind pour le badge de statut — partagées entre liste et détail.
export const PURCHASE_STATUS_BADGE: Record<PurchaseOrderStatus, string> = {
  DRAFT: "border-border bg-muted text-muted-foreground",
  ORDERED: "border-blue-300 bg-blue-100 text-blue-800",
  RECEIVED: "border-emerald-300 bg-emerald-100 text-emerald-800",
  CANCELLED: "border-destructive/30 bg-destructive/10 text-destructive",
};

export const SALES_STATUS_BADGE: Record<SalesOrderStatus, string> = {
  DRAFT: "border-border bg-muted text-muted-foreground",
  CONFIRMED: "border-blue-300 bg-blue-100 text-blue-800",
  DELIVERED: "border-amber-300 bg-amber-100 text-amber-800",
  INVOICED: "border-emerald-300 bg-emerald-100 text-emerald-800",
  CANCELLED: "border-destructive/30 bg-destructive/10 text-destructive",
};

// Icône matérialisant l'étape courante d'une commande pour la lecture rapide en
// tête de ligne. Couleurs déclinées en miroir des badges de statut.
export const PURCHASE_STATUS_ICON: Record<PurchaseOrderStatus, LucideIcon> = {
  DRAFT: Pencil,
  ORDERED: ShoppingCart,
  RECEIVED: PackageCheck,
  CANCELLED: Ban,
};

export const PURCHASE_STATUS_ICON_TONE: Record<PurchaseOrderStatus, string> = {
  DRAFT: "text-muted-foreground",
  ORDERED: "text-blue-700",
  RECEIVED: "text-emerald-700",
  CANCELLED: "text-destructive",
};

export const SALES_STATUS_ICON: Record<SalesOrderStatus, LucideIcon> = {
  DRAFT: Pencil,
  CONFIRMED: CheckCircle2,
  DELIVERED: PackageCheck,
  INVOICED: Receipt,
  CANCELLED: Ban,
};

export const SALES_STATUS_ICON_TONE: Record<SalesOrderStatus, string> = {
  DRAFT: "text-muted-foreground",
  CONFIRMED: "text-blue-700",
  DELIVERED: "text-amber-700",
  INVOICED: "text-emerald-700",
  CANCELLED: "text-destructive",
};

// Génère la prochaine référence séquentielle (ACH-0001, VTE-0001…) à partir
// du nombre de commandes déjà enregistrées. À appeler dans la transaction de
// création pour limiter les collisions.
export function buildReference(prefix: string, count: number) {
  return `${prefix}-${String(count + 1).padStart(4, "0")}`;
}
