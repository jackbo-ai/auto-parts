import Link from "next/link";
import { Package, Upload, Users } from "lucide-react";
import { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/permissions";

export default async function AdminPage() {
  await requireRole([Role.ADMIN]);

  const [userCount, partCount] = await Promise.all([
    prisma.user.count(),
    prisma.part.count(),
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
      href: "/admin/articles",
      label: "Initialisation base articles",
      description: "Import d'un fichier TecDoc (référence + désignation)",
      icon: Upload,
      meta: `${partCount} article${partCount > 1 ? "s" : ""} en base`,
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
