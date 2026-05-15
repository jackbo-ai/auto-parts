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
  TrendingUp,
  Truck,
} from "lucide-react";
import {
  PurchaseOrderStatus,
  SalesOrderStatus,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DigitalReadout } from "@/components/dashboard/digital-readout";
import { formatDateTime, formatEuro, formatNumber } from "@/lib/utils";
import { orderTotals } from "@/lib/totals";
import { partsPmpMap, partsPmpTtcMap } from "@/lib/pmp";

export default async function DashboardPage() {
  const [
    parts,
    suppliersCount,
    categoriesCount,
    recentMovements,
    receivedPurchases,
    billedSales,
    pmpAchatMap,
    pmpAchatTtcMap,
    topSoldGroups,
  ] = await Promise.all([
    prisma.part.findMany({
      where: { active: true },
      select: {
        id: true,
        reference: true,
        name: true,
        stockQty: true,
        reorderThreshold: true,
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
    partsPmpMap(),
    partsPmpTtcMap(),
    prisma.salesOrderLine.groupBy({
      by: ["partId"],
      where: {
        salesOrder: {
          status: {
            in: [SalesOrderStatus.DELIVERED, SalesOrderStatus.INVOICED],
          },
        },
      },
      _sum: { quantity: true },
      orderBy: { _sum: { quantity: "desc" } },
      take: 5,
    }),
  ]);

  const topSoldParts = topSoldGroups.length
    ? await prisma.part.findMany({
        where: { id: { in: topSoldGroups.map((g) => g.partId) } },
        select: { id: true, reference: true, name: true },
      })
    : [];
  const topSoldPartsMap = new Map(topSoldParts.map((p) => [p.id, p]));
  const topSold = topSoldGroups.flatMap((g) => {
    const p = topSoldPartsMap.get(g.partId);
    return p ? [{ ...p, qty: g._sum.quantity ?? 0 }] : [];
  });

  const lowStock = parts.filter((p) => p.stockQty <= p.reorderThreshold);
  // Valeur du stock au PMP achat (le coût de référence figé n'existe plus).
  const stockValueHt = parts.reduce(
    (sum, p) => sum + (pmpAchatMap.get(p.id) ?? 0) * p.stockQty,
    0,
  );
  const stockValueTtc = parts.reduce(
    (sum, p) => sum + (pmpAchatTtcMap.get(p.id) ?? 0) * p.stockQty,
    0,
  );

  // CA fournisseur — somme des lignes des commandes réceptionnées.
  const caFournisseurHt = receivedPurchases.reduce(
    (sum, o) => sum + orderTotals(o.lines).ht,
    0,
  );
  const caFournisseurTtc = receivedPurchases.reduce(
    (sum, o) => sum + orderTotals(o.lines).ttc,
    0,
  );

  // CA client — somme des lignes des commandes livrées/facturées.
  const caClientHt = billedSales.reduce(
    (sum, o) => sum + orderTotals(o.lines).ht,
    0,
  );
  const caClientTtc = billedSales.reduce(
    (sum, o) => sum + orderTotals(o.lines).ttc,
    0,
  );

  // Marge — CA client moins le coût d'achat des pièces vendues (coût unitaire
  // figé à la livraison sur chaque ligne).
  const coutVentesHt = billedSales.reduce((sum, o) => {
    return (
      sum +
      o.lines.reduce((s, l) => s + (l.unitCostHt ?? 0) * l.quantity, 0)
    );
  }, 0);
  const coutVentesTtc = billedSales.reduce((sum, o) => {
    return (
      sum +
      o.lines.reduce(
        (s, l) => s + (l.unitCostHt ?? 0) * l.quantity * (1 + l.vatRate),
        0,
      )
    );
  }, 0);
  const margeHt = Math.round((caClientHt - coutVentesHt) * 100) / 100;
  const margeTtc = Math.round((caClientTtc - coutVentesTtc) * 100) / 100;

  const dualAmount = (ttc: number, ht: number) => (
    <div className="flex flex-col gap-0.5 leading-tight">
      <div className="flex items-baseline gap-1.5">
        <span>{formatEuro(ttc)}</span>
        <span className="text-[10px] font-normal uppercase tracking-widest opacity-60">
          TTC
        </span>
      </div>
      <div className="flex items-baseline gap-1.5 text-base opacity-70">
        <span>{formatEuro(ht)}</span>
        <span className="text-[10px] font-normal uppercase tracking-widest opacity-60">
          HT
        </span>
      </div>
    </div>
  );

  const operationalKpis = [
    {
      label: "Pièces actives",
      value: formatNumber(parts.length),
      icon: Package,
      href: "/parts",
      tone: "default" as const,
    },
    {
      label: "Sous le seuil",
      value: formatNumber(lowStock.length),
      icon: AlertTriangle,
      href: "/stock",
      tone: lowStock.length > 0 ? ("danger" as const) : ("default" as const),
    },
    {
      label: "Valeur du stock (achat)",
      value: dualAmount(stockValueTtc, stockValueHt),
      icon: Boxes,
      href: "/stock",
      tone: "info" as const,
    },
    {
      label: "Fournisseurs",
      value: formatNumber(suppliersCount),
      icon: Truck,
      href: "/suppliers",
      tone: "default" as const,
    },
  ];

  const financialKpis = [
    {
      label: "CA fournisseur",
      value: dualAmount(caFournisseurTtc, caFournisseurHt),
      icon: ShoppingCart,
      href: "/purchase-orders",
      tone: "default" as const,
    },
    {
      label: "CA client",
      value: dualAmount(caClientTtc, caClientHt),
      icon: Receipt,
      href: "/sales-orders",
      tone: "success" as const,
    },
    {
      label: "Marge",
      value: dualAmount(margeTtc, margeHt),
      icon: Percent,
      href: "/sales-orders",
      tone: margeTtc < 0 ? ("danger" as const) : ("success" as const),
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

      <div className="space-y-2">
        <h2 className="text-sm font-medium text-muted-foreground">
          Indicateurs financiers
        </h2>
        <div className="grid gap-4 sm:grid-cols-3">
          {financialKpis.map(({ label, value, icon: Icon, href, tone }) => (
            <DigitalReadout
              key={label}
              label={label}
              value={value}
              href={href}
              tone={tone}
              icon={<Icon className="h-3.5 w-3.5" />}
            />
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <h2 className="text-sm font-medium text-muted-foreground">
          Catalogue & stock
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {operationalKpis.map(({ label, value, icon: Icon, href, tone }) => (
            <DigitalReadout
              key={label}
              label={label}
              value={value}
              href={href}
              tone={tone}
              icon={<Icon className="h-3.5 w-3.5" />}
            />
          ))}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <TrendingUp className="h-4 w-4 text-emerald-600" />
              Top 5 articles vendus
            </CardTitle>
          </CardHeader>
          <CardContent>
            {topSold.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Aucune vente enregistrée.
              </p>
            ) : (
              <ul className="divide-y">
                {topSold.map((p) => (
                  <li key={p.id} className="py-2.5">
                    <Link
                      href={`/parts/${p.id}`}
                      className="flex items-start justify-between gap-2 hover:bg-accent/40"
                    >
                      <div className="min-w-0">
                        <div className="font-mono text-xs text-muted-foreground">
                          {p.reference}
                        </div>
                        <div className="truncate text-sm">{p.name}</div>
                      </div>
                      <Badge className="border-emerald-300 bg-emerald-100 text-emerald-800">
                        {formatNumber(p.qty)} vendus
                      </Badge>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              Derniers mouvements de stock
            </CardTitle>
          </CardHeader>
          <CardContent>
            {recentMovements.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Aucun mouvement enregistré.
              </p>
            ) : (
              <ul className="divide-y">
                {recentMovements.map((m) => {
                  const isIn = m.quantity >= 0;
                  return (
                    <li
                      key={m.id}
                      className="flex items-start justify-between gap-2 py-2.5"
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
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
