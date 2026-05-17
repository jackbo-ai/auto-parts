import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/permissions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ConfirmSubmit } from "@/components/confirm-submit";
import {
  createStockReason,
  deleteStockReason,
  updateStockReason,
} from "./actions";

export default async function StockReasonsPage() {
  await requireRole([Role.ADMIN, Role.MANAGER]);

  const reasons = await prisma.stockMovementReason.findMany({
    orderBy: { label: "asc" },
  });

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <Link
        href="/admin"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Retour à l&apos;administration
      </Link>
      <h1 className="text-2xl font-semibold">Motifs de mouvement de stock</h1>
      <p className="text-sm text-muted-foreground">
        Les motifs définis ici sont proposés dans la saisie d&apos;un mouvement
        de stock.
      </p>

      <section className="space-y-2 rounded-lg border bg-card p-4">
        <h2 className="text-sm font-medium">Ajouter un motif</h2>
        <form
          action={createStockReason}
          className="flex flex-wrap items-end gap-2"
        >
          <div className="flex-1 space-y-1">
            <label className="text-xs text-muted-foreground">Libellé</label>
            <Input name="label" required placeholder="Réception BL, Casse…" />
          </div>
          <Button type="submit">Ajouter</Button>
        </form>
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-medium">
          Motifs existants ({reasons.length})
        </h2>
        <div className="space-y-2">
          {reasons.length === 0 && (
            <div className="rounded-lg border bg-card px-4 py-10 text-center text-sm text-muted-foreground">
              Aucun motif. Ajoutez-en au moins un pour permettre la saisie de
              mouvements.
            </div>
          )}
          {reasons.map((r) => (
            <div key={r.id} className="rounded-lg border bg-card p-3">
              <form
                action={updateStockReason}
                className="flex flex-wrap items-end gap-2"
              >
                <input type="hidden" name="id" value={r.id} />
                <div className="flex-1 space-y-1">
                  <label className="text-xs text-muted-foreground">
                    Libellé
                  </label>
                  <Input name="label" defaultValue={r.label} required />
                </div>
                <Button type="submit" variant="secondary">
                  Enregistrer
                </Button>
              </form>
              <div className="mt-2 flex items-center justify-end gap-2 border-t pt-2">
                <form action={deleteStockReason}>
                  <input type="hidden" name="id" value={r.id} />
                  <ConfirmSubmit
                    variant="ghost"
                    size="sm"
                    message={`Supprimer le motif "${r.label}" ? Les mouvements passés conserveront le libellé.`}
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
