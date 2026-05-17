import Link from "next/link";
import { Plus } from "lucide-react";
import type { Prisma } from "@prisma/client";
import { SalesOrderStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireUser, canManageOrders } from "@/lib/permissions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CategoryFilter } from "@/components/dashboard/category-filter";
import { CustomRangeInput } from "@/components/dashboard/custom-range-input";
import { CustomerFilter } from "@/components/dashboard/customer-filter";
import { PartRefFilter } from "@/components/dashboard/part-ref-filter";
import { PeriodFilter } from "@/components/dashboard/period-filter";
import { formatDate, formatEuro } from "@/lib/utils";
import { describePeriod, parsePeriod, periodBounds } from "@/lib/period";
import { orderTotals } from "@/lib/totals";
import { SALES_STATUS_BADGE, SALES_STATUS_LABELS } from "@/lib/orders";

type SalesOrderRow = Prisma.SalesOrderGetPayload<{
  include: { customer: { select: { name: true } }; lines: true };
}>;

function OrdersTable({ orders }: { orders: SalesOrderRow[] }) {
  return (
    <div className="overflow-hidden rounded-lg border bg-card">
      <table className="w-full text-sm">
        <thead className="border-b bg-muted/60 text-left text-xs uppercase text-muted-foreground">
          <tr>
            <th className="px-4 py-3">Référence</th>
            <th className="px-4 py-3">Client</th>
            <th className="px-4 py-3">Date</th>
            <th className="px-4 py-3">Lignes</th>
            <th className="px-4 py-3 text-right">Total TTC</th>
            <th className="px-4 py-3">Statut</th>
          </tr>
        </thead>
        <tbody>
          {orders.map((o) => {
            const totals = orderTotals(o.lines);
            return (
              <tr
                key={o.id}
                className="border-b last:border-0 hover:bg-accent/40"
              >
                <td className="px-4 py-3">
                  <Link
                    href={`/sales-orders/${o.id}`}
                    className="font-mono text-xs text-primary hover:underline"
                  >
                    {o.reference}
                  </Link>
                </td>
                <td className="px-4 py-3">{o.customer.name}</td>
                <td className="px-4 py-3 text-muted-foreground">
                  {formatDate(o.orderDate)}
                </td>
                <td className="px-4 py-3 tabular-nums">{o.lines.length}</td>
                <td className="px-4 py-3 text-right tabular-nums">
                  {formatEuro(totals.ttc)}
                </td>
                <td className="px-4 py-3">
                  <Badge className={SALES_STATUS_BADGE[o.status]}>
                    {SALES_STATUS_LABELS[o.status]}
                  </Badge>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default async function SalesOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{
    range?: string;
    from?: string;
    to?: string;
    customer?: string;
    category?: string;
    part?: string;
  }>;
}) {
  const me = await requireUser();
  const canManage = canManageOrders(me.role);
  const {
    range: rangeParam,
    from: fromParam,
    to: toParam,
    customer: customerParam,
    category: categoryParam,
    part: partParam,
  } = await searchParams;
  const range = parsePeriod(rangeParam);
  const bounds = periodBounds(range, { from: fromParam, to: toParam });
  const periodLabel = describePeriod(range, bounds);
  const customerId = customerParam?.trim() || undefined;
  const categoryId = categoryParam?.trim() || undefined;
  const partRef = partParam?.trim() || undefined;

  const orderDateFilter: { gte?: Date; lte?: Date } | undefined =
    bounds.start || bounds.end
      ? {
          ...(bounds.start ? { gte: bounds.start } : {}),
          ...(bounds.end ? { lte: bounds.end } : {}),
        }
      : undefined;

  // Combine catégorie + référence article dans le même prédicat `lines.some.part`
  // pour s'assurer qu'une même ligne valide les deux critères.
  const linePartFilter: { categoryId?: string; reference?: { contains: string } } =
    {};
  if (categoryId) linePartFilter.categoryId = categoryId;
  if (partRef) linePartFilter.reference = { contains: partRef };
  const hasLineFilter = Object.keys(linePartFilter).length > 0;

  const [orders, customers, categories, allRefs] = await Promise.all([
    prisma.salesOrder.findMany({
      where: {
        ...(orderDateFilter ? { orderDate: orderDateFilter } : {}),
        ...(customerId ? { customerId } : {}),
        ...(hasLineFilter
          ? { lines: { some: { part: linePartFilter } } }
          : {}),
      },
      orderBy: { orderDate: "desc" },
      include: {
        customer: { select: { name: true } },
        lines: true,
      },
    }),
    prisma.customer.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.category.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.part.findMany({
      orderBy: { reference: "asc" },
      select: { reference: true, name: true },
    }),
  ]);
  const selectedCustomer = customerId
    ? customers.find((c) => c.id === customerId)
    : undefined;
  const selectedCategory = categoryId
    ? categories.find((c) => c.id === categoryId)
    : undefined;

  const activeOrders = orders.filter(
    (o) => o.status !== SalesOrderStatus.CANCELLED,
  );
  const cancelledOrders = orders.filter(
    (o) => o.status === SalesOrderStatus.CANCELLED,
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Commandes client</h1>
          <p className="text-sm text-muted-foreground">
            {orders.length} commande{orders.length > 1 ? "s" : ""} ·{" "}
            <span className="text-foreground">{periodLabel}</span>
            {selectedCustomer ? ` · ${selectedCustomer.name}` : ""}
            {selectedCategory ? ` · ${selectedCategory.name}` : ""}
            {partRef ? ` · ${partRef}` : ""}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <CustomerFilter customers={customers} current={customerId ?? ""} />
          <CategoryFilter categories={categories} current={categoryId ?? ""} />
          <PartRefFilter refs={allRefs} current={partRef ?? ""} />
          <PeriodFilter
            current={range}
            basePath="/sales-orders"
            preserve={{
              customer: customerId,
              category: categoryId,
              part: partRef,
            }}
          />
          <CustomRangeInput
            from={fromParam ?? ""}
            to={toParam ?? ""}
            active={range === "custom"}
          />
          {canManage && (
            <Button asChild>
              <Link href="/sales-orders/new">
                <Plus className="h-4 w-4" />
                Nouvelle commande
              </Link>
            </Button>
          )}
        </div>
      </div>

      {orders.length === 0 && (
        <div className="rounded-lg border bg-card px-4 py-10 text-center text-sm text-muted-foreground">
          Aucune commande client sur cette période.
        </div>
      )}

      {activeOrders.length > 0 && <OrdersTable orders={activeOrders} />}

      {cancelledOrders.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-medium text-muted-foreground">
            Commandes annulées ({cancelledOrders.length})
          </h2>
          <OrdersTable orders={cancelledOrders} />
        </section>
      )}
    </div>
  );
}
