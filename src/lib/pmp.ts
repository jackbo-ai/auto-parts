import { PurchaseOrderStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";

// Le coût d'achat d'une pièce est mouvant : il dépend de la date et du prix
// négocié à chaque commande. On ne stocke donc pas un coût figé, on le déduit
// de l'historique des commandes d'achat réceptionnées et on calcule un PMP
// (Prix Moyen Pondéré / CUMP) à la date de consultation.

export type CostEntry = {
  date: Date;
  quantity: number;
  unitPriceHt: number;
};

export type CostHistoryEntry = CostEntry & {
  purchaseOrderId: string;
  reference: string;
};

// PMP à une date donnée : moyenne des coûts d'achat unitaires pondérée par
// les quantités, sur toutes les entrées dont la date est <= atDate. Renvoie
// null si aucune entrée ne précède la date (coût pas encore connu).
export function weightedAverageCost(
  entries: CostEntry[],
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

// PMP de toutes les pièces en une seule requête — pour les listes catalogue.
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
  const byPart = new Map<string, CostEntry[]>();
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
    const pmp = weightedAverageCost(entries, atDate);
    if (pmp !== null) result.set(partId, pmp);
  }
  return result;
}
