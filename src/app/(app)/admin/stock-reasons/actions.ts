"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/permissions";

const MANAGE_ROLES = [Role.ADMIN, Role.MANAGER];

const reasonSchema = z.object({
  label: z.string().trim().min(1, "Le libellé est obligatoire"),
});

export async function createStockReason(formData: FormData) {
  await requireRole(MANAGE_ROLES);
  const parsed = reasonSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Formulaire invalide");
  }
  const { label } = parsed.data;

  const clash = await prisma.stockMovementReason.findUnique({
    where: { label },
  });
  if (clash) {
    throw new Error(`Le motif "${label}" existe déjà.`);
  }

  await prisma.stockMovementReason.create({ data: { label } });
  revalidatePath("/admin/stock-reasons");
  revalidatePath("/stock");
}

export async function updateStockReason(formData: FormData) {
  await requireRole(MANAGE_ROLES);
  const id = String(formData.get("id") ?? "");
  if (!id) throw new Error("Motif introuvable.");
  const parsed = reasonSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Formulaire invalide");
  }
  const { label } = parsed.data;

  const clash = await prisma.stockMovementReason.findFirst({
    where: { label, NOT: { id } },
  });
  if (clash) {
    throw new Error(`Le motif "${label}" est déjà utilisé.`);
  }

  await prisma.stockMovementReason.update({ where: { id }, data: { label } });
  revalidatePath("/admin/stock-reasons");
  revalidatePath("/stock");
}

export async function deleteStockReason(formData: FormData) {
  await requireRole(MANAGE_ROLES);
  const id = String(formData.get("id") ?? "");
  if (!id) throw new Error("Motif introuvable.");

  await prisma.stockMovementReason.delete({ where: { id } });
  revalidatePath("/admin/stock-reasons");
  revalidatePath("/stock");
}
