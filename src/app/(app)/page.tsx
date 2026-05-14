import Link from "next/link";
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  Boxes,
  Package,
  Percent,
  ShoppingCart,
  Receipt,
  Truck,
} from "lucide-react";
import {
  PurchaseOrderStatus,
  SalesOrderStatus,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { Badge } from "@/components/ui/badge";
import { formatDateTime, formatEuro, formatNumber } from "@/lib/utils";
import { orderTotals } from "@/lib/totals";

export default async function DashboardPage() {
  const [
    parts,
    suppliersCount,
    categoriesCount,
    recentMovements,
    receivedPurchases,
    billedSales,
  ] = await Promise.all([
    prisma.part.findMany({
      where: { active: true },
      select: {
        id: true,
        reference: true,
        name: true,
        stockQty: true,
        reorderThreshold: true,
        purchasePriceHt: true,
      },
    }),
    prisma.supplier.count(),
    prisma.category.count(),
    prisma.stockMovement.findMany({
      orderBy: { createdAt: "desc" },
      take: 8,
      include: {
        part: { select: { reference: true, name: true } },
        createdBy: { select: { name: true } },
      },
    }),
    // CA fournisseur : commandes d'achat réceptionnées.
    prisma.purchaseOrder.findMany({
      where: { status: PurchaseOrderStatus.RECEIVED },
      select: { lines: { select: { quantity: true, unitPriceHt: true, vatRate: true } } },
    }),
    // CA client : commandes livrées ou facturées.
    prisma.salesOrder.findMany({
      where: {
        status: { in: [SalesOrderStatus.DELIVERED, SalesOrderStatus.INVOICED] },
      },
      select: {
        lines: {
          select: {
            quantity: true,
            unitPriceHt: true,
            vatRate: true,
            unitCostHt: true,
          },
        },
      },
    }),
  ]);

  const lowStock = parts.filter((p) => p.stockQty <= p.reorderThreshold);
  const stockValue = parts.reduce(
    (sum, p) => sum + (p.purchasePriceHt ?? 0) * p.stockQty,
    0,
  );

  // CA TTC fournisseur — somme TTC des lignes des commandes réceptionnées.
  const caFournisseurTtc = receivedPurchases.reduce(
    (sum, o) => sum + orderTotals(o.lines).ttc,
    0,
  );

  // CA TTC client — somme TTC des lignes des commandes livrées/facturées.
  const caClientTtc = billedSales.reduce(
    (sum, o) => sum + orderTotals(o.lines).ttc,
    0,
  );

  // Marge TTC — CA client TTC moins le coût d'achat TTC des pièces vendues
  // (coût unitaire figé à la livraison sur chaque ligne).
  const coutVentesTtc = billedSales.reduce((sum, o) => {
    return (
      sum +
      o.lines.reduce(
        (s, l) => s + (l.unitCostHt ?? 0) * l.quantity * (1 + l.vatRate),
        0,
      )
    );
  }, 0);
  const margeTtc = Math.round((caClientTtc - coutVentesTtc) * 100) / 100;

  const operationalKpis = [
    {
      label: "Pièces actives",
      value: formatNumber(parts.length),
      icon: Package,
      href: "/parts",
    },
    {
      label: "Sous le seuil",
      value: formatNumber(lowStock.length),
      icon: AlertTriangle,
      href: "/stock",
      alert: lowStock.length > 0,
    },
    {
      label: "Valeur du stock (achat HT)",
      value: formatEuro(stockValue),
      icon: Boxes,
      href: "/stock",
    },
    {
      label: "Fournisseurs",
      value: formatNumber(suppliersCount),
      icon: Truck,
      href: "/suppliers",
    },
  ];

  const financialKpis = [
    {
      label: "CA TTC fournisseur",
      value: formatEuro(caFournisseurTtc),
      icon: ShoppingCart,
      href: "/purchase-orders",
    },
    {
      label: "CA TTC client",
      value: formatEuro(caClientTtc),
      icon: Receipt,
      href: "/sales-orders",
    },
    {
      label: "Marge TTC",
      value: formatEuro(margeTtc),
      icon: Percent,
      href: "/sales-orders",
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Tableau de bord</h1>
        <p className="text-sm text-muted-foreground">
          {formatNumber(parts.length)} pièces · {formatNumber(categoriesCount)}{" "}
          catégories
        </p>
      </div>

      <div>
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Indicateurs financiers
        </h2>
        <div className="grid gap-3 sm:grid-cols-3">
          {financialKpis.map(({ label, value, icon: Icon, href }) => (
            <Link
              key={label}
              href={href}
              className="rounded-lg border bg-card p-4 transition-colors hover:bg-accent/40"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs uppercase tracking-wide text-muted-foreground">
                  {label}
                </span>
                <Icon className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="mt-2 text-2xl font-semibold tabular-nums">
                {value}
              </div>
            </Link>
          ))}
        </div>
      </div>

      <div>
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Catalogue & stock
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {operationalKpis.map(({ label, value, icon: Icon, href, alert }) => (
            <Link
              key={label}
              href={href}
              className={`rounded-lg border bg-card p-4 transition-colors hover:bg-accent/40 ${
                alert ? "border-destructive/40" : ""
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs uppercase tracking-wide text-muted-foreground">
                  {label}
                </span>
                <Icon
                  className={`h-4 w-4 ${
                    alert ? "text-destructive" : "text-muted-foreground"
                  }`}
                />
              </div>
              <div
                className={`mt-2 text-2xl font-semibold tabular-nums ${
                  alert ? "text-destructive" : ""
                }`}
              >
                {value}
              </div>
            </Link>
          ))}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="space-y-2">
          <h2 className="flex items-center gap-2 text-base font-medium">
            <AlertTriangle className="h-4 w-4 text-destructive" />
            Réapprovisionnement
          </h2>
          <div className="space-y-2">
            {lowStock.length === 0 && (
              <div className="rounded-lg border bg-card px-4 py-8 text-center text-sm text-muted-foreground">
                Aucune pièce sous son seuil. Tout est en stock.
              </div>
            )}
            {lowStock.map((p) => (
              <Link
                key={p.id}
                href={`/parts/${p.id}`}
                className="flex items-center justify-between rounded-lg border bg-card p-3 hover:bg-accent/40"
              >
                <div className="min-w-0">
                  <div className="font-mono text-xs text-muted-foreground">
                    {p.reference}
                  </div>
                  <div className="truncate text-sm">{p.name}</div>
                </div>
                <Badge className="border-destructive/30 bg-destructive/10 text-destructive">
                  {p.stockQty} / seuil {p.reorderThreshold}
                </Badge>
              </Link>
            ))}
          </div>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-medium">Derniers mouvements de stock</h2>
          <div className="space-y-2">
            {recentMovements.length === 0 && (
              <div className="rounded-lg border bg-card px-4 py-8 text-center text-sm text-muted-foreground">
                Aucun mouvement enregistré.
              </div>
            )}
            {recentMovements.map((m) => {
              const isIn = m.quantity >= 0;
              return (
                <div
                  key={m.id}
                  className="flex items-center justify-between rounded-lg border bg-card p-3"
                >
                  <div className="min-w-0">
                    <div className="font-mono text-xs text-muted-foreground">
                      {m.part.reference}
                    </div>
                    <div className="truncate text-sm">{m.part.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {formatDateTime(m.createdAt)}
                      {m.createdBy ? ` · ${m.createdBy.name}` : ""}
                    </div>
                  </div>
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
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
}
