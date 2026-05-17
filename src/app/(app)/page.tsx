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
import { CategoryFilter } from "@/components/dashboard/category-filter";
import { CustomRangeInput } from "@/components/dashboard/custom-range-input";
import { DigitalReadout } from "@/components/dashboard/digital-readout";
import { PeriodFilter } from "@/components/dashboard/period-filter";
import { SupplierFilter } from "@/components/dashboard/supplier-filter";
import { formatDateTime, formatEuro, formatNumber } from "@/lib/utils";
import { orderTotals } from "@/lib/totals";
import { describePeriod, parsePeriod, periodBounds } from "@/lib/period";
import { partsPmpMap, partsPmpTtcMap } from "@/lib/pmp";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{
    range?: string;
    supplier?: string;
    category?: string;
    from?: string;
    to?: string;
  }>;
}) {
  const {
    range: rangeParam,
    supplier: supplierParam,
    category: categoryParam,
    from: fromParam,
    to: toParam,
  } = await searchParams;
  const range = parsePeriod(rangeParam);
  const bounds = periodBounds(range, { from: fromParam, to: toParam });
  const periodLabel = describePeriod(range, bounds);
  const supplierId = supplierParam?.trim() || undefined;
  const categoryId = categoryParam?.trim() || undefined;

  // Filtres date pour chaque source. `start`/`end` null ⇒ borne ouverte.
  // CA fournisseur : date de réception. CA client / top ventes : date de livraison
  // (les commandes facturées sont passées par DELIVERED, donc deliveredAt est posé).
  // Mouvements de stock : date de création.
  const dateRange: { gte?: Date; lte?: Date } | undefined =
    bounds.start || bounds.end
      ? {
          ...(bounds.start ? { gte: bounds.start } : {}),
          ...(bounds.end ? { lte: bounds.end } : {}),
        }
      : undefined;
  const salesDateFilter = dateRange ? { deliveredAt: dateRange } : {};
  const purchasesDateFilter = dateRange ? { receivedAt: dateRange } : {};
  const movementsDateFilter = dateRange ? { createdAt: dateRange } : {};

  // Filtres fournisseur / catégorie sur les pièces. Combinés en un seul prédicat
  // `part: {...}` réutilisé partout. Sur les ventes : on ne garde que les lignes
  // dont la pièce match, à la fois pour le `where` (au moins une ligne) et pour
  // le `select.lines` (n'agréger que ces lignes-là).
  const partWhere: { supplierId?: string; categoryId?: string } = {};
  if (supplierId) partWhere.supplierId = supplierId;
  if (categoryId) partWhere.categoryId = categoryId;
  const hasPartFilter = Object.keys(partWhere).length > 0;
  const partFilter = hasPartFilter ? partWhere : undefined;
  const linesPartFilter = partFilter
    ? { some: { part: partFilter } }
    : undefined;

  const [
    parts,
    suppliers,
    categories,
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
      where: { active: true, ...(partFilter ?? {}) },
      select: {
        id: true,
        reference: true,
        name: true,
        stockQty: true,
        reorderThreshold: true,
      },
    }),
    prisma.supplier.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.category.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.supplier.count(),
    prisma.category.count(),
    prisma.stockMovement.findMany({
      where: {
        ...movementsDateFilter,
        ...(partFilter ? { part: partFilter } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: 8,
      include: {
        part: { select: { reference: true, name: true } },
        createdBy: { select: { name: true } },
      },
    }),
    // CA fournisseur : commandes d'achat réceptionnées sur la période. Filtre
    // supplier au niveau commande ; filtre catégorie au niveau des lignes
    // (au moins une ligne avec une pièce de la catégorie).
    prisma.purchaseOrder.findMany({
      where: {
        status: PurchaseOrderStatus.RECEIVED,
        ...purchasesDateFilter,
        ...(supplierId ? { supplierId } : {}),
        ...(categoryId
          ? { lines: { some: { part: { categoryId } } } }
          : {}),
      },
      select: {
        lines: {
          where: categoryId ? { part: { categoryId } } : undefined,
          select: { quantity: true, unitPriceHt: true, vatRate: true },
        },
      },
    }),
    // CA client : commandes livrées ou facturées sur la période, lignes
    // restreintes au fournisseur / catégorie sélectionnés le cas échéant.
    prisma.salesOrder.findMany({
      where: {
        status: { in: [SalesOrderStatus.DELIVERED, SalesOrderStatus.INVOICED] },
        ...salesDateFilter,
        ...(linesPartFilter ? { lines: linesPartFilter } : {}),
      },
      select: {
        lines: {
          where: partFilter ? { part: partFilter } : undefined,
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
          ...salesDateFilter,
        },
        ...(partFilter ? { part: partFilter } : {}),
      },
      _sum: { quantity: true },
      orderBy: { _sum: { quantity: "desc" } },
      take: 5,
    }),
  ]);

  const selectedSupplier = supplierId
    ? suppliers.find((s) => s.id === supplierId)
    : undefined;
  const selectedCategory = categoryId
    ? categories.find((c) => c.id === categoryId)
    : undefined;

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
      tone: "danger" as const,
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
      tone: "danger" as const,
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
      tone: margeTtc < 0 ? ("danger" as const) : ("info" as const),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Tableau de bord</h1>
          <p className="text-sm text-muted-foreground">
            {formatNumber(parts.length)} pièces ·{" "}
            {formatNumber(categoriesCount)} catégories
            {selectedSupplier ? ` · ${selectedSupplier.name}` : ""}
            {selectedCategory ? ` · ${selectedCategory.name}` : ""}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <SupplierFilter suppliers={suppliers} current={supplierId ?? ""} />
          <CategoryFilter categories={categories} current={categoryId ?? ""} />
          <PeriodFilter
            current={range}
            preserve={{ supplier: supplierId, category: categoryId }}
          />
          <CustomRangeInput
            from={fromParam ?? ""}
            to={toParam ?? ""}
            active={range === "custom"}
          />
        </div>
      </div>

      <div className="space-y-2">
        <h2 className="text-sm font-medium text-muted-foreground">
          Indicateurs financiers ·{" "}
          <span className="text-foreground">{periodLabel}</span>
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
              <span className="ml-auto text-xs font-normal text-muted-foreground">
                {periodLabel}
              </span>
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
              <span className="ml-auto text-xs font-normal text-muted-foreground">
                {periodLabel}
              </span>
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
