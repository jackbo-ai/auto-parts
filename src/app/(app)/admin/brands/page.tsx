import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/permissions";
import { Role } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ConfirmSubmit } from "@/components/confirm-submit";
import { createBrand, deleteBrand, updateBrand } from "./actions";

export default async function BrandsPage() {
  await requireRole([Role.ADMIN, Role.MANAGER]);

  const brands = await prisma.brand.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { parts: true } } },
  });

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <Link
        href="/parts"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Retour au catalogue
      </Link>
      <h1 className="text-2xl font-semibold">Marques</h1>

      <section className="space-y-2 rounded-lg border bg-card p-4">
        <h2 className="text-sm font-medium">Ajouter une marque</h2>
        <form action={createBrand} className="flex flex-wrap items-end gap-2">
          <div className="flex-1 space-y-1">
            <label className="text-xs text-muted-foreground">Nom</label>
            <Input name="name" required placeholder="Bosch" />
          </div>
          <Button type="submit">Ajouter</Button>
        </form>
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-medium">
          Marques existantes ({brands.length})
        </h2>
        <div className="space-y-2">
          {brands.length === 0 && (
            <div className="rounded-lg border bg-card px-4 py-10 text-center text-sm text-muted-foreground">
              Aucune marque.
            </div>
          )}
          {brands.map((b) => (
            <div key={b.id} className="rounded-lg border bg-card p-3">
              <form
                action={updateBrand}
                className="flex flex-wrap items-end gap-2"
              >
                <input type="hidden" name="id" value={b.id} />
                <div className="flex-1 space-y-1">
                  <label className="text-xs text-muted-foreground">Nom</label>
                  <Input name="name" defaultValue={b.name} required />
                </div>
                <Button type="submit" variant="secondary">
                  Enregistrer
                </Button>
              </form>
              <div className="mt-2 flex items-center justify-between gap-2 border-t pt-2">
                <span className="text-xs text-muted-foreground">
                  {b._count.parts} pièce{b._count.parts > 1 ? "s" : ""}
                </span>
                <form action={deleteBrand}>
                  <input type="hidden" name="id" value={b.id} />
                  <ConfirmSubmit
                    variant="ghost"
                    size="sm"
                    message={`Supprimer la marque "${b.name}" ?`}
                  >
                    Supprimer
                  </ConfirmSubmit>
                </form>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
