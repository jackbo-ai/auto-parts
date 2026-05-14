"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/permissions";
import { Role } from "@prisma/client";

const MANAGE_ROLES = [Role.ADMIN, Role.MANAGER];

const optionalText = z
  .string()
  .transform((v) => v.trim())
  .transform((v) => (v === "" ? undefined : v))
  .optional();

const customerSchema = z.object({
  name: z.string().trim().min(1, "Le nom est obligatoire"),
  email: z
    .string()
    .transform((v) => v.trim())
    .transform((v) => (v === "" ? undefined : v))
    .pipe(z.string().email("Email invalide").optional())
    .optional(),
  phone: optionalText,
  address: optionalText,
  notes: optionalText,
});

export async function createCustomer(formData: FormData) {
  await requireRole(MANAGE_ROLES);
  const parsed = customerSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Formulaire invalide");
  }

  await prisma.customer.create({ data: parsed.data });
  revalidatePath("/customers");
}

export async function updateCustomer(formData: FormData) {
  await requireRole(MANAGE_ROLES);
  const id = String(formData.get("id") ?? "");
  if (!id) throw new Error("Client introuvable.");
  const parsed = customerSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Formulaire invalide");
  }

  await prisma.customer.update({
    where: { id },
    data: {
      name: parsed.data.name,
      email: parsed.data.email ?? null,
      phone: parsed.data.phone ?? null,
      address: parsed.data.address ?? null,
      notes: parsed.data.notes ?? null,
    },
  });
  revalidatePath("/customers");
  revalidatePath(`/customers/${id}`);
}

export async function deleteCustomer(formData: FormData) {
  await requireRole(MANAGE_ROLES);
  const id = String(formData.get("id") ?? "");
  if (!id) throw new Error("Client introuvable.");

  // Un client rattaché à des commandes n'est pas supprimable : son historique
  // de ventes doit rester traçable.
  const orderCount = await prisma.salesOrder.count({ where: { customerId: id } });
  if (orderCount > 0) {
    throw new Error(
      `Ce client a ${orderCount} commande(s) — suppression impossible.`,
    );
  }

  await prisma.customer.delete({ where: { id } });
  revalidatePath("/customers");
  redirect("/customers");
}
