import { Role } from "@prisma/client";
import { auth } from "@/auth";

export class AuthError extends Error {
  constructor(message = "Non authentifié") {
    super(message);
    this.name = "AuthError";
  }
}

export class ForbiddenError extends Error {
  constructor(message = "Action non autorisée") {
    super(message);
    this.name = "ForbiddenError";
  }
}

export type SessionUser = {
  id: string;
  email: string;
  name: string;
  role: Role;
};

export async function requireUser(): Promise<SessionUser> {
  const session = await auth();
  if (!session?.user?.id) {
    throw new AuthError();
  }
  return {
    id: session.user.id,
    email: session.user.email ?? "",
    name: session.user.name ?? "",
    role: session.user.role,
  };
}

export async function requireRole(allowed: Role[]): Promise<SessionUser> {
  const user = await requireUser();
  if (!allowed.includes(user.role)) {
    throw new ForbiddenError();
  }
  return user;
}

// Permission predicates — keep declarative so pages and actions agree.

// Gestion des utilisateurs : Admin uniquement.
export const canManageUsers = (role: Role) => role === Role.ADMIN;

// Catalogue (pièces, catégories) et fournisseurs : Admin + Manager peuvent
// créer / modifier / supprimer. Staff est en lecture seule.
export const canManageCatalog = (role: Role) =>
  role === Role.ADMIN || role === Role.MANAGER;

// Mouvements de stock : tout le monde peut en enregistrer (réception,
// sortie atelier), y compris le Staff.
export const canMoveStock = (role: Role) =>
  role === Role.ADMIN || role === Role.MANAGER || role === Role.STAFF;

// Commandes (achat et vente) : Admin + Manager créent et pilotent les
// commandes. Staff est en lecture seule.
export const canManageOrders = (role: Role) =>
  role === Role.ADMIN || role === Role.MANAGER;

export const ROLE_LABELS: Record<Role, string> = {
  ADMIN: "Administrateur",
  MANAGER: "Gestionnaire",
  STAFF: "Magasinier",
};
