import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/permissions";
import { Role } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { ConfirmSubmit } from "@/components/confirm-submit";
import {
  createCategory,
  deleteCategory,
  updateCategory,
} from "./actions";

export default async function CategoriesPage() {
  await requireRole([Role.ADMIN, Role.MANAGER]);

  const categories = await prisma.category.findMany({
    orderBy: { name: "asc" },
    include: {
      parent: { select: { name: true } },
      _count: { select: { parts: true, children: true } },
    },
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
      <h1 className="text-2xl font-semibold">Catégories</h1>

      <section className="space-y-2 rounded-lg border bg-card p-4">
        <h2 className="text-sm font-medium">Ajouter une catégorie</h2>
        <form
          action={createCategory}
          className="flex flex-wrap items-end gap-2"
        >
          <div className="flex-1 space-y-1">
            <label className="text-xs text-muted-foreground">Nom</label>
            <Input name="name" required placeholder="Freinage" />
          </div>
          <div className="flex-1 space-y-1">
            <label className="text-xs text-muted-foreground">
              Catégorie parente
            </label>
            <Select name="parentId" defaultValue="">
              <option value="">— Aucune (racine) —</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </div>
          <Button type="submit">Ajouter</Button>
        </form>
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-medium">
          Catégories existantes ({categories.length})
        </h2>
        <div className="space-y-2">
          {categories.length === 0 && (
            <div className="rounded-lg border bg-card px-4 py-10 text-center text-sm text-muted-foreground">
              Aucune catégorie.
            </div>
          )}
          {categories.map((c) => (
            <div key={c.id} className="rounded-lg border bg-card p-3">
              <form
                action={updateCategory}
                className="flex flex-wrap items-end gap-2"
              >
                <input type="hidden" name="id" value={c.id} />
                <div className="flex-1 space-y-1">
                  <label className="text-xs text-muted-foreground">Nom</label>
                  <Input name="name" defaultValue={c.name} required />
                </div>
                <div className="flex-1 space-y-1">
                  <label className="text-xs text-muted-foreground">
                    Catégorie parente
                  </label>
                  <Select name="parentId" defaultValue={c.parentId ?? ""}>
                    <option value="">— Aucune (racine) —</option>
                    {categories
                      .filter((o) => o.id !== c.id)
                      .map((o) => (
                        <option key={o.id} value={o.id}>
                          {o.name}
                        </option>
                      ))}
                  </Select>
                </div>
                <Button type="submit" variant="secondary">
                  Enregistrer
                </Button>
              </form>
              <div className="mt-2 flex items-center justify-between gap-2 border-t pt-2">
                <span className="text-xs text-muted-foreground">
                  {c._count.parts} pièce{c._count.parts > 1 ? "s" : ""} ·{" "}
                  {c._count.children} sous-catégorie
                  {c._count.children > 1 ? "s" : ""}
                </span>
                <form action={deleteCategory}>
                  <input type="hidden" name="id" value={c.id} />
                  <ConfirmSubmit
                    variant="ghost"
                    size="sm"
                    message={`Supprimer la catégorie "${c.name}" ?`}
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
