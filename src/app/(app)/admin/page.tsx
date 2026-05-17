import Link from "next/link";
import {
  Contact,
  CreditCard,
  FolderTree,
  Package,
  SlidersHorizontal,
  Tag,
  Truck,
  Upload,
  Users,
} from "lucide-react";
import { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/permissions";

export default async function AdminPage() {
  await requireRole([Role.ADMIN]);

  const [
    userCount,
    partCount,
    categoryCount,
    brandCount,
    customerCount,
    supplierCount,
    stockReasonCount,
    paymentMethodCount,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.part.count(),
    prisma.category.count(),
    prisma.brand.count(),
    prisma.customer.count(),
    prisma.supplier.count(),
    prisma.stockMovementReason.count(),
    prisma.paymentMethod.count(),
  ]);

  const sections = [
    {
      href: "/admin/users",
      label: "Utilisateurs",
      description: "Comptes, rôles et accès",
      icon: Users,
      meta: `${userCount} compte${userCount > 1 ? "s" : ""}`,
    },
    {
      href: "/admin/customers",
      label: "Clients",
      description: "Fiches clients et historique de commandes",
      icon: Contact,
      meta: `${customerCount} client${customerCount > 1 ? "s" : ""}`,
    },
    {
      href: "/suppliers",
      label: "Fournisseurs",
      description: "Fiches fournisseurs et historique d'achats",
      icon: Truck,
      meta: `${supplierCount} fournisseur${supplierCount > 1 ? "s" : ""}`,
    },
    {
      href: "/parts",
      label: "Catalogue",
      description: "Liste des pièces actives, prix, seuils et stock",
      icon: Package,
      meta: `${partCount} pièce${partCount > 1 ? "s" : ""}`,
    },
    {
      href: "/admin/articles",
      label: "Initialisation base articles",
      description: "Import d'un fichier TecDoc (référence + désignation)",
      icon: Upload,
      meta: `${partCount} article${partCount > 1 ? "s" : ""} en base`,
    },
    {
      href: "/admin/categories",
      label: "Catégories",
      description: "Arborescence des familles de pièces",
      icon: FolderTree,
      meta: `${categoryCount} catégorie${categoryCount > 1 ? "s" : ""}`,
    },
    {
      href: "/admin/brands",
      label: "Marques",
      description: "Équipementiers proposés sur la fiche pièce",
      icon: Tag,
      meta: `${brandCount} marque${brandCount > 1 ? "s" : ""}`,
    },
    {
      href: "/admin/stock-reasons",
      label: "Motifs de mouvement",
      description: "Libellés proposés à la saisie d'un mouvement de stock",
      icon: SlidersHorizontal,
      meta: `${stockReasonCount} motif${stockReasonCount > 1 ? "s" : ""}`,
    },
    {
      href: "/admin/payment-methods",
      label: "Modes de paiement",
      description: "Libellés proposés à la saisie d'un encaissement",
      icon: CreditCard,
      meta: `${paymentMethodCount} mode${paymentMethodCount > 1 ? "s" : ""}`,
    },
  ];

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-semibold">Administration</h1>

      <div className="grid gap-3 sm:grid-cols-2">
        {sections.map(({ href, label, description, icon: Icon, meta }) => (
          <Link
            key={href}
            href={href}
            className="rounded-lg border bg-card p-5 transition-colors hover:bg-accent/40"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary text-primary-foreground">
                <Icon className="h-5 w-5" />
              </div>
              <span className="text-xs uppercase tracking-wide text-muted-foreground">
                {meta}
              </span>
            </div>
            <div className="mt-3 font-medium">{label}</div>
            <p className="text-sm text-muted-foreground">{description}</p>
          </Link>
        ))}
      </div>

      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Package className="h-3.5 w-3.5" />
        Le coût d&apos;achat de chaque article n&apos;est pas saisi ici : il se
        constitue à partir des commandes d&apos;achat réceptionnées (PMP).
      </p>
    </div>
  );
}
