"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/permissions";

const createSchema = z.object({
  name: z.string().trim().min(1, "Le nom est obligatoire"),
  email: z.string().trim().toLowerCase().email("Email invalide"),
  password: z.string().min(8, "Mot de passe : 8 caractères minimum"),
  role: z.nativeEnum(Role),
});

export async function createUser(formData: FormData) {
  await requireRole([Role.ADMIN]);
  const parsed = createSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Formulaire invalide");
  }
  const { name, email, password, role } = parsed.data;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) throw new Error(`Un compte existe déjà pour ${email}.`);

  await prisma.user.create({
    data: {
      name,
      email,
      role,
      passwordHash: await bcrypt.hash(password, 10),
    },
  });
  revalidatePath("/admin/users");
}

export async function updateUserRole(formData: FormData) {
  const me = await requireRole([Role.ADMIN]);
  const userId = String(formData.get("userId") ?? "");
  const role = formData.get("role");
  if (!userId) throw new Error("Utilisateur introuvable.");
  if (userId === me.id) {
    throw new Error("Vous ne pouvez pas changer votre propre rôle.");
  }
  const parsedRole = z.nativeEnum(Role).safeParse(role);
  if (!parsedRole.success) throw new Error("Rôle invalide.");

  await prisma.user.update({
    where: { id: userId },
    data: { role: parsedRole.data },
  });
  revalidatePath("/admin/users");
}

export async function toggleUserActive(formData: FormData) {
  const me = await requireRole([Role.ADMIN]);
  const userId = String(formData.get("userId") ?? "");
  if (!userId) throw new Error("Utilisateur introuvable.");
  if (userId === me.id) {
    throw new Error("Vous ne pouvez pas désactiver votre propre compte.");
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new Error("Utilisateur introuvable.");

  await prisma.user.update({
    where: { id: userId },
    data: { active: !user.active },
  });
  revalidatePath("/admin/users");
}

export async function resetUserPassword(formData: FormData) {
  await requireRole([Role.ADMIN]);
  const userId = String(formData.get("userId") ?? "");
  const password = String(formData.get("password") ?? "");
  if (!userId) throw new Error("Utilisateur introuvable.");
  if (password.length < 8) {
    throw new Error("Mot de passe : 8 caractères minimum.");
  }

  await prisma.user.update({
    where: { id: userId },
    data: { passwordHash: await bcrypt.hash(password, 10) },
  });
  revalidatePath("/admin/users");
}

export async function deleteUser(formData: FormData) {
  const me = await requireRole([Role.ADMIN]);
  const userId = String(formData.get("userId") ?? "");
  if (!userId) throw new Error("Utilisateur introuvable.");
  if (userId === me.id) {
    throw new Error("Vous ne pouvez pas supprimer votre propre compte.");
  }

  // Stock movements keep their history; the author link is cleared.
  await prisma.stockMovement.updateMany({
    where: { createdById: userId },
    data: { createdById: null },
  });
  await prisma.user.delete({ where: { id: userId } });
  revalidatePath("/admin/users");
}
