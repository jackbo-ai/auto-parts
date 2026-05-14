"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { PurchaseOrderStatus, Role, StockMovementType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/permissions";
import { buildReference } from "@/lib/orders";

const MANAGE_ROLES = [Role.ADMIN, Role.MANAGER];

const optionalDate = z
  .string()
  .transform((v) => v.trim())
  .transform((v) => (v === "" ? null : new Date(v)))
  .refine((d) => d === null || !Number.isNaN(d.getTime()), "Date invalide");

const optionalText = z
  .string()
  .transform((v) => v.trim())
  .transform((v) => (v === "" ? undefined : v))
  .optional();

const createSchema = z.object({
  supplierId: z.string().min(1, "Le fournisseur est obligatoire"),
  expectedAt: optionalDate,
  notes: optionalText,
});

export async function createPurchaseOrder(formData: FormData) {
  const user = await requireRole(MANAGE_ROLES);
  const parsed = createSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Formulaire invalide");
  }

  const order = await prisma.$transaction(async (tx) => {
    const count = await tx.purchaseOrder.count();
    return tx.purchaseOrder.create({
      data: {
        reference: buildReference("ACH", count),
        supplierId: parsed.data.supplierId,
        expectedAt: parsed.data.expectedAt,
        notes: parsed.data.notes,
        createdById: user.id,
      },
    });
  });

  revalidatePath("/purchase-orders");
  redirect(`/purchase-orders/${order.id}`);
}

const lineSchema = z.object({
  purchaseOrderId: z.string().min(1),
  partId: z.string().min(1, "La pièce est obligatoire"),
  quantity: z
    .string()
    .trim()
    .min(1, "La quantité est obligatoire")
    .transform((v) => Number(v))
    .pipe(z.number().int().positive("La quantité doit être positive")),
  unitPriceHt: z
    .string()
    .trim()
    .min(1, "Le prix unitaire est obligatoire")
    .transform((v) => Number(v))
    .pipe(z.number().nonnegative("Le prix doit être positif")),
  vatRate: z
    .string()
    .trim()
    .transform((v) => (v === "" ? 20 : Number(v)))
    .pipe(z.number().min(0).max(100)),
});

export async function addPurchaseLine(formData: FormData) {
  await requireRole(MANAGE_ROLES);
  const parsed = lineSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Formulaire invalide");
  }
  const { purchaseOrderId, partId, quantity, unitPriceHt, vatRate } = parsed.data;

  const order = await prisma.purchaseOrder.findUnique({
    where: { id: purchaseOrderId },
    select: { status: true },
  });
  if (!order) throw new Error("Commande introuvable.");
  if (order.status !== PurchaseOrderStatus.DRAFT) {
    throw new Error("Les lignes ne sont modifiables qu'en brouillon.");
  }

  await prisma.purchaseOrderLine.create({
    data: {
      purchaseOrderId,
      partId,
      quantity,
      unitPriceHt,
      vatRate: vatRate / 100,
    },
  });
  revalidatePath(`/purchase-orders/${purchaseOrderId}`);
}

export async function removePurchaseLine(formData: FormData) {
  await requireRole(MANAGE_ROLES);
  const id = String(formData.get("id") ?? "");
  const purchaseOrderId = String(formData.get("purchaseOrderId") ?? "");
  if (!id) throw new Error("Ligne introuvable.");

  const line = await prisma.purchaseOrderLine.findUnique({
    where: { id },
    select: { purchaseOrder: { select: { status: true } } },
  });
  if (!line) throw new Error("Ligne introuvable.");
  if (line.purchaseOrder.status !== PurchaseOrderStatus.DRAFT) {
    throw new Error("Les lignes ne sont modifiables qu'en brouillon.");
  }

  await prisma.purchaseOrderLine.delete({ where: { id } });
  if (purchaseOrderId) revalidatePath(`/purchase-orders/${purchaseOrderId}`);
}

