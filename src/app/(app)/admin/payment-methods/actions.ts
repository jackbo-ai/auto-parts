"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/permissions";

const MANAGE_ROLES = [Role.ADMIN, Role.MANAGER];

const methodSchema = z.object({
  label: z.string().trim().min(1, "Le libellé est obligatoire"),
});

export async function createPaymentMethod(formData: FormData) {
  await requireRole(MANAGE_ROLES);
  const parsed = methodSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Formulaire invalide");
  }
  const { label } = parsed.data;

  const clash = await prisma.paymentMethod.findUnique({ where: { label } });
  if (clash) throw new Error(`Le mode "${label}" existe déjà.`);

  await prisma.paymentMethod.create({ data: { label } });
  revalidatePath("/admin/payment-methods");
  revalidatePath("/encaissements");
}

export async function updatePaymentMethod(formData: FormData) {
  await requireRole(MANAGE_ROLES);
  const id = String(formData.get("id") ?? "");
  if (!id) throw new Error("Mode introuvable.");
  const parsed = methodSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Formulaire invalide");
  }
  const { label } = parsed.data;

  const clash = await prisma.paymentMethod.findFirst({
    where: { label, NOT: { id } },
  });
  if (clash) throw new Error(`Le mode "${label}" est déjà utilisé.`);

  await prisma.paymentMethod.update({ where: { id }, data: { label } });
  revalidatePath("/admin/payment-methods");
  revalidatePath("/encaissements");
}

export async function deletePaymentMethod(formData: FormData) {
  await requireRole(MANAGE_ROLES);
  const id = String(formData.get("id") ?? "");
  if (!id) throw new Error("Mode introuvable.");

  await prisma.paymentMethod.delete({ where: { id } });
  revalidatePath("/admin/payment-methods");
  revalidatePath("/encaissements");
}
