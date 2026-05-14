"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/permissions";
import { Role } from "@prisma/client";
import { slugify } from "@/lib/utils";

const MANAGE_ROLES = [Role.ADMIN, Role.MANAGER];

const categorySchema = z.object({
  name: z.string().trim().min(1, "Le nom est obligatoire"),
  parentId: z
    .string()
    .transform((v) => v.trim())
    .transform((v) => (v === "" ? undefined : v))
    .optional(),
});

// Slugs are unique; disambiguate collisions with a numeric suffix.
async function uniqueSlug(base: string, ignoreId?: string) {
  const root = slugify(base) || "categorie";
  let candidate = root;
  let n = 2;
  while (true) {
    const clash = await prisma.category.findFirst({
      where: { slug: candidate, ...(ignoreId ? { NOT: { id: ignoreId } } : {}) },
    });
    if (!clash) return candidate;
    candidate = `${root}-${n++}`;
  }
}

export async function createCategory(formData: FormData) {
  await requireRole(MANAGE_ROLES);
  const parsed = categorySchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Formulaire invalide");
  }
  const { name, parentId } = parsed.data;

  await prisma.category.create({
    data: { name, slug: await uniqueSlug(name), parentId: parentId ?? null },
  });
  revalidatePath("/admin/categories");
}

export async function updateCategory(formData: FormData) {
  await requireRole(MANAGE_ROLES);
  const id = String(formData.get("id") ?? "");
  if (!id) throw new Error("Catégorie introuvable.");
  const parsed = categorySchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Formulaire invalide");
  }
  const { name, parentId } = parsed.data;

  if (parentId === id) {
    throw new Error("Une catégorie ne peut pas être son propre parent.");
  }

  await prisma.category.update({
    where: { id },
    data: {
      name,
      slug: await uniqueSlug(name, id),
      parentId: parentId ?? null,
    },
  });
  revalidatePath("/admin/categories");
}

export async function deleteCategory(formData: FormData) {
  await requireRole(MANAGE_ROLES);
  const id = String(formData.get("id") ?? "");
  if (!id) throw new Error("Catégorie introuvable.");

  const [parts, children] = await Promise.all([
    prisma.part.count({ where: { categoryId: id } }),
    prisma.category.count({ where: { parentId: id } }),
  ]);
  if (parts > 0) {
    throw new Error(
      `Catégorie utilisée par ${parts} pièce(s) — réaffectez-les d'abord.`,
    );
  }
  if (children > 0) {
    throw new Error(
      `Catégorie parente de ${children} sous-catégorie(s) — supprimez-les d'abord.`,
    );
  }

  await prisma.category.delete({ where: { id } });
  revalidatePath("/admin/categories");
}
