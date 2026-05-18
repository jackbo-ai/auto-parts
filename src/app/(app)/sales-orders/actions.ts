"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import {
  PurchaseOrderStatus,
  Role,
  SalesOrderStatus,
  StockMovementType,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/permissions";
import { buildReference } from "@/lib/orders";
import { weightedAveragePrice } from "@/lib/pmp";
import { orderTotals } from "@/lib/totals";
import { nextCustomerAccountNumber } from "@/lib/customer-account";

const round = (n: number) => Math.round(n * 100) / 100;
const formatEur = (n: number) =>
  new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(n);

const MANAGE_ROLES = [Role.ADMIN, Role.MANAGER];

// Renvoie l'utilisateur vers une page en y affichant un message d'erreur,
// plutôt que de laisser un throw remonter en écran de crash. `redirect`
// interrompt l'exécution (il lève en interne), d'où le type `never`.
function failTo(path: string, message: string): never {
  redirect(`${path}?error=${encodeURIComponent(message)}`);
}

const optionalText = z
  .string()
  .transform((v) => v.trim())
  .transform((v) => (v === "" ? undefined : v))
  .optional();

const createSchema = z.object({
  customerName: z.string().trim().min(1, "Le nom du client est obligatoire"),
  customerEmail: optionalText,
  customerPhone: optionalText,
  notes: optionalText,
  licensePlate: optionalText,
});

export async function createSalesOrder(formData: FormData) {
  const user = await requireRole(MANAGE_ROLES);
  const parsed = createSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    failTo(
      "/sales-orders/new",
      parsed.error.issues[0]?.message ?? "Formulaire invalide",
    );
  }
  const { customerName, customerEmail, customerPhone, notes, licensePlate } =
    parsed.data;

  const order = await prisma.$transaction(async (tx) => {
    // Résolution du client : match exact (insensible à la casse) sur le nom,
    // sinon création à la volée avec un numéro de compte auto-attribué.
    const existing = await tx.customer.findFirst({
      where: { name: { equals: customerName } },
      select: { id: true },
    });
    let customerId = existing?.id;
    if (!customerId) {
      const accountNumber = await nextCustomerAccountNumber(tx);
      const created = await tx.customer.create({
        data: {
          name: customerName,
          email: customerEmail ?? null,
          phone: customerPhone ?? null,
          accountNumber,
        },
        select: { id: true },
      });
      customerId = created.id;
    }

    const count = await tx.salesOrder.count();
    return tx.salesOrder.create({
      data: {
        reference: buildReference("VTE", count),
        customerId,
        notes,
        licensePlate,
        createdById: user.id,
      },
    });
  });

  revalidatePath("/sales-orders");
  revalidatePath("/admin/customers");
  redirect(`/sales-orders/${order.id}`);
}

