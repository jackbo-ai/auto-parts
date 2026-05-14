"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { StockMovementType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/permissions";

const movementSchema = z.object({
  partId: z.string().min(1),
  type: z.nativeEnum(StockMovementType),
  // Always a positive magnitude in the form; the sign is derived from `type`.
  quantity: z
    .string()
    .trim()
    .min(1, "La quantité est obligatoire")
    .transform((v) => Number(v))
    .pipe(z.number().int().positive("La quantité doit être positive")),
  reason: z
    .string()
    .transform((v) => v.trim())
    .transform((v) => (v === "" ? undefined : v))
    .optional(),
});

// Records a stock movement and updates the part's denormalized stockQty in
// the same transaction so the two can never drift.
export async function recordStockMovement(formData: FormData) {
  const user = await requireUser();
  const parsed = movementSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Formulaire invalide");
  }
  const { partId, type, quantity, reason } = parsed.data;

  await prisma.$transaction(async (tx) => {
    const part = await tx.part.findUnique({
      where: { id: partId },
      select: { stockQty: true },
    });
    if (!part) throw new Error("Pièce introuvable.");

    let delta: number;
    if (type === StockMovementType.IN) {
      delta = quantity;
    } else if (type === StockMovementType.OUT) {
      delta = -quantity;
    } else {
      // ADJUSTMENT: the form value is the new absolute stock level.
      delta = quantity - part.stockQty;
    }

    const resulting = part.stockQty + delta;
    if (resulting < 0) {
      throw new Error(
        `Stock insuffisant : ${part.stockQty} en stock, sortie de ${quantity} demandée.`,
      );
    }

    await tx.stockMovement.create({
      data: {
        partId,
        type,
        quantity: delta,
        resulting,
        reason,
        createdById: user.id,
      },
    });
    await tx.part.update({
      where: { id: partId },
      data: { stockQty: resulting },
    });
  });

  revalidatePath("/stock");
  revalidatePath("/");
  revalidatePath(`/parts/${partId}`);
}
