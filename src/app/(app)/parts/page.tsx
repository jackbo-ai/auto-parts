import Link from "next/link";
import { Plus, RotateCcw, Search, Trash2 } from "lucide-react";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireUser, canManageCatalog } from "@/lib/permissions";
import { Button } from "@/components/ui/button";
import { ConfirmSubmit } from "@/components/confirm-submit";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { CustomRangeInput } from "@/components/dashboard/custom-range-input";
import { PeriodFilter } from "@/components/dashboard/period-filter";
import { categoryTone, formatEuro, formatNumber } from "@/lib/utils";
import { describePeriod, parsePeriod, periodBounds } from "@/lib/period";
import { partsPmpMap, partsSalePmpMap } from "@/lib/pmp";
import { deletePart, resetPartStock } from "./actions";

function stockBadge(qty: number, threshold: number) {
  if (qty <= 0) return "border-destructive/30 bg-destructive/10 text-destructive";
  if (qty <= threshold)
    return "border-amber-300 bg-amber-100 text-amber-800";
  return "border-emerald-300 bg-emerald-100 text-emerald-800";
}

export default async function PartsPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    category?: string;
    brand?: string;
    status?: string;
    range?: string;
    from?: string;
    to?: string;
  }>;
}) {
  const me = await requireUser();
  const canManage = canManageCatalog(me.role);
  const params = await searchParams;
  const q = params.q?.trim() ?? "";
  const category = params.category?.trim() ?? "";
  const brand = params.brand?.trim() ?? "";
  const range = parsePeriod(params.range);
  const bounds = periodBounds(range, { from: params.from, to: params.to });
  const periodLabel = describePeriod(range, bounds);

  const where: Prisma.PartWhereInput = {};
  if (q) {
    where.OR = [
      { reference: { contains: q } },
      { name: { contains: q } },
      { brand: { name: { contains: q } } },
    ];
  }
  if (category) where.category = { name: { contains: category } };
  if (brand) where.brand = { name: { contains: brand } };
  if (params.status === "active") where.active = true;
  if (params.status === "inactive") where.active = false;
  if (bounds.start || bounds.end) {
    where.createdAt = {
      ...(bounds.start ? { gte: bounds.start } : {}),
      ...(bounds.end ? { lte: bounds.end } : {}),
    };
  }

  const [parts, categories, brands, allRefs, pmpMap, salePmpMap] =
    await Promise.all([
      prisma.part.findMany({
        where,
        include: {
          category: { select: { name: true } },
          brand: { select: { name: true } },
        },
        orderBy: { reference: "asc" },
        take: 300,
      }),
      prisma.category.findMany({ orderBy: { name: "asc" } }),
      prisma.brand.findMany({ orderBy: { name: "asc" } }),
      prisma.part.findMany({
        select: { reference: true, name: true },
        orderBy: { reference: "asc" },
      }),
      partsPmpMap(),
      partsSalePmpMap(),
    ]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Catalogue</h1>
          <p className="text-sm text-muted-foreground">
            {formatNumber(parts.length)} pièce
            {parts.length > 1 ? "s" : ""} · créées sur{" "}
            <span className="text-foreground">{periodLabel}</span>
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <PeriodFilter
            current={range}
            basePath="/parts"
            preserve={{
              q: q || undefined,
              category: category || undefined,
              brand: brand || undefined,
              status: params.status,
            }}
          />
          <CustomRangeInput
            from={params.from ?? ""}
            to={params.to ?? ""}
            active={range === "custom"}
          />
          {canManage && (
            <>
              <Button asChild variant="outline" size="sm">
                <Link href="/admin/categories">Catégories</Link>
              </Button>
              <Button asChild variant="outline" size="sm">
                <Link href="/admin/brands">Marques</Link>
              </Button>
              <Button asChild size="sm">
                <Link href="/parts/new">
                  <Plus className="h-4 w-4" />
                  Nouvelle pièce
                </Link>
              </Button>
            </>
          )}
        </div>
      </div>

      <form className="flex flex-wrap items-center gap-2" action="/parts">
        {/* Préserve la période quand on soumet le formulaire de recherche. */}
        {params.range && (
          <input type="hidden" name="range" value={params.range} />
        )}
        {params.from && (
          <input type="hidden" name="from" value={params.from} />
        )}
        {params.to && <input type="hidden" name="to" value={params.to} />}
        <div className="relative max-w-xs flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            name="q"
            defaultValue={q}
            list="parts-refs"
            autoComplete="off"
            placeholder="Référence, OEM, désignation…"
            className="pl-8"
          />
          <datalist id="parts-refs">
            {allRefs.map((p) => (
              <option key={p.reference} value={p.reference}>
                {p.name}
              </option>
            ))}
          </datalist>
        </div>
        <div className="max-w-[12rem] flex-1">
          <Input
            name="category"
            defaultValue={category}
            list="parts-categories"
            autoComplete="off"
            placeholder="Toutes les catégories"
          />
          <datalist id="parts-categories">
            {categories.map((c) => (
              <option key={c.id} value={c.name} />
            ))}
          </datalist>
        </div>
        <div className="max-w-[12rem] flex-1">
          <Input
            name="brand"
            defaultValue={brand}
            list="parts-brands"
            autoComplete="off"
            placeholder="Toutes les marques"
          />
          <datalist id="parts-brands">
            {brands.map((b) => (
              <option key={b.id} value={b.name} />
            ))}
          </datalist>
        </div>
        <Select
          name="status"
          defaultValue={params.status ?? ""}
          className="max-w-[12rem]"
        >
          <option value="">Actives et inactives</option>
          <option value="active">Actives</option>
          <option value="inactive">Inactives</option>
        </Select>
        <Button type="submit" variant="secondary" size="sm">
          Filtrer
        </Button>
        {(q || category || brand || params.status) && (
          <Button asChild variant="ghost" size="sm">
            <Link href="/parts">Réinitialiser</Link>
          </Button>
        )}
      </form>

      {/* Mobile: card list */}
      <div className="space-y-2 md:hidden">
        {parts.length === 0 && (
          <div className="rounded-lg border bg-card px-4 py-10 text-center text-sm text-muted-foreground">
            Aucune pièce.
          </div>
        )}
        {parts.map((p) => (
          <Link
            key={p.id}
            href={`/parts/${p.id}`}
            className={`block rounded-lg border p-3 ${
              p.active ? "bg-card" : "bg-muted/50"
            }`}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="font-mono text-sm font-bold text-primary">
                  {p.reference}
                </div>
              </div>
              <Badge className={stockBadge(p.stockQty, p.reorderThreshold)}>
                {formatNumber(p.stockQty)} en stock
              </Badge>
            </div>
            <div className="mt-1 text-sm">{p.name}</div>
            <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
              {p.brand && <span>{p.brand.name}</span>}
              {p.category && (
                <Badge className={categoryTone(p.category.name)}>
                  {p.category.name}
                </Badge>
              )}
              {!p.active && (
                <Badge className="border-slate-300 bg-slate-200 text-slate-700">
                  Inactive
                </Badge>
              )}
            </div>
            <div className="mt-1 flex gap-3 text-sm tabular-nums">
              <span className="font-medium">
                PMP vente {formatEuro(salePmpMap.get(p.id))}
              </span>
              <span className="text-muted-foreground">
                PMP achat {formatEuro(pmpMap.get(p.id))}
              </span>
            </div>
          </Link>
        ))}
      </div>

      {/* Desktop: table */}
      <div className="hidden overflow-hidden rounded-lg border bg-card md:block">
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/60 text-left text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-4 py-3">Référence</th>
              <th className="px-4 py-3">Désignation</th>
              <th className="px-4 py-3">Catégorie</th>
              <th className="px-4 py-3">PMP vente HT</th>
              <th className="px-4 py-3">PMP achat HT</th>
              <th className="px-4 py-3">Stock</th>
              {canManage && <th className="px-4 py-3 text-right">Actions</th>}
            </tr>
          </thead>
          <tbody>
            {parts.length === 0 && (
              <tr>
                <td
                  colSpan={canManage ? 7 : 6}
                  className="px-4 py-12 text-center text-muted-foreground"
                >
                  Aucune pièce.
                </td>
              </tr>
            )}
            {parts.map((p) => (
              <tr
                key={p.id}
                className={`border-b last:border-0 ${
                  p.active ? "hover:bg-accent/40" : "bg-muted/40"
                }`}
              >
                <td className="px-4 py-3">
                  <Link
                    href={`/parts/${p.id}`}
                    className="font-mono font-bold text-primary hover:underline"
                  >
                    {p.reference}
                  </Link>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <span>{p.name}</span>
                    {!p.active && (
                      <Badge className="border-slate-300 bg-slate-200 text-slate-700">
                        Inactive
                      </Badge>
                    )}
                  </div>
                  {p.brand && (
                    <div className="text-xs text-muted-foreground">
                      {p.brand.name}
                    </div>
                  )}
                </td>
                <td className="px-4 py-3">
                  {p.category ? (
                    <Badge className={categoryTone(p.category.name)}>
                      {p.category.name}
                    </Badge>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </td>
                <td className="px-4 py-3 tabular-nums">
                  {formatEuro(salePmpMap.get(p.id))}
                </td>
                <td className="px-4 py-3 tabular-nums text-muted-foreground">
                  {formatEuro(pmpMap.get(p.id))}
                </td>
                <td className="px-4 py-3">
                  <Badge className={stockBadge(p.stockQty, p.reorderThreshold)}>
                    {formatNumber(p.stockQty)}
                    <span className="opacity-70">
                      / seuil {p.reorderThreshold}
                    </span>
                  </Badge>
                </td>
                {canManage && (
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <form action={resetPartStock}>
                        <input type="hidden" name="id" value={p.id} />
                        <ConfirmSubmit
                          variant="ghost"
                          size="sm"
                          disabled={p.stockQty === 0}
                          message={`Remettre le stock de ${p.reference} à 0 ? Un mouvement d'inventaire sera enregistré.`}
                        >
                          <RotateCcw className="h-4 w-4" />
                          <span className="sr-only">Remettre à zéro</span>
                        </ConfirmSubmit>
                      </form>
                      <form action={deletePart}>
                        <input type="hidden" name="id" value={p.id} />
                        <ConfirmSubmit
                          variant="ghost"
                          size="sm"
                          message={`Supprimer définitivement ${p.reference} ? Les mouvements et compatibilités liés seront supprimés.`}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                          <span className="sr-only">Supprimer</span>
                        </ConfirmSubmit>
                      </form>
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
