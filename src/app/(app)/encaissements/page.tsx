import Link from "next/link";
import {
  AlertCircle,
  BadgeEuro,
  Banknote,
  Coins,
  Trash2,
} from "lucide-react";
import { SalesOrderStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/permissions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { ConfirmSubmit } from "@/components/confirm-submit";
import { CategoryFilter } from "@/components/dashboard/category-filter";
import { CustomRangeInput } from "@/components/dashboard/custom-range-input";
import { CustomerFilter } from "@/components/dashboard/customer-filter";
import { DigitalReadout } from "@/components/dashboard/digital-readout";
import { PeriodFilter } from "@/components/dashboard/period-filter";
import {
  PaymentsChart,
  type ChartPoint,
} from "@/components/encaissements/payments-chart";
import {
  describePeriod,
  parsePeriod,
  periodBounds,
  periodBuckets,
} from "@/lib/period";
import { orderTotals } from "@/lib/totals";
import { formatDate, formatDateTime, formatEuro, formatNumber } from "@/lib/utils";
import { createPayment, deletePayment } from "./actions";

const round = (n: number) => Math.round(n * 100) / 100;

export default async function EncaissementsPage({
  searchParams,
}: {
  searchParams: Promise<{
    range?: string;
    from?: string;
    to?: string;
    customer?: string;
    category?: string;
  }>;
}) {
  await requireUser();
  const {
    range: rangeParam,
    from: fromParam,
    to: toParam,
    customer: customerParam,
    category: categoryParam,
  } = await searchParams;

  const range = parsePeriod(rangeParam);
  const bounds = periodBounds(range, { from: fromParam, to: toParam });
  const periodLabel = describePeriod(range, bounds);
  const customerId = customerParam?.trim() || undefined;
  const categoryId = categoryParam?.trim() || undefined;

  const invoicedAtRange: { gte?: Date; lte?: Date } | undefined =
    bounds.start || bounds.end
      ? {
          ...(bounds.start ? { gte: bounds.start } : {}),
          ...(bounds.end ? { lte: bounds.end } : {}),
        }
      : undefined;
  const paidAtRange = invoicedAtRange;

  // Catégorie : on retient les commandes dont AU MOINS une ligne porte une
  // pièce de la catégorie (montants entiers, pas de prorata).
  const orderCategoryFilter = categoryId
    ? { lines: { some: { part: { categoryId } } } }
    : undefined;

  const [orders, payments, customers, categories, paymentMethods] =
    await Promise.all([
      prisma.salesOrder.findMany({
        where: {
          status: SalesOrderStatus.INVOICED,
          ...(invoicedAtRange ? { invoicedAt: invoicedAtRange } : {}),
          ...(customerId ? { customerId } : {}),
          ...(orderCategoryFilter ?? {}),
        },
        orderBy: [{ invoicedAt: "desc" }, { reference: "desc" }],
        include: {
          customer: { select: { id: true, name: true } },
          lines: { select: { quantity: true, unitPriceHt: true, vatRate: true } },
          payments: {
            orderBy: { paidAt: "desc" },
            include: { createdBy: { select: { name: true } } },
          },
        },
      }),
      // Paiements sur la période, pour KPI et courbe — filtrés client/catégorie
      // via la commande associée.
      prisma.payment.findMany({
        where: {
          ...(paidAtRange ? { paidAt: paidAtRange } : {}),
          salesOrder: {
            ...(customerId ? { customerId } : {}),
            ...(orderCategoryFilter ?? {}),
          },
        },
        orderBy: { paidAt: "asc" },
        select: { paidAt: true, amountHt: true, amountTtc: true },
      }),
      prisma.customer.findMany({
        orderBy: { name: "asc" },
        select: { id: true, name: true },
      }),
      prisma.category.findMany({
        orderBy: { name: "asc" },
        select: { id: true, name: true },
      }),
      prisma.paymentMethod.findMany({
        orderBy: { label: "asc" },
        select: { id: true, label: true },
      }),
    ]);

  // Agrégations par commande : total, encaissé, reste.
  const rows = orders.map((o) => {
    const totals = orderTotals(o.lines);
    const paidTtc = round(o.payments.reduce((s, p) => s + p.amountTtc, 0));
    const paidHt = round(o.payments.reduce((s, p) => s + p.amountHt, 0));
    const remainingTtc = round(totals.ttc - paidTtc);
    return { order: o, totals, paidTtc, paidHt, remainingTtc };
  });

  const kpis = {
    encaisseTtc: round(payments.reduce((s, p) => s + p.amountTtc, 0)),
    encaisseHt: round(payments.reduce((s, p) => s + p.amountHt, 0)),
    encoursTtc: round(rows.reduce((s, r) => s + Math.max(0, r.remainingTtc), 0)),
    openCount: rows.filter((r) => r.remainingTtc > 0.01).length,
  };

  // Buckets pour la courbe : on couvre la période active. À défaut de bornes,
  // on prend les 12 derniers mois jusqu'à aujourd'hui.
  const now = new Date();
  const chartStart =
    bounds.start ??
    (payments[0]?.paidAt
      ? new Date(payments[0].paidAt)
      : new Date(now.getFullYear(), now.getMonth() - 11, 1));
  const chartEnd = bounds.end ?? now;
  const buckets = periodBuckets(chartStart, chartEnd);
  const byBucket = new Map<string, { ttc: number; ht: number }>();
  for (const b of buckets) byBucket.set(b.key, { ttc: 0, ht: 0 });
  for (const p of payments) {
    const t = p.paidAt.getTime();
    const b = buckets.find(
      (x) => t >= x.start.getTime() && t <= x.end.getTime(),
    );
    if (!b) continue;
    const slot = byBucket.get(b.key)!;
    slot.ttc += p.amountTtc;
    slot.ht += p.amountHt;
  }
  const chartPoints: ChartPoint[] = buckets.map((b) => ({
    label: b.label,
    ttc: round(byBucket.get(b.key)?.ttc ?? 0),
    ht: round(byBucket.get(b.key)?.ht ?? 0),
  }));

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

  const todayIso = new Date().toISOString().slice(0, 10);
  const selectedCustomer = customerId
    ? customers.find((c) => c.id === customerId)
    : undefined;
  const selectedCategory = categoryId
    ? categories.find((c) => c.id === categoryId)
    : undefined;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Encaissements</h1>
          <p className="text-sm text-muted-foreground">
            {formatNumber(rows.length)} commande{rows.length > 1 ? "s" : ""}{" "}
            facturée{rows.length > 1 ? "s" : ""}
            {selectedCustomer ? ` · ${selectedCustomer.name}` : ""}
            {selectedCategory ? ` · ${selectedCategory.name}` : ""}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <CustomerFilter customers={customers} current={customerId ?? ""} />
          <CategoryFilter categories={categories} current={categoryId ?? ""} />
          <PeriodFilter
            current={range}
            basePath="/encaissements"
            preserve={{ customer: customerId, category: categoryId }}
          />
          <CustomRangeInput
            from={fromParam ?? ""}
            to={toParam ?? ""}
            active={range === "custom"}
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <DigitalReadout
          label="CA TTC encaissé"
          value={dualAmount(kpis.encaisseTtc, kpis.encaisseHt)}
          tone="success"
          icon={<Banknote className="h-3.5 w-3.5" />}
        />
        <DigitalReadout
          label="Encours restant TTC"
          value={formatEuro(kpis.encoursTtc)}
          tone={kpis.encoursTtc > 0 ? ("danger" as const) : ("info" as const)}
          icon={<BadgeEuro className="h-3.5 w-3.5" />}
        />
        <DigitalReadout
          label="Commandes en attente"
          value={formatNumber(kpis.openCount)}
          tone={kpis.openCount > 0 ? ("warning" as const) : ("default" as const)}
          icon={<AlertCircle className="h-3.5 w-3.5" />}
        />
        <DigitalReadout
          label="Période"
          value={<span className="text-2xl">{periodLabel}</span>}
          tone="info"
          icon={<Coins className="h-3.5 w-3.5" />}
        />
      </div>

      <div className="space-y-2">
        <h2 className="text-sm font-medium text-muted-foreground">
          Encaissements dans le temps ·{" "}
          <span className="text-foreground">{periodLabel}</span>
        </h2>
        <PaymentsChart points={chartPoints} />
      </div>

      <div className="space-y-2">
        <h2 className="text-sm font-medium text-muted-foreground">
          Commandes facturées
        </h2>
        {rows.length === 0 ? (
          <div className="rounded-lg border bg-card px-4 py-10 text-center text-sm text-muted-foreground">
            Aucune commande facturée sur ce périmètre.
          </div>
        ) : paymentMethods.length === 0 ? (
          <div className="rounded-lg border bg-card px-4 py-6 text-sm text-muted-foreground">
            Aucun mode de paiement n&apos;est configuré.{" "}
            <Link
              href="/admin/payment-methods"
              className="font-medium text-foreground underline"
            >
              Ajouter un mode
            </Link>{" "}
            pour activer la saisie d&apos;encaissements.
          </div>
        ) : (
          <div className="space-y-2">
            {rows.map(({ order, totals, paidTtc, paidHt, remainingTtc }) => {
              const fullyPaid = remainingTtc <= 0.01;
              return (
                <details
                  key={order.id}
                  className="rounded-lg border bg-card"
                  open={!fullyPaid && rows.length <= 3}
                >
                  <summary className="flex cursor-pointer flex-wrap items-center justify-between gap-3 px-4 py-3 hover:bg-accent/40">
                    <div className="flex min-w-0 flex-wrap items-center gap-3">
                      <span className="font-mono text-sm font-bold text-primary">
                        {order.reference}
                      </span>
                      <span className="text-sm">{order.customer.name}</span>
                      <span className="text-xs text-muted-foreground">
                        Facturée le {formatDate(order.invoicedAt)}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-sm tabular-nums">
                      <span className="text-muted-foreground">
                        Total {formatEuro(totals.ttc)}
                      </span>
                      <span className="text-muted-foreground">
                        · Encaissé {formatEuro(paidTtc)}
                      </span>
                      <Badge
                        className={
                          fullyPaid
                            ? "border-emerald-300 bg-emerald-100 text-emerald-800"
                            : "border-amber-300 bg-amber-100 text-amber-800"
                        }
                      >
                        {fullyPaid
                          ? "Soldée"
                          : `Reste ${formatEuro(remainingTtc)}`}
                      </Badge>
                    </div>
                  </summary>

                  <div className="space-y-3 border-t px-4 py-3">
                    {order.payments.length === 0 ? (
                      <p className="text-xs text-muted-foreground">
                        Aucun encaissement enregistré pour cette commande.
                      </p>
                    ) : (
                      <ul className="divide-y text-sm">
                        {order.payments.map((p) => (
                          <li
                            key={p.id}
                            className="flex flex-wrap items-center justify-between gap-2 py-2"
                          >
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-medium tabular-nums">
                                {formatEuro(p.amountTtc)}
                              </span>
                              <Badge className="border-slate-300 bg-slate-100 text-slate-700">
                                {p.method}
                              </Badge>
                              <span className="text-xs text-muted-foreground">
                                {formatDateTime(p.paidAt)}
                                {p.createdBy ? ` · ${p.createdBy.name}` : ""}
                                {p.notes ? ` · ${p.notes}` : ""}
                              </span>
                            </div>
                            <form action={deletePayment}>
                              <input type="hidden" name="id" value={p.id} />
                              <ConfirmSubmit
                                variant="ghost"
                                size="sm"
                                message={`Supprimer cet encaissement de ${formatEuro(p.amountTtc)} ?`}
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                                <span className="sr-only">Supprimer</span>
                              </ConfirmSubmit>
                            </form>
                          </li>
                        ))}
                      </ul>
                    )}

                    {!fullyPaid && (
                      <form
                        action={createPayment}
                        className="grid gap-2 rounded-md border bg-muted/40 p-3 sm:grid-cols-5"
                      >
                        <input
                          type="hidden"
                          name="salesOrderId"
                          value={order.id}
                        />
                        <div className="space-y-1">
                          <label className="text-xs text-muted-foreground">
                            Montant TTC
                          </label>
                          <Input
                            name="amountTtc"
                            type="number"
                            step="0.01"
                            min="0.01"
                            defaultValue={remainingTtc.toFixed(2)}
                            required
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs text-muted-foreground">
                            Mode
                          </label>
                          <Select name="method" required defaultValue="">
                            <option value="" disabled>
                              Sélectionner…
                            </option>
                            {paymentMethods.map((m) => (
                              <option key={m.id} value={m.label}>
                                {m.label}
                              </option>
                            ))}
                          </Select>
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs text-muted-foreground">
                            Date
                          </label>
                          <Input
                            name="paidAt"
                            type="date"
                            defaultValue={todayIso}
                          />
                        </div>
                        <div className="space-y-1 sm:col-span-1">
                          <label className="text-xs text-muted-foreground">
                            Notes
                          </label>
                          <Input
                            name="notes"
                            placeholder="Chèque n°…, etc."
                          />
                        </div>
                        <div className="flex items-end">
                          <Button type="submit" className="w-full">
                            Encaisser
                          </Button>
                        </div>
                      </form>
                    )}

                    <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                      <span>HT facturé {formatEuro(totals.ht)}</span>
                      <span>· HT encaissé {formatEuro(paidHt)}</span>
                      <Link
                        href={`/sales-orders/${order.id}`}
                        className="ml-auto underline hover:text-foreground"
                      >
                        Voir la commande →
                      </Link>
                    </div>
                  </div>
                </details>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
