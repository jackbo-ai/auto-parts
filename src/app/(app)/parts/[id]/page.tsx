import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowDownRight,
  ArrowLeft,
  ArrowUpRight,
  Pencil,
  Plus,
  SlidersHorizontal,
  Trash2,
} from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireUser, canManageCatalog } from "@/lib/permissions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ConfirmSubmit } from "@/components/confirm-submit";
import {
  formatDateTime,
  formatEuro,
  formatNumber,
  htToTtc,
  margin,
} from "@/lib/utils";
import {
  addFitment,
  deleteFitment,
  deletePart,
  setPartActive,
} from "../actions";
import { recordStockMovement } from "../../stock/actions";

function InfoRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex justify-between gap-4 py-1.5 text-sm">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right">{children}</dd>
    </div>
  );
}

export default async function PartDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const me = await requireUser();
  const { id } = await params;

  const part = await prisma.part.findUnique({
    where: { id },
    include: {
      category: { select: { name: true } },
      supplier: { select: { id: true, name: true } },
      fitments: { orderBy: [{ make: "asc" }, { model: "asc" }] },
      movements: {
        orderBy: { createdAt: "desc" },
        take: 20,
        include: { createdBy: { select: { name: true } } },
      },
    },
  });
  if (!part) notFound();

  const canManage = canManageCatalog(me.role);
  const m = margin(part.purchasePriceHt, part.salePriceHt);
  const lowStock = part.stockQty <= part.reorderThreshold;

  return (
    <div className="space-y-5">
      <Link
        href="/parts"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Retour au catalogue
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="font-mono text-sm font-bold text-primary">
            {part.reference}
          </div>
          <h1 className="text-2xl font-semibold">{part.name}</h1>
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            {part.active ? (
              <Badge className="border-emerald-300 bg-emerald-100 text-emerald-800">
                Active
              </Badge>
            ) : (
              <Badge className="border-slate-300 bg-slate-200 text-slate-700">
                Inactive
              </Badge>
            )}
            {lowStock && (
              <Badge className="border-destructive/30 bg-destructive/10 text-destructive">
                Sous le seuil
              </Badge>
            )}
            {part.brand && (
              <span className="text-sm text-muted-foreground">
                {part.brand}
              </span>
            )}
          </div>
        </div>
        {canManage && (
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline" size="sm">
              <Link href={`/parts/${part.id}/edit`}>
                <Pencil className="h-4 w-4" />
                Modifier
              </Link>
            </Button>
            <form action={setPartActive}>
              <input type="hidden" name="id" value={part.id} />
              <input
                type="hidden"
                name="active"
                value={part.active ? "0" : "1"}
              />
              <Button type="submit" variant="secondary" size="sm">
                {part.active ? "Désactiver" : "Réactiver"}
              </Button>
            </form>
            <form action={deletePart}>
              <input type="hidden" name="id" value={part.id} />
              <ConfirmSubmit
                variant="ghost"
                size="sm"
                message={`Supprimer définitivement ${part.reference} ? Les mouvements et compatibilités liés seront supprimés.`}
              >
                <Trash2 className="h-4 w-4 text-destructive" />
                Supprimer
              </ConfirmSubmit>
            </form>
          </div>
        )}
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <section className="space-y-4 lg:col-span-2">
          <div className="rounded-lg border bg-card p-4">
            <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Informations
            </h2>
            <dl className="divide-y">
              <InfoRow label="Référence OEM">
                {part.oemReference ? (
                  <span className="font-mono">{part.oemReference}</span>
                ) : (
                  "—"
                )}
              </InfoRow>
              <InfoRow label="Catégorie">
                {part.category?.name ?? "—"}
              </InfoRow>
              <InfoRow label="Fournisseur">
                {part.supplier ? (
                  <Link
                    href={`/suppliers/${part.supplier.id}`}
                    className="hover:underline"
                  >
                    {part.supplier.name}
                  </Link>
                ) : (
                  "—"
                )}
              </InfoRow>
              <InfoRow label="Emplacement">
                {part.location ?? "—"}
              </InfoRow>
              <InfoRow label="Prix d'achat HT">
                {formatEuro(part.purchasePriceHt)}
              </InfoRow>
              <InfoRow label="Prix de vente HT">
                {formatEuro(part.salePriceHt)}
              </InfoRow>
              <InfoRow label="Prix de vente TTC">
                {formatEuro(htToTtc(part.salePriceHt, part.vatRate))}
                <span className="ml-1 text-xs text-muted-foreground">
                  (TVA {Math.round(part.vatRate * 1000) / 10}%)
                </span>
              </InfoRow>
              <InfoRow label="Marge brute">
                {m ? (
                  <span>
                    {formatEuro(m.value)}{" "}
                    <span className="text-xs text-muted-foreground">
                      ({m.pct}%)
                    </span>
                  </span>
                ) : (
                  "—"
                )}
              </InfoRow>
            </dl>
            {part.description && (
              <div className="mt-3 border-t pt-3 text-sm">
                <div className="mb-1 text-xs uppercase tracking-wide text-muted-foreground">
                  Description
                </div>
                <p className="whitespace-pre-wrap">{part.description}</p>
              </div>
            )}
          </div>

          {/* Compatibilités véhicule */}
          <div className="rounded-lg border bg-card p-4">
            <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Compatibilités véhicule ({part.fitments.length})
            </h2>
            <div className="space-y-1.5">
              {part.fitments.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  Aucune compatibilité renseignée.
                </p>
              )}
              {part.fitments.map((f) => (
                <div
                  key={f.id}
                  className="flex items-center justify-between gap-2 rounded-md border bg-background px-3 py-2 text-sm"
                >
                  <div>
                    <span className="font-medium">
                      {f.make} {f.model}
                    </span>
                    {f.engine && (
                      <span className="text-muted-foreground">
                        {" "}
                        · {f.engine}
                      </span>
                    )}
                    {(f.yearFrom || f.yearTo) && (
                      <span className="text-muted-foreground">
                        {" "}
                        ({f.yearFrom ?? "…"}–{f.yearTo ?? "…"})
                      </span>
                    )}
                  </div>
                  {canManage && (
                    <form action={deleteFitment}>
                      <input type="hidden" name="id" value={f.id} />
                      <input type="hidden" name="partId" value={part.id} />
                      <Button
                        type="submit"
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                      >
                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                      </Button>
                    </form>
                  )}
                </div>
              ))}
            </div>
            {canManage && (
              <form
                action={addFitment}
                className="mt-3 grid gap-2 border-t pt-3 sm:grid-cols-5"
              >
                <input type="hidden" name="partId" value={part.id} />
                <Input name="make" placeholder="Marque" required />
                <Input name="model" placeholder="Modèle" required />
                <Input name="engine" placeholder="Motorisation" />
                <div className="flex gap-1">
                  <Input
                    name="yearFrom"
                    type="number"
                    placeholder="De"
                    className="w-full"
                  />
                  <Input
                    name="yearTo"
                    type="number"
                    placeholder="À"
                    className="w-full"
                  />
                </div>
                <Button type="submit" variant="secondary">
                  <Plus className="h-4 w-4" />
                  Ajouter
                </Button>
              </form>
            )}
          </div>

          {/* Historique des mouvements */}
          <div className="rounded-lg border bg-card p-4">
            <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Mouvements de stock
            </h2>
            <div className="space-y-1.5">
              {part.movements.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  Aucun mouvement enregistré.
                </p>
              )}
              {part.movements.map((mv) => {
                const isIn = mv.quantity >= 0;
                return (
                  <div
                    key={mv.id}
                    className="flex items-center justify-between gap-2 rounded-md border bg-background px-3 py-2 text-sm"
                  >
                    <div>
                      <div className="text-xs text-muted-foreground">
                        {formatDateTime(mv.createdAt)}
                        {mv.createdBy ? ` · ${mv.createdBy.name}` : ""}
                      </div>
                      {mv.reason && <div>{mv.reason}</div>}
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge
                        className={
                          isIn
                            ? "border-emerald-300 bg-emerald-100 text-emerald-800"
                            : "border-amber-300 bg-amber-100 text-amber-800"
                        }
                      >
                        {isIn ? (
                          <ArrowUpRight className="h-3 w-3" />
                        ) : (
                          <ArrowDownRight className="h-3 w-3" />
                        )}
                        {isIn ? "+" : ""}
                        {mv.quantity}
                      </Badge>
                      <span className="tabular-nums text-muted-foreground">
                        → {mv.resulting}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* Colonne stock */}
        <section className="space-y-4">
          <div
            className={`rounded-lg border p-4 ${
              lowStock ? "border-destructive/40 bg-destructive/5" : "bg-card"
            }`}
          >
            <div className="text-xs uppercase tracking-wide text-muted-foreground">
              Stock actuel
            </div>
            <div
              className={`mt-1 text-4xl font-semibold tabular-nums ${
                lowStock ? "text-destructive" : ""
              }`}
            >
              {formatNumber(part.stockQty)}
            </div>
            <div className="mt-1 text-sm text-muted-foreground">
              Seuil de réappro : {part.reorderThreshold}
            </div>
          </div>

          <div className="rounded-lg border bg-card p-4">
            <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              <SlidersHorizontal className="h-4 w-4" />
              Mouvement de stock
            </h2>
            <form action={recordStockMovement} className="space-y-3">
              <input type="hidden" name="partId" value={part.id} />
              <div className="space-y-1.5">
                <Label htmlFor="type">Type</Label>
                <Select id="type" name="type" defaultValue="IN">
                  <option value="IN">Entrée (+)</option>
                  <option value="OUT">Sortie (−)</option>
                  <option value="ADJUSTMENT">
                    Correction d&apos;inventaire
                  </option>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="quantity">Quantité</Label>
                <Input
                  id="quantity"
                  name="quantity"
                  type="number"
                  min="1"
                  required
                />
                <p className="text-xs text-muted-foreground">
                  Pour une correction, saisir le stock réel constaté.
                </p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="reason">Motif</Label>
                <Input
                  id="reason"
                  name="reason"
                  placeholder="Réception BL n°…, vente, casse…"
                />
              </div>
              <Button type="submit" className="w-full">
                Enregistrer le mouvement
              </Button>
            </form>
          </div>
        </section>
      </div>
    </div>
  );
}
