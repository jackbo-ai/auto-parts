import Link from "next/link";
import { Plus, Search } from "lucide-react";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireUser, canManageCatalog } from "@/lib/permissions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { formatEuro, formatNumber } from "@/lib/utils";
import { partsPmpMap } from "@/lib/pmp";

function stockBadge(qty: number, threshold: number) {
  if (qty <= 0) return "border-destructive/30 bg-destructive/10 text-destructive";
  if (qty <= threshold)
    return "border-amber-300 bg-amber-100 text-amber-800";
  return "border-emerald-300 bg-emerald-100 text-emerald-800";
}

export default async function PartsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; categoryId?: string; status?: string }>;
}) {
  const me = await requireUser();
  const params = await searchParams;
  const q = params.q?.trim() ?? "";

  const where: Prisma.PartWhereInput = {};
  if (q) {
    where.OR = [
      { reference: { contains: q } },
      { oemReference: { contains: q } },
      { name: { contains: q } },
      { brand: { contains: q } },
    ];
  }
  if (params.categoryId) where.categoryId = params.categoryId;
  if (params.status === "active") where.active = true;
  if (params.status === "inactive") where.active = false;

  const [parts, categories, pmpMap] = await Promise.all([
    prisma.part.findMany({
      where,
      include: { category: { select: { name: true } } },
      orderBy: { reference: "asc" },
      take: 300,
    }),
    prisma.category.findMany({ orderBy: { name: "asc" } }),
    partsPmpMap(),
  ]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold">Catalogue</h1>
        <div className="flex gap-2">
          {canManageCatalog(me.role) && (
            <>
              <Button asChild variant="outline" size="sm">
                <Link href="/categories">Catégories</Link>
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
        <div className="relative max-w-xs flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            name="q"
            defaultValue={q}
            placeholder="Référence, OEM, désignation…"
            className="pl-8"
          />
        </div>
        <Select
          name="categoryId"
          defaultValue={params.categoryId ?? ""}
          className="max-w-xs"
        >
          <option value="">Toutes les catégories</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
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
        {(q || params.categoryId || params.status) && (
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
                {p.oemReference && (
                  <div className="font-mono text-xs text-muted-foreground">
                    OEM {p.oemReference}
                  </div>
                )}
              </div>
              <Badge className={stockBadge(p.stockQty, p.reorderThreshold)}>
                {formatNumber(p.stockQty)} en stock
              </Badge>
            </div>
            <div className="mt-1 text-sm">{p.name}</div>
            <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
              {p.brand && <span>{p.brand}</span>}
              {p.category && <span>· {p.category.name}</span>}
              {!p.active && (
                <Badge className="border-slate-300 bg-slate-200 text-slate-700">
                  Inactive
                </Badge>
              )}
            </div>
            <div className="mt-1 flex gap-3 text-sm tabular-nums">
              <span className="font-medium">
                {formatEuro(p.salePriceHt)} HT
              </span>
              <span className="text-muted-foreground">
                PMP {formatEuro(pmpMap.get(p.id))}
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
              <th className="px-4 py-3">Prix vente HT</th>
              <th className="px-4 py-3">PMP HT</th>
              <th className="px-4 py-3">Stock</th>
            </tr>
          </thead>
          <tbody>
            {parts.length === 0 && (
              <tr>
                <td
                  colSpan={6}
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
                  {p.oemReference && (
                    <div className="font-mono text-xs text-muted-foreground">
                      OEM {p.oemReference}
                    </div>
                  )}
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
                      {p.brand}
                    </div>
                  )}
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {p.category?.name ?? "—"}
                </td>
                <td className="px-4 py-3 tabular-nums">
                  {formatEuro(p.salePriceHt)}
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
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
