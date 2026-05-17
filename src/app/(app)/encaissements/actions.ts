"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { SalesOrderStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/permissions";
import { orderTotals } from "@/lib/totals";

const paymentSchema = z.object({
  salesOrderId: z.string().min(1),
  amountTtc: z
    .string()
    .trim()
    .min(1, "Le montant est obligatoire")
    .transform((v) => Number(v.replace(",", ".")))
    .pipe(z.number().positive("Le montant doit être positif")),
  method: z.string().trim().min(1, "Le mode de paiement est obligatoire"),
  paidAt: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v ? new Date(v) : new Date())),
  notes: z
    .string()
    .trim()
    .transform((v) => (v === "" ? undefined : v))
    .optional(),
});

const round = (n: number) => Math.round(n * 100) / 100;

export async function createPayment(formData: FormData) {
  const user = await requireUser();
  const parsed = paymentSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Formulaire invalide");
  }
  const { salesOrderId, amountTtc, method, paidAt, notes } = parsed.data;

  const order = await prisma.salesOrder.findUnique({
    where: { id: salesOrderId },
    select: {
      status: true,
      lines: { select: { quantity: true, unitPriceHt: true, vatRate: true } },
      payments: { select: { amountTtc: true } },
    },
  });
  if (!order) throw new Error("Commande introuvable.");
  if (order.status !== SalesOrderStatus.INVOICED) {
    throw new Error("Seules les commandes facturées peuvent être encaissées.");
  }

  // Vérifie que le mode existe parmi les libellés configurés.
  const knownMethod = await prisma.paymentMethod.findUnique({
    where: { label: method },
    select: { id: true },
  });
  if (!knownMethod) {
    throw new Error(
      `Mode "${method}" inconnu. Ajoutez-le dans Admin > Modes de paiement.`,
    );
  }

  const totals = orderTotals(order.lines);
  const alreadyPaid = order.payments.reduce((s, p) => s + p.amountTtc, 0);
  const remaining = round(totals.ttc - alreadyPaid);
  if (amountTtc > remaining + 0.01) {
    throw new Error(
      `Montant supérieur à l'encours restant (${remaining.toFixed(2)} €).`,
    );
  }

  // HT proratisé selon le ratio HT/TTC de la commande (cas plusieurs TVA).
  const ratio = totals.ttc === 0 ? 1 : totals.ht / totals.ttc;
  const amountHt = round(amountTtc * ratio);

  await prisma.payment.create({
    data: {
      salesOrderId,
      amountHt,
      amountTtc: round(amountTtc),
      method,
      paidAt,
      notes,
      createdById: user.id,
    },
  });

  revalidatePath("/encaissements");
  revalidatePath(`/sales-orders/${salesOrderId}`);
  revalidatePath("/");
}

export async function deletePayment(formData: FormData) {
  await requireUser();
  const id = String(formData.get("id") ?? "");
  if (!id) throw new Error("Encaissement introuvable.");

  const payment = await prisma.payment.findUnique({
    where: { id },
    select: { salesOrderId: true },
  });
  await prisma.payment.delete({ where: { id } });

  revalidatePath("/encaissements");
  if (payment) revalidatePath(`/sales-orders/${payment.salesOrderId}`);
  revalidatePath("/");
}
