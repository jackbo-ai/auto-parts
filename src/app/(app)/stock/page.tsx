import Link from "next/link";
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  PackageX,
} from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/permissions";
import { Badge } from "@/components/ui/badge";
import { formatDateTime, formatEuro, formatNumber } from "@/lib/utils";

export default async function StockPage() {
  await requireUser();

  const [parts, recentMovements] = await Promise.all([
    prisma.part.findMany({
      where: { active: true },
      select: {
        id: true,
        reference: true,
        name: true,
        stockQty: true,
        reorderThreshold: true,
        purchasePriceHt: true,
        location: true,
      },
      orderBy: { reference: "asc" },
    }),
    prisma.stockMovement.findMany({
      orderBy: { createdAt: "desc" },
      take: 30,
      include: {
        part: { select: { id: true, reference: true, name: true } },
        createdBy: { select: { name: true } },
      },
    }),
  ]);

  const outOfStock = parts.filter((p) => p.stockQty <= 0);
  const lowStock = parts.filter(
    (p) => p.stockQty > 0 && p.stockQty <= p.reorderThreshold,
  );
  const stockValue = parts.reduce(
    (sum, p) => sum + (p.purchasePriceHt ?? 0) * p.stockQty,
    0,
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Stock</h1>
        <p className="text-sm text-muted-foreground">
          Valeur totale (prix d&apos;achat HT) : {formatEuro(stockValue)}
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-lg border bg-card p-4">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">
            Pièces en rupture
          </div>
          <div className="mt-1 text-2xl font-semibold tabular-nums text-destructive">
            {formatNumber(outOfStock.length)}
          </div>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">
            Sous le seuil
          </div>
          <div className="mt-1 text-2xl font-semibold tabular-nums text-amber-600">
            {formatNumber(lowStock.length)}
          </div>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">
            Références actives
          </div>
          <div className="mt-1 text-2xl font-semibold tabular-nums">
            {formatNumber(parts.length)}
          </div>
        </div>
      </div>

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
        <h2 className="text-base font-medium">
          Mouvements récents ({recentMovements.length})
        </h2>
        <div className="overflow-hidden rounded-lg border bg-card">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/60 text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Pièce</th>
                <th className="px-4 py-3">Motif</th>
                <th className="px-4 py-3">Quantité</th>
                <th className="px-4 py-3">Stock après</th>
              </tr>
            </thead>
            <tbody>
              {recentMovements.length === 0 && (
                <tr>
                  <td
                    colSpan={5}
                    className="px-4 py-12 text-center text-muted-foreground"
                  >
                    Aucun mouvement enregistré.
                  </td>
                </tr>
              )}
              {recentMovements.map((m) => {
                const isIn = m.quantity >= 0;
                return (
                  <tr key={m.id} className="border-b last:border-0">
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {formatDateTime(m.createdAt)}
                      {m.createdBy ? (
                        <div>{m.createdBy.name}</div>
                      ) : null}
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
