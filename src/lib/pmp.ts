import { PurchaseOrderStatus, SalesOrderStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";

// Ni le coût d'achat ni le prix de vente d'une pièce ne sont figés : ils
// dépendent de la date et du prix négocié à chaque commande. On ne stocke
// donc pas de valeur figée, on les déduit de l'historique des commandes
// (achats réceptionnés, ventes livrées/facturées) et on calcule un PMP
// (Prix Moyen Pondéré / CUMP) à la date de consultation.

export type PriceEntry = {
  date: Date;
  quantity: number;
  unitPriceHt: number;
};

export type CostHistoryEntry = PriceEntry & {
  purchaseOrderId: string;
  reference: string;
};

export type SalePriceHistoryEntry = PriceEntry & {
  salesOrderId: string;
  reference: string;
};

// Les ventes considérées « réelles » : livrées ou facturées — cohérent avec
// le CA client du tableau de bord.
const SALE_PMP_STATUSES = [
  SalesOrderStatus.DELIVERED,
  SalesOrderStatus.INVOICED,
];

// PMP à une date donnée : moyenne des prix unitaires pondérée par les
// quantités, sur toutes les entrées dont la date est <= atDate. Renvoie
// null si aucune entrée ne précède la date (prix pas encore connu).
export function weightedAveragePrice(
  entries: PriceEntry[],
  atDate: Date = new Date(),
): number | null {
  let totalQty = 0;
  let totalValue = 0;
  for (const e of entries) {
    if (e.date.getTime() > atDate.getTime()) continue;
    totalQty += e.quantity;
    totalValue += e.quantity * e.unitPriceHt;
  }
  if (totalQty <= 0) return null;
  return Math.round((totalValue / totalQty) * 100) / 100;
}

// Historique des coûts d'achat d'une pièce : une entrée par ligne de commande
// d'achat réceptionnée, datée à la date de commande, du plus ancien au plus
// récent.
export async function partCostHistory(
  partId: string,
): Promise<CostHistoryEntry[]> {
  const lines = await prisma.purchaseOrderLine.findMany({
    where: {
      partId,
      purchaseOrder: { status: PurchaseOrderStatus.RECEIVED },
    },
    select: {
      quantity: true,
      unitPriceHt: true,
      purchaseOrder: {
        select: { id: true, reference: true, orderDate: true },
      },
    },
  });
  return lines
    .map((l) => ({
      date: l.purchaseOrder.orderDate,
      quantity: l.quantity,
      unitPriceHt: l.unitPriceHt,
      purchaseOrderId: l.purchaseOrder.id,
      reference: l.purchaseOrder.reference,
    }))
    .sort((a, b) => a.date.getTime() - b.date.getTime());
}

// Historique des prix de vente d'une pièce : une entrée par ligne de commande
// client livrée/facturée, datée à la date de commande, du plus ancien au plus
// récent.
export async function partSalePriceHistory(
  partId: string,
): Promise<SalePriceHistoryEntry[]> {
  const lines = await prisma.salesOrderLine.findMany({
    where: {
      partId,
      salesOrder: { status: { in: SALE_PMP_STATUSES } },
    },
    select: {
      quantity: true,
      unitPriceHt: true,
      salesOrder: {
        select: { id: true, reference: true, orderDate: true },
      },
    },
  });
  return lines
    .map((l) => ({
      date: l.salesOrder.orderDate,
      quantity: l.quantity,
      unitPriceHt: l.unitPriceHt,
      salesOrderId: l.salesOrder.id,
      reference: l.salesOrder.reference,
    }))
    .sort((a, b) => a.date.getTime() - b.date.getTime());
}

// PMP d'achat de toutes les pièces en une seule requête — pour les listes
// catalogue.
export async function partsPmpMap(
  atDate: Date = new Date(),
): Promise<Map<string, number>> {
  const lines = await prisma.purchaseOrderLine.findMany({
    where: { purchaseOrder: { status: PurchaseOrderStatus.RECEIVED } },
    select: {
      partId: true,
      quantity: true,
      unitPriceHt: true,
      purchaseOrder: { select: { orderDate: true } },
    },
  });
  const byPart = new Map<string, PriceEntry[]>();
  for (const l of lines) {
    const arr = byPart.get(l.partId) ?? [];
    arr.push({
      date: l.purchaseOrder.orderDate,
      quantity: l.quantity,
      unitPriceHt: l.unitPriceHt,
    });
    byPart.set(l.partId, arr);
  }
  const result = new Map<string, number>();
  for (const [partId, entries] of byPart) {
    const pmp = weightedAveragePrice(entries, atDate);
    if (pmp !== null) result.set(partId, pmp);
  }
  return result;
}

// PMP d'achat TTC de toutes les pièces — chaque ligne d'achat est pondérée
// avec sa propre TVA, donc on retombe sur la valeur effectivement payée.
export async function partsPmpTtcMap(
  atDate: Date = new Date(),
): Promise<Map<string, number>> {
  const lines = await prisma.purchaseOrderLine.findMany({
    where: { purchaseOrder: { status: PurchaseOrderStatus.RECEIVED } },
    select: {
      partId: true,
      quantity: true,
      unitPriceHt: true,
      vatRate: true,
      purchaseOrder: { select: { orderDate: true } },
    },
  });
  const byPart = new Map<string, PriceEntry[]>();
  for (const l of lines) {
    const arr = byPart.get(l.partId) ?? [];
    arr.push({
      date: l.purchaseOrder.orderDate,
      quantity: l.quantity,
      unitPriceHt: l.unitPriceHt * (1 + l.vatRate),
    });
    byPart.set(l.partId, arr);
  }
  const result = new Map<string, number>();
  for (const [partId, entries] of byPart) {
    const pmp = weightedAveragePrice(entries, atDate);
    if (pmp !== null) result.set(partId, pmp);
  }
  return result;
}

// PMP de vente de toutes les pièces en une seule requête — pour les listes
// catalogue.
export async function partsSalePmpMap(
  atDate: Date = new Date(),
): Promise<Map<string, number>> {
  const lines = await prisma.salesOrderLine.findMany({
    where: { salesOrder: { status: { in: SALE_PMP_STATUSES } } },
    select: {
      partId: true,
      quantity: true,
      unitPriceHt: true,
      salesOrder: { select: { orderDate: true } },
    },
  });
  const byPart = new Map<string, PriceEntry[]>();
  for (const l of lines) {
    const arr = byPart.get(l.partId) ?? [];
    arr.push({
      date: l.salesOrder.orderDate,
      quantity: l.quantity,
      unitPriceHt: l.unitPriceHt,
    });
    byPart.set(l.partId, arr);
  }
  const result = new Map<string, number>();
  for (const [partId, entries] of byPart) {
    const pmp = weightedAveragePrice(entries, atDate);
    if (pmp !== null) result.set(partId, pmp);
  }
  return result;
}
