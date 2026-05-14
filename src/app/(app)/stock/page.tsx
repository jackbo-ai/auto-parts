import Link from "next/link";
import {
  AlertTriangle,
  Archive,
  ArrowDownRight,
  ArrowUpRight,
  Boxes,
  PackageX,
} from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/permissions";
import { Badge } from "@/components/ui/badge";
import { DigitalReadout } from "@/components/dashboard/digital-readout";
import { formatDateTime, formatEuro, formatNumber } from "@/lib/utils";
import { partsPmpMap } from "@/lib/pmp";

export default async function StockPage() {
  await requireUser();

  const [parts, recentMovements, pmpAchatMap, inactiveCount] =
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
      prisma.stockMovement.findMany({
        orderBy: { createdAt: "desc" },
        take: 30,
        include: {
          part: { select: { id: true, reference: true, name: true } },
          createdBy: { select: { name: true } },
        },
      }),
      partsPmpMap(),
      prisma.part.count({ where: { active: false } }),
    ]);

  // « À réapprovisionner » = tout ce qui est au niveau du seuil ou en dessous,
  // ruptures comprises (cohérent avec le tableau de bord). « Ruptures de
  // stock » est un sous-ensemble urgent mis en avant à part.
  const outOfStock = parts.filter((p) => p.stockQty <= 0);
  const lowStock = parts.filter((p) => p.stockQty <= p.reorderThreshold);
  // Valeur du stock au PMP achat (le coût de référence figé n'existe plus).
  const stockValue = parts.reduce(
    (sum, p) => sum + (pmpAchatMap.get(p.id) ?? 0) * p.stockQty,
    0,
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Stock</h1>
        <p className="text-sm text-muted-foreground">
          Valeur totale (PMP achat HT) : {formatEuro(stockValue)}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <DigitalReadout
          label="Pièces en rupture"
          value={formatNumber(outOfStock.length)}
          tone={outOfStock.length > 0 ? "danger" : "default"}
          icon={<PackageX className="h-3.5 w-3.5" />}
        />
        <DigitalReadout
          label="Sous le seuil"
          value={formatNumber(lowStock.length)}
          tone={lowStock.length > 0 ? "warning" : "default"}
          icon={<AlertTriangle className="h-3.5 w-3.5" />}
        />
        <DigitalReadout
          label="Références actives"
          value={formatNumber(parts.length)}
          icon={<Boxes className="h-3.5 w-3.5" />}
        />
        <DigitalReadout
          label="Pièces inactives"
          value={formatNumber(inactiveCount)}
          icon={<Archive className="h-3.5 w-3.5" />}
        />
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