export async function markPurchaseOrdered(formData: FormData) {
  await requireRole(MANAGE_ROLES);
  const id = String(formData.get("id") ?? "");
  if (!id) throw new Error("Commande introuvable.");

  const order = await prisma.purchaseOrder.findUnique({
    where: { id },
    select: { status: true, _count: { select: { lines: true } } },
  });
  if (!order) throw new Error("Commande introuvable.");
  if (order.status !== PurchaseOrderStatus.DRAFT) {
    throw new Error("Seul un brouillon peut être validé.");
  }
  if (order._count.lines === 0) {
    throw new Error("Ajoutez au moins une ligne avant de valider.");
  }

  await prisma.purchaseOrder.update({
    where: { id },
    data: { status: PurchaseOrderStatus.ORDERED },
  });
  revalidatePath("/purchase-orders");
  revalidatePath(`/purchase-orders/${id}`);
}

// Réception : passe la commande en RECEIVED et crée un mouvement d'entrée
// par ligne, en mettant à jour le stock dénormalisé dans la même transaction.
export async function receivePurchaseOrder(formData: FormData) {
  const user = await requireRole(MANAGE_ROLES);
  const id = String(formData.get("id") ?? "");
  if (!id) throw new Error("Commande introuvable.");

  await prisma.$transaction(async (tx) => {
    const order = await tx.purchaseOrder.findUnique({
      where: { id },
      include: { lines: true },
    });
    if (!order) throw new Error("Commande introuvable.");
    if (order.status !== PurchaseOrderStatus.ORDERED) {
      throw new Error("Seule une commande envoyée peut être réceptionnée.");
    }

    for (const line of order.lines) {
      const part = await tx.part.findUnique({
        where: { id: line.partId },
        select: { stockQty: true },
      });
      if (!part) throw new Error("Pièce introuvable sur une ligne.");

      const resulting = part.stockQty + line.quantity;
      await tx.stockMovement.create({
        data: {
          partId: line.partId,
          type: StockMovementType.IN,
          quantity: line.quantity,
          resulting,
          reason: `Réception achat ${order.reference}`,
          createdById: user.id,
        },
      });
      await tx.part.update({
        where: { id: line.partId },
        data: { stockQty: resulting },
      });
    }

    await tx.purchaseOrder.update({
      where: { id },
      data: {
        status: PurchaseOrderStatus.RECEIVED,
        receivedAt: new Date(),
      },
    });
  });

  revalidatePath("/purchase-orders");
  revalidatePath(`/purchase-orders/${id}`);
  revalidatePath("/stock");
  revalidatePath("/");
}

export async function cancelPurchaseOrder(formData: FormData) {
  await requireRole(MANAGE_ROLES);
  const id = String(formData.get("id") ?? "");
  if (!id) throw new Error("Commande introuvable.");

  const order = await prisma.purchaseOrder.findUnique({
    where: { id },
    select: { status: true },
  });
  if (!order) throw new Error("Commande introuvable.");
  if (
    order.status !== PurchaseOrderStatus.DRAFT &&
    order.status !== PurchaseOrderStatus.ORDERED
  ) {
    throw new Error("Cette commande ne peut plus être annulée.");
  }

  await prisma.purchaseOrder.update({
    where: { id },
    data: { status: PurchaseOrderStatus.CANCELLED },
  });
  revalidatePath("/purchase-orders");
  revalidatePath(`/purchase-orders/${id}`);
}

export async function deletePurchaseOrder(formData: FormData) {
  await requireRole(MANAGE_ROLES);
  const id = String(formData.get("id") ?? "");
  if (!id) throw new Error("Commande introuvable.");

  const order = await prisma.purchaseOrder.findUnique({
    where: { id },
    select: { status: true },
  });
  if (!order) throw new Error("Commande introuvable.");
  if (order.status === PurchaseOrderStatus.RECEIVED) {
    throw new Error(
      "Une commande réceptionnée ne peut pas être supprimée (le stock a déjà été mouvementé).",
    );
  }

  // Les lignes sont supprimées en cascade (voir schema).
  await prisma.purchaseOrder.delete({ where: { id } });
  revalidatePath("/purchase-orders");
  redirect("/purchase-orders");
}
