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

const supplierSchema = z.object({
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

export async function createSupplier(formData: FormData) {
  await requireRole(MANAGE_ROLES);
  const parsed = supplierSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Formulaire invalide");
  }

  await prisma.supplier.create({ data: parsed.data });
  revalidatePath("/suppliers");
}

export async function updateSupplier(formData: FormData) {
  await requireRole(MANAGE_ROLES);
  const id = String(formData.get("id") ?? "");
  if (!id) throw new Error("Fournisseur introuvable.");
  const parsed = supplierSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Formulaire invalide");
  }

  await prisma.supplier.update({
    where: { id },
    data: {
      name: parsed.data.name,
      email: parsed.data.email ?? null,
      phone: parsed.data.phone ?? null,
      address: parsed.data.address ?? null,
      notes: parsed.data.notes ?? null,
    },
  });
  revalidatePath("/suppliers");
  revalidatePath(`/suppliers/${id}`);
}

export async function deleteSupplier(formData: FormData) {
  await requireRole(MANAGE_ROLES);
  const id = String(formData.get("id") ?? "");
  if (!id) throw new Error("Fournisseur introuvable.");

  // Parts keep existing; their supplier link is cleared.
  await prisma.part.updateMany({
    where: { supplierId: id },
    data: { supplierId: null },
  });
  await prisma.supplier.delete({ where: { id } });
  revalidatePath("/suppliers");
  redirect("/suppliers");
}
