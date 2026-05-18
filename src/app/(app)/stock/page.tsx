import Link from "next/link";
import {
  AlertTriangle,
  Archive,
  ArrowDownRight,
  ArrowUpRight,
  Boxes,
  CalendarClock,
  History,
  PackageCheck,
  PackageX,
  SlidersHorizontal,
} from "lucide-react";
import type { Prisma } from "@prisma/client";
import { StockMovementType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { canAdjustStock, requireUser } from "@/lib/permissions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { DigitalReadout } from "@/components/dashboard/digital-readout";
import {
  formatDate,
  formatDateTime,
  formatEuro,
  formatNumber,
} from "@/lib/utils";
import { partsPmpMap } from "@/lib/pmp";
import { recordStockMovement } from "./actions";

export default async function StockPage({
  searchParams,
}: {
  searchParams: Promise<{
    ref?: string;
    date?: string;
    movRef?: string;
    movFrom?: string;
    movTo?: string;
    movType?: string;
  }>;
}) {
  const me = await requireUser();
  const canAdjust = canAdjustStock(me.role);
  const params = await searchParams;

  const [parts, pmpAchatMap, inactiveCount, stockReasons] =
    await Promise.all([
      prisma.part.findMany({
        where: { active: true },
        select: {
          id: true,
          reference: true,
          name: true,
          stockQty: true,
          reorderThreshold: true,
          location: true,
        },
        orderBy: { reference: "asc" },
      }),
      partsPmpMap(),
      prisma.part.count({ where: { active: false } }),
      prisma.stockMovementReason.findMany({
        orderBy: { label: "asc" },
        select: { id: true, label: true },
      }),
    ]);

  // Historique des mouvements : filtres optionnels (référence, plage de dates,
  // type). Sans filtre, on retombe sur les 30 derniers mouvements pour garder
  // un aperçu rapide. Avec filtre, on affiche tous les mouvements correspondants
  // (plafonné à 500 pour éviter une explosion de la page).
  const movRef = params.movRef?.trim() || "";
  const movFromStr = params.movFrom?.trim() || "";
  const movToStr = params.movTo?.trim() || "";
  const movTypeStr = params.movType?.trim() || "";
  const movFilterPart = movRef
    ? parts.find(
        (p) => p.reference.toLowerCase() === movRef.toLowerCase(),
      ) ?? null
    : null;
  const movType =
    movTypeStr === "IN" || movTypeStr === "OUT" || movTypeStr === "ADJUSTMENT"
      ? (movTypeStr as StockMovementType)
      : null;
  const movWhere: Prisma.StockMovementWhereInput = {};
  if (movFilterPart) movWhere.partId = movFilterPart.id;
  if (movType) movWhere.type = movType;
  if (movFromStr || movToStr) {
    movWhere.createdAt = {};
    if (movFromStr) movWhere.createdAt.gte = new Date(`${movFromStr}T00:00:00`);
    if (movToStr) movWhere.createdAt.lte = new Date(`${movToStr}T23:59:59.999`);
  }
  const hasMovFilter = Boolean(
    (movRef && movFilterPart) || movFromStr || movToStr || movType,
  );
  const movements = await prisma.stockMovement.findMany({
    where: movWhere,
    orderBy: { createdAt: "desc" },
    take: hasMovFilter ? 500 : 30,
    include: {
      part: { select: { id: true, reference: true, name: true } },
      createdBy: { select: { name: true } },
    },
  });

  // « À réapprovisionner » = tout ce qui est au niveau du seuil ou en dessous,
  // ruptures comprises (cohérent avec le tableau de bord). « Ruptures de
  // stock » est un sous-ensemble urgent mis en avant à part.
  const outOfStock = parts.filter((p) => p.stockQty <= 0);
  const lowStock = parts.filter((p) => p.stockQty <= p.reorderThreshold);
  const inStock = parts.filter((p) => p.stockQty > 0);
  // Valeur du stock au PMP achat (le coût de référence figé n'existe plus).
  const stockValue = parts.reduce(
    (sum, p) => sum + (pmpAchatMap.get(p.id) ?? 0) * p.stockQty,
    0,
  );

  // Stock à une date : on reconstitue le stock d'une pièce à une date donnée
  // via le dernier mouvement antérieur (StockMovement.resulting est figé à
  // chaque mouvement). Sans mouvement antérieur, le stock était à 0.
  const filterRef = params.ref?.trim() || null;
  const today = new Date().toISOString().slice(0, 10);
  const filterDate = params.date?.trim() || today;
  const filterPart = filterRef
    ? parts.find(
        (p) => p.reference.toLowerCase() === filterRef.toLowerCase(),
      ) ?? null
    : null;
  let stockAtDate: number | null = null;
  if (filterPart) {
    const lastMovement = await prisma.stockMovement.findFirst({
      where: {
        partId: filterPart.id,
        createdAt: { lte: new Date(`${filterDate}T23:59:59.999`) },
      },
      orderBy: { createdAt: "desc" },
      select: { resulting: true },
    });
    stockAtDate = lastMovement?.resulting ?? 0;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Stock</h1>
        <p className="text-sm text-muted-foreground">
          Valeur totale (PMP achat HT) : {formatEuro(stockValue)}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        <DigitalReadout
          label="Pièces en rupture"
          value={formatNumber(outOfStock.length)}
          tone="danger"
          icon={<PackageX className="h-3.5 w-3.5" />}
        />
        <DigitalReadout
          label="Sous le seuil"
          value={formatNumber(lowStock.length)}
          tone="danger"
          icon={<AlertTriangle className="h-3.5 w-3.5" />}
        />
        <DigitalReadout
          label="Articles en stock"
          value={formatNumber(inStock.length)}
          tone="success"
          icon={<PackageCheck className="h-3.5 w-3.5" />}
        />
        <DigitalReadout
          label="Références actives"
          value={formatNumber(parts.length)}
          icon={<Boxes className="h-3.5 w-3.5" />}
        />
        <DigitalReadout
          label="Pièces inactives"
          value={formatNumber(inactiveCount)}
          tone="danger"
          icon={<Archive className="h-3.5 w-3.5" />}
        />
      </div>

      <section className="space-y-2">
        <h2 className="flex items-center gap-2 text-base font-medium">
          <SlidersHorizontal className="h-4 w-4" />
          Saisir un mouvement de stock
        </h2>
        {stockReasons.length === 0 ? (
          <div className="rounded-lg border bg-card px-4 py-6 text-sm text-muted-foreground">
            Aucun motif de mouvement n&apos;est configuré.{" "}
            <Link
              href="/admin/stock-reasons"
              className="font-medium text-foreground underline"
            >
              Ajouter un motif
            </Link>{" "}
            pour activer la saisie.
          </div>
        ) : (
          <form
            action={recordStockMovement}
            className="grid gap-3 rounded-lg border bg-card p-4 sm:grid-cols-2 lg:grid-cols-5"
          >
            <div className="space-y-1.5 lg:col-span-2">
              <Label htmlFor="partRef">Référence article</Label>
              <Input
                id="partRef"
                name="partRef"
                list="movement-part-refs"
                placeholder="Saisir une référence…"
                autoComplete="off"
                required
              />
              <datalist id="movement-part-refs">
                {parts.map((p) => (
                  <option key={p.id} value={p.reference}>
                    {p.name}
                  </option>
                ))}
              </datalist>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="mov-type">Type</Label>
              <Select id="mov-type" name="type" defaultValue="IN">
                <option value="IN">Entrée (+)</option>
                <option value="OUT">Sortie (−)</option>
                {canAdjust && (
                  <option value="ADJUSTMENT">Inventaire</option>
                )}
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="mov-quantity">Quantité</Label>
              <Input
                id="mov-quantity"
                name="quantity"
                type="number"
                min="1"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="mov-reason">Motif</Label>
              <Select id="mov-reason" name="reason" required defaultValue="">
                <option value="" disabled>
                  Sélectionner…
                </option>
                {stockReasons.map((r) => (
                  <option key={r.id} value={r.label}>
                    {r.label}
                  </option>
                ))}
              </Select>
            </div>
            <div className="sm:col-span-2 lg:col-span-5">
              <Button type="submit">Enregistrer le mouvement</Button>
              {canAdjust && (
                <p className="mt-1 text-xs text-muted-foreground">
                  <strong>Inventaire</strong> : recale le stock système sur le
                  stock réel constaté en magasin (après comptage, casse, vol,
                  erreur passée…). Saisir la quantité réellement observée — l’écart
                  est calculé automatiquement.
                </p>
              )}
            </div>
          </form>
        )}
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-medium text-muted-foreground">
          Stock à une date
        </h2>
        <div className="grid gap-4 lg:grid-cols-2">
          <form
            action="/stock"
            className="flex flex-wrap items-end gap-2 rounded-lg border bg-card p-4"
          >
            {/* Préserve un éventuel filtre actif dans l'historique des mouvements. */}
            {movRef ? <input type="hidden" name="movRef" value={movRef} /> : null}
            {movFromStr ? (
              <input type="hidden" name="movFrom" value={movFromStr} />
            ) : null}
            {movToStr ? (
              <input type="hidden" name="movTo" value={movToStr} />
            ) : null}
            {movTypeStr ? (
              <input type="hidden" name="movType" value={movTypeStr} />
            ) : null}
            <div className="flex-1 space-y-1">
              <label htmlFor="ref" className="text-xs text-muted-foreground">
                Référence article
              </label>
              <Input
                id="ref"
                name="ref"
                list="stock-part-refs"
                defaultValue={filterRef ?? ""}
                placeholder="Saisir une référence…"
                autoComplete="off"
              />
              <datalist id="stock-part-refs">
                {parts.map((p) => (
                  <option key={p.id} value={p.reference}>
                    {p.name}
                  </option>
                ))}
              </datalist>
              {filterRef && !filterPart && (
                <p className="text-xs text-destructive">
                  Référence introuvable.
                </p>
              )}
            </div>
            <div className="space-y-1">
              <label htmlFor="date" className="text-xs text-muted-foreground">
                Date
              </label>
              <Input id="date" name="date" type="date" defaultValue={filterDate} />
            </div>
            <Button type="submit" variant="secondary">
              Calculer
            </Button>
          </form>
          <DigitalReadout
            label={
              filterPart
                ? `${filterPart.reference} au ${formatDate(filterDate)}`
                : "Stock à une date"
            }
            value={
              stockAtDate != null ? formatNumber(stockAtDate) : "—"
            }
            tone="info"
            icon={<CalendarClock className="h-3.5 w-3.5" />}
          />
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="flex items-center gap-2 text-base font-medium">
          <PackageX className="h-4 w-4 text-destructive" />
          Ruptures de stock
        </h2>
        <StockList parts={outOfStock} empty="Aucune pièce en rupture." />
      </section>

      <section className="space-y-2">
        <h2 className="flex items-center gap-2 text-base font-medium">
          <AlertTriangle className="h-4 w-4 text-amber-600" />
          À réapprovisionner
        </h2>
        <StockList
          parts={lowStock}
          empty="Aucune pièce sous son seuil."
        />
      </section>

      <section className="space-y-2">
        <h2 className="flex items-center gap-2 text-base font-medium">
          <History className="h-4 w-4" />
          {hasMovFilter
            ? `Historique filtré (${movements.length}${movements.length === 500 ? "+" : ""})`
            : `Mouvements récents (${movements.length})`}
        </h2>
        <form
          action="/stock"
          className="flex flex-wrap items-end gap-2 rounded-lg border bg-card p-4"
        >
          {/* Conserve le contexte "Stock à une date" si une recherche y est déjà saisie. */}
          {filterRef ? (
            <input type="hidden" name="ref" value={filterRef} />
          ) : null}
          {params.date ? (
            <input type="hidden" name="date" value={filterDate} />
          ) : null}
          <div className="space-y-1">
            <label htmlFor="movRef" className="text-xs text-muted-foreground">
              Référence article
            </label>
            <Input
              id="movRef"
              name="movRef"
              list="mov-part-refs"
              defaultValue={movRef}
              placeholder="Toutes"
              autoComplete="off"
            />
            <datalist id="mov-part-refs">
              {parts.map((p) => (
                <option key={p.id} value={p.reference}>
                  {p.name}
                </option>
              ))}
            </datalist>
          </div>
          <div className="space-y-1">
            <label htmlFor="movFrom" className="text-xs text-muted-foreground">
              Du
            </label>
            <Input
              id="movFrom"
              name="movFrom"
              type="date"
              defaultValue={movFromStr}
            />
          </div>
          <div className="space-y-1">
            <label htmlFor="movTo" className="text-xs text-muted-foreground">
              Au
            </label>
            <Input
              id="movTo"
              name="movTo"
              type="date"
              defaultValue={movToStr}
            />
          </div>
          <div className="space-y-1">
            <label htmlFor="movType" className="text-xs text-muted-foreground">
              Type
            </label>
            <Select id="movType" name="movType" defaultValue={movTypeStr}>
              <option value="">Tous</option>
              <option value="IN">Entrée (+)</option>
              <option value="OUT">Sortie (−)</option>
              <option value="ADJUSTMENT">Inventaire</option>
            </Select>
          </div>
          <Button type="submit" variant="secondary">
            Filtrer
          </Button>
          {hasMovFilter && (
            <Button asChild variant="ghost">
              <Link href="/stock">Réinitialiser</Link>
            </Button>
          )}
          {movRef && !movFilterPart && (
            <p className="basis-full text-xs text-destructive">
              Référence introuvable — filtre ignoré.
            </p>
          )}
        </form>
        <div className="overflow-hidden rounded-lg border bg-card">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/60 text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Pièce</th>
                <th className="px-4 py-3">Motif</th>
                <th className="px-4 py-3">Utilisateur</th>
                <th className="px-4 py-3">Quantité</th>
                <th className="px-4 py-3">Stock après</th>
              </tr>
            </thead>
            <tbody>
              {movements.length === 0 && (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-12 text-center text-muted-foreground"
                  >
                    {hasMovFilter
                      ? "Aucun mouvement ne correspond à ces critères."
                      : "Aucun mouvement enregistré."}
                  </td>
                </tr>
              )}
              {movements.map((m) => {
                const isIn = m.quantity >= 0;
                return (
                  <tr key={m.id} className="border-b last:border-0">
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {formatDateTime(m.createdAt)}
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/parts/${m.part.id}`}
                        className="hover:underline"
                      >
                        <span className="font-mono text-xs text-primary">
                          {m.part.reference}
                        </span>
                        <div className="text-xs text-muted-foreground">
                          {m.part.name}
                        </div>
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {m.reason ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {m.createdBy?.name ?? "—"}
                    </td>
                    <td className="px-4 py-3">
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
                        {m.quantity}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 tabular-nums">{m.resulting}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function StockList({
  parts,
  empty,
}: {
  parts: {
    id: string;
    reference: string;
    name: string;
    stockQty: number;
    reorderThreshold: number;
    location: string | null;
  }[];
  empty: string;
}) {
  if (parts.length === 0) {
    return (
      <div className="rounded-lg border bg-card px-4 py-8 text-center text-sm text-muted-foreground">
        {empty}
      </div>
    );
  }
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {parts.map((p) => (
        <Link
          key={p.id}
          href={`/parts/${p.id}`}
          className="flex items-center justify-between gap-2 rounded-lg border bg-card p-3 hover:bg-accent/40"
        >
          <div className="min-w-0">
            <div className="font-mono text-xs text-muted-foreground">
              {p.reference}
              {p.location ? ` · ${p.location}` : ""}
            </div>
            <div className="truncate text-sm">{p.name}</div>
          </div>
          <Badge
            className={
              p.stockQty <= 0
                ? "border-destructive/30 bg-destructive/10 text-destructive"
                : "border-amber-300 bg-amber-100 text-amber-800"
            }
          >
            {p.stockQty} / seuil {p.reorderThreshold}
          </Badge>
        </Link>
      ))}
    </div>
  );
}