const lineSchema = z.object({
  salesOrderId: z.string().min(1),
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

export async function addSalesLine(formData: FormData) {
  await requireRole(MANAGE_ROLES);
  const salesOrderId = String(formData.get("salesOrderId") ?? "");
  const backPath = salesOrderId
    ? `/sales-orders/${salesOrderId}`
    : "/sales-orders";

  const parsed = lineSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    failTo(backPath, parsed.error.issues[0]?.message ?? "Formulaire invalide");
  }
  const { partId, quantity, unitPriceHt, vatRate } = parsed.data;

  const order = await prisma.salesOrder.findUnique({
    where: { id: salesOrderId },
    select: { status: true },
  });
  if (!order) failTo(backPath, "Commande introuvable.");
  if (order.status !== SalesOrderStatus.DRAFT) {
    failTo(backPath, "Les lignes ne sont modifiables qu'en brouillon.");
  }

  await prisma.salesOrderLine.create({
    data: {
      salesOrderId,
      partId,
      quantity,
      unitPriceHt,
      vatRate: vatRate / 100,
    },
  });
  revalidatePath(`/sales-orders/${salesOrderId}`);
}

export async function removeSalesLine(formData: FormData) {
  await requireRole(MANAGE_ROLES);
  const id = String(formData.get("id") ?? "");
  const salesOrderId = String(formData.get("salesOrderId") ?? "");
  const backPath = salesOrderId
    ? `/sales-orders/${salesOrderId}`
    : "/sales-orders";
  if (!id) failTo(backPath, "Ligne introuvable.");

  const line = await prisma.salesOrderLine.findUnique({
    where: { id },
    select: { salesOrder: { select: { status: true } } },
  });
  if (!line) failTo(backPath, "Ligne introuvable.");
  if (line.salesOrder.status !== SalesOrderStatus.DRAFT) {
    failTo(backPath, "Les lignes ne sont modifiables qu'en brouillon.");
  }

  await prisma.salesOrderLine.delete({ where: { id } });
  if (salesOrderId) revalidatePath(`/sales-orders/${salesOrderId}`);
}

export async function markSalesConfirmed(formData: FormData) {
  await requireRole(MANAGE_ROLES);
  const id = String(formData.get("id") ?? "");
  if (!id) failTo("/sales-orders", "Commande introuvable.");
  const backPath = `/sales-orders/${id}`;

  const order = await prisma.salesOrder.findUnique({
    where: { id },
    select: { status: true, _count: { select: { lines: true } } },
  });
  if (!order) failTo(backPath, "Commande introuvable.");
  if (order.status !== SalesOrderStatus.DRAFT) {
    failTo(backPath, "Seul un brouillon peut être confirmé.");
  }
  if (order._count.lines === 0) {
    failTo(backPath, "Ajoutez au moins une ligne avant de confirmer.");
  }

  await prisma.salesOrder.update({
    where: { id },
    data: { status: SalesOrderStatus.CONFIRMED },
  });
  revalidatePath("/sales-orders");
  revalidatePath(`/sales-orders/${id}`);
}

// Livraison : passe la commande en DELIVERED, crée un mouvement de sortie par
// ligne et fige le coût d'achat unitaire (pour le calcul de marge), le tout
// dans la même transaction. Si le stock est insuffisant, la transaction est
// annulée et l'utilisateur est renvoyé vers la commande avec le message.
export async function deliverSalesOrder(formData: FormData) {
  const user = await requireRole(MANAGE_ROLES);
  const id = String(formData.get("id") ?? "");
  if (!id) failTo("/sales-orders", "Commande introuvable.");
  const backPath = `/sales-orders/${id}`;

  try {
    await prisma.$transaction(async (tx) => {
      const order = await tx.salesOrder.findUnique({
        where: { id },
        include: { lines: true },
      });
      if (!order) throw new Error("Commande introuvable.");
      if (order.status !== SalesOrderStatus.CONFIRMED) {
        throw new Error("Seule une commande confirmée peut être livrée.");
      }

      // Garde-fou crédit client : si une limite est fixée, on refuse la
      // livraison dès lors que l'encours actuel (commandes facturées non
      // soldées) + le TTC de cette commande dépasserait la limite.
      const customer = await tx.customer.findUnique({
        where: { id: order.customerId },
        select: {
          name: true,
          creditLimit: true,
          salesOrders: {
            where: { status: SalesOrderStatus.INVOICED },
            select: {
              lines: { select: { quantity: true, unitPriceHt: true, vatRate: true } },
              payments: { select: { amountTtc: true } },
            },
          },
        },
      });
      if (customer?.creditLimit != null) {
        const encours = round(
          customer.salesOrders.reduce((sum, o) => {
            const total = orderTotals(o.lines).ttc;
            const paid = o.payments.reduce((s, p) => s + p.amountTtc, 0);
            return sum + Math.max(0, total - paid);
          }, 0),
        );
        const orderTtc = orderTotals(order.lines).ttc;
        const projected = round(encours + orderTtc);
        if (projected > customer.creditLimit + 0.01) {
          throw new Error(
            `Livraison bloquée : l'encours du client ${customer.name} (${formatEur(encours)}) ` +
              `et le TTC de cette commande (${formatEur(orderTtc)}) dépasseraient la limite de ` +
              `${formatEur(customer.creditLimit)}. Encaissez les commandes ouvertes avant de livrer.`,
          );
        }
      }

      for (const line of order.lines) {
        const part = await tx.part.findUnique({
          where: { id: line.partId },
          select: { reference: true, stockQty: true },
        });
        if (!part) throw new Error("Pièce introuvable sur une ligne.");

        const resulting = part.stockQty - line.quantity;
        if (resulting < 0) {
          throw new Error(
            `Stock insuffisant pour ${part.reference} : ${part.stockQty} en stock, ${line.quantity} demandé(s).`,
          );
        }

        await tx.stockMovement.create({
          data: {
            partId: line.partId,
            type: StockMovementType.OUT,
            quantity: -line.quantity,
            resulting,
            reason: `Livraison vente ${order.reference}`,
            createdById: user.id,
          },
        });
        await tx.part.update({
          where: { id: line.partId },
          data: { stockQty: resulting },
        });

        // Fige le coût d'achat unitaire au moment de la livraison : on prend le
        // PMP à date, calculé depuis l'historique des achats réceptionnés.
        // Reste null si la pièce n'a encore aucun achat réceptionné.
        const costLines = await tx.purchaseOrderLine.findMany({
          where: {
            partId: line.partId,
            purchaseOrder: { status: PurchaseOrderStatus.RECEIVED },
          },
          select: {
            quantity: true,
            unitPriceHt: true,
            purchaseOrder: { select: { orderDate: true } },
          },
        });
        const pmp = weightedAveragePrice(
          costLines.map((c) => ({
            quantity: c.quantity,
            unitPriceHt: c.unitPriceHt,
            date: c.purchaseOrder.orderDate,
          })),
        );
        await tx.salesOrderLine.update({
          where: { id: line.id },
          data: { unitCostHt: pmp },
        });
      }

      await tx.salesOrder.update({
        where: { id },
        data: {
          status: SalesOrderStatus.DELIVERED,
          deliveredAt: new Date(),
        },
      });
    });
  } catch (error) {
    failTo(
      backPath,
      error instanceof Error ? error.message : "Échec de la livraison.",
    );
  }

  revalidatePath("/sales-orders");
  revalidatePath(`/sales-orders/${id}`);
  revalidatePath("/stock");
  revalidatePath("/");
}

export async function invoiceSalesOrder(formData: FormData) {
  await requireRole(MANAGE_ROLES);
  const id = String(formData.get("id") ?? "");
  if (!id) failTo("/sales-orders", "Commande introuvable.");
  const backPath = `/sales-orders/${id}`;

  const order = await prisma.salesOrder.findUnique({
    where: { id },
    select: { status: true },
  });
  if (!order) failTo(backPath, "Commande introuvable.");
  if (order.status !== SalesOrderStatus.DELIVERED) {
    failTo(backPath, "Seule une commande livrée peut être facturée.");
  }

  await prisma.salesOrder.update({
    where: { id },
    data: { status: SalesOrderStatus.INVOICED, invoicedAt: new Date() },
  });
  revalidatePath("/sales-orders");
  revalidatePath(`/sales-orders/${id}`);
  revalidatePath("/");
}

export async function cancelSalesOrder(formData: FormData) {
  await requireRole(MANAGE_ROLES);
  const id = String(formData.get("id") ?? "");
  if (!id) failTo("/sales-orders", "Commande introuvable.");
  const backPath = `/sales-orders/${id}`;

  const order = await prisma.salesOrder.findUnique({
    where: { id },
    select: { status: true },
  });
  if (!order) failTo(backPath, "Commande introuvable.");
  if (
    order.status !== SalesOrderStatus.DRAFT &&
    order.status !== SalesOrderStatus.CONFIRMED
  ) {
    failTo(backPath, "Cette commande ne peut plus être annulée.");
  }

  await prisma.salesOrder.update({
    where: { id },
    data: { status: SalesOrderStatus.CANCELLED },
  });
  revalidatePath("/sales-orders");
  revalidatePath(`/sales-orders/${id}`);
}

export async function deleteSalesOrder(formData: FormData) {
  await requireRole(MANAGE_ROLES);
  const id = String(formData.get("id") ?? "");
  if (!id) failTo("/sales-orders", "Commande introuvable.");
  const backPath = `/sales-orders/${id}`;

  const order = await prisma.salesOrder.findUnique({
    where: { id },
    select: { status: true },
  });
  if (!order) failTo(backPath, "Commande introuvable.");
  if (
    order.status === SalesOrderStatus.DELIVERED ||
    order.status === SalesOrderStatus.INVOICED
  ) {
    failTo(
      backPath,
      "Une commande livrée ou facturée ne peut pas être supprimée (le stock a déjà été mouvementé).",
    );
  }

  // Les lignes sont supprimées en cascade (voir schema).
  await prisma.salesOrder.delete({ where: { id } });
  revalidatePath("/sales-orders");
  redirect("/sales-orders");
}
