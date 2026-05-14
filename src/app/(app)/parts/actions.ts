"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/permissions";
import { Role } from "@prisma/client";

const MANAGE_ROLES = [Role.ADMIN, Role.MANAGER];

// Empty string → undefined; otherwise the trimmed string.
const optionalText = z
  .string()
  .transform((v) => v.trim())
  .transform((v) => (v === "" ? undefined : v));

const optionalNumber = z
  .string()
  .transform((v) => v.trim())
  .transform((v) => (v === "" ? undefined : Number(v)))
  .pipe(z.number().nonnegative().optional());

const partSchema = z.object({
  reference: z.string().trim().min(1, "La référence est obligatoire"),
  name: z.string().trim().min(1, "La désignation est obligatoire"),
  description: optionalText.optional(),
  brand: optionalText.optional(),
  categoryId: optionalText.optional(),
  supplierId: optionalText.optional(),
  vatRate: z
    .string()
    .trim()
    .transform((v) => (v === "" ? 20 : Number(v)))
    .pipe(z.number().min(0).max(100)),
  reorderThreshold: optionalNumber,
  location: optionalText.optional(),
  initialStock: optionalNumber,
});

function parsePart(formData: FormData) {
  const parsed = partSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Formulaire invalide");
  }
  return parsed.data;
}

export async function createPart(formData: FormData) {
  const user = await requireRole(MANAGE_ROLES);
  const data = parsePart(formData);

  const existing = await prisma.part.findUnique({
    where: { reference: data.reference },
  });
  if (existing) {
    throw new Error(`La référence "${data.reference}" existe déjà.`);
  }

  const initialStock = data.initialStock ?? 0;
  const part = await prisma.part.create({
    data: {
      reference: data.reference,
      name: data.name,
      description: data.description,
      brand: data.brand,
      categoryId: data.categoryId,
      supplierId: data.supplierId,
      vatRate: data.vatRate / 100,
      reorderThreshold: data.reorderThreshold ?? 0,
      location: data.location,
      stockQty: initialStock,
      // initialStock crée un mouvement d'entrée mais PAS d'historique de
      // coût d'achat : le PMP ne se constitue qu'avec les commandes d'achat
      // réceptionnées (voir lib/pmp.ts).
      movements:
        initialStock > 0
          ? {
              create: {
                type: "IN",
                quantity: initialStock,
                resulting: initialStock,
                reason: "Stock initial",
                createdById: user.id,
              },
            }
          : undefined,
    },
  });

  revalidatePath("/parts");
  revalidatePath("/");
  redirect(`/parts/${part.id}`);
}

export async function updatePart(formData: FormData) {
  await requireRole(MANAGE_ROLES);
  const id = String(formData.get("id") ?? "");
  if (!id) throw new Error("Pièce introuvable.");
  const data = parsePart(formData);

  const clash = await prisma.part.findFirst({
    where: { reference: data.reference, NOT: { id } },
  });
  if (clash) {
    throw new Error(`La référence "${data.reference}" est déjà utilisée.`);
  }

  // Stock is never edited here — it only moves through StockMovement.
  await prisma.part.update({
    where: { id },
    data: {
      reference: data.reference,
      name: data.name,
      description: data.description,
      brand: data.brand,
      categoryId: data.categoryId ?? null,
      supplierId: data.supplierId ?? null,
      vatRate: data.vatRate / 100,
      reorderThreshold: data.reorderThreshold ?? 0,
      location: data.location ?? null,
    },
  });

  revalidatePath("/parts");
  revalidatePath(`/parts/${id}`);
  redirect(`/parts/${id}`);
}

export async function setPartActive(formData: FormData) {
  await requireRole(MANAGE_ROLES);
  const id = String(formData.get("id") ?? "");
  const active = formData.get("active") === "1";
  if (!id) throw new Error("Pièce introuvable.");

  await prisma.part.update({ where: { id }, data: { active } });
  revalidatePath("/parts");
  revalidatePath(`/parts/${id}`);
  revalidatePath("/");
}

export async function deletePart(formData: FormData) {
  await requireRole(MANAGE_ROLES);
  const id = String(formData.get("id") ?? "");
  if (!id) throw new Error("Pièce introuvable.");

  // Movements and fitments cascade on delete (see schema).
  await prisma.part.delete({ where: { id } });
  revalidatePath("/parts");
  revalidatePath("/");
  redirect("/parts");
}

const fitmentSchema = z.object({
  partId: z.string().min(1),
  make: z.string().trim().min(1, "La marque est obligatoire"),
  model: z.string().trim().min(1, "Le modèle est obligatoire"),
  engine: optionalText.optional(),
  yearFrom: optionalNumber,
  yearTo: optionalNumber,
});

export async function addFitment(formData: FormData) {
  await requireRole(MANAGE_ROLES);
  const parsed = fitmentSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Formulaire invalide");
  }
  const { partId, make, model, engine, yearFrom, yearTo } = parsed.data;

  await prisma.fitment.create({
    data: {
      partId,
      make,
      model,
      engine,
      yearFrom: yearFrom ?? null,
      yearTo: yearTo ?? null,
    },
  });
  revalidatePath(`/parts/${partId}`);
}

export async function deleteFitment(formData: FormData) {
  await requireRole(MANAGE_ROLES);
  const id = String(formData.get("id") ?? "");
  const partId = String(formData.get("partId") ?? "");
  if (!id) throw new Error("Compatibilité introuvable.");

  await prisma.fitment.delete({ where: { id } });
  if (partId) revalidatePath(`/parts/${partId}`);
}
