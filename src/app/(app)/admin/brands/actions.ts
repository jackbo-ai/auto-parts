"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/permissions";
import { Role } from "@prisma/client";

const MANAGE_ROLES = [Role.ADMIN, Role.MANAGER];

const brandSchema = z.object({
  name: z.string().trim().min(1, "Le nom est obligatoire"),
});

export async function createBrand(formData: FormData) {
  await requireRole(MANAGE_ROLES);
  const parsed = brandSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Formulaire invalide");
  }
  const { name } = parsed.data;

  const clash = await prisma.brand.findUnique({ where: { name } });
  if (clash) {
    throw new Error(`La marque "${name}" existe déjà.`);
  }

  await prisma.brand.create({ data: { name } });
  revalidatePath("/admin/brands");
}

export async function updateBrand(formData: FormData) {
  await requireRole(MANAGE_ROLES);
  const id = String(formData.get("id") ?? "");
  if (!id) throw new Error("Marque introuvable.");
  const parsed = brandSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Formulaire invalide");
  }
  const { name } = parsed.data;

  const clash = await prisma.brand.findFirst({
    where: { name, NOT: { id } },
  });
  if (clash) {
    throw new Error(`La marque "${name}" est déjà utilisée.`);
  }

  await prisma.brand.update({ where: { id }, data: { name } });
  revalidatePath("/admin/brands");
}

export async function deleteBrand(formData: FormData) {
  await requireRole(MANAGE_ROLES);
  const id = String(formData.get("id") ?? "");
  if (!id) throw new Error("Marque introuvable.");

  const parts = await prisma.part.count({ where: { brandId: id } });
  if (parts > 0) {
    throw new Error(
      `Marque utilisée par ${parts} pièce(s) — réaffectez-les d'abord.`,
    );
  }

  await prisma.brand.delete({ where: { id } });
  revalidatePath("/admin/brands");
}
