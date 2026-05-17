import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertTriangle, ArrowLeft, CheckCircle2 } from "lucide-react";
import { Role, SalesOrderStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/permissions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ConfirmSubmit } from "@/components/confirm-submit";
import { formatDate, formatEuro } from "@/lib/utils";
import { orderTotals } from "@/lib/totals";
import { SALES_STATUS_BADGE, SALES_STATUS_LABELS } from "@/lib/orders";
import { deleteCustomer, updateCustomer } from "../actions";

const round = (n: number) => Math.round(n * 100) / 100;

export default async function CustomerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireRole([Role.ADMIN]);
  const { id } = await params;

  const customer = await prisma.customer.findUnique({
    where: { id },
    include: {
      salesOrders: {
        orderBy: { orderDate: "desc" },
        include: {
          lines: true,
          payments: { select: { amountTtc: true } },
        },
      },
    },
  });
  if (!customer) notFound();

  // Encours TTC = somme (total TTC − encaissé TTC) sur les commandes facturées
  // non encore soldées. Le retraitement par client se fait uniquement ici, sans
  // bloquer la création de nouvelles commandes.
  const encoursTtc = round(
    customer.salesOrders
      .filter((o) => o.status === SalesOrderStatus.INVOICED)
      .reduce((sum, o) => {
        const total = orderTotals(o.lines).ttc;
        const paid = o.payments.reduce((s, p) => s + p.amountTtc, 0);
        return sum + Math.max(0, total - paid);
      }, 0),
  );
  const limit = customer.creditLimit ?? null;
  const limitUsage = limit && limit > 0 ? encoursTtc / limit : null;
  const overLimit = limit !== null && encoursTtc > limit + 0.01;

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <Link
        href="/admin/customers"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Retour aux clients
      </Link>
      <h1 className="text-2xl font-semibold">{customer.name}</h1>

      <section
        className={`rounded-lg border p-4 ${
          overLimit
            ? "border-rose-300 bg-rose-50"
            : limit !== null && limitUsage !== null && limitUsage >= 0.8
              ? "border-amber-300 bg-amber-50"
              : "border bg-card"
        }`}
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            {limit === null ? (
              <span className="text-sm text-muted-foreground">
                Aucune limite de crédit fixée
              </span>
            ) : overLimit ? (
              <span className="flex items-center gap-1.5 text-sm font-medium text-rose-800">
                <AlertTriangle className="h-4 w-4" />
                Limite de crédit dépassée
              </span>
            ) : (
              <span className="flex items-center gap-1.5 text-sm font-medium text-emerald-800">
                <CheckCircle2 className="h-4 w-4" />
                Limite de crédit respectée
              </span>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-3 text-sm tabular-nums">
            <span>
              <span className="text-muted-foreground">Encours TTC </span>
              <span className="font-semibold">{formatEuro(encoursTtc)}</span>
            </span>
            {limit !== null && (
              <span>
                <span className="text-muted-foreground">/ Limite </span>
                <span className="font-semibold">{formatEuro(limit)}</span>
              </span>
            )}
          </div>
        </div>
        {limit !== null && limit > 0 && (
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
            <div
              className={`h-full rounded-full ${
                overLimit
                  ? "bg-rose-500"
                  : limitUsage !== null && limitUsage >= 0.8
                    ? "bg-amber-500"
                    : "bg-emerald-500"
              }`}
              style={{
                width: `${Math.min(100, Math.round((limitUsage ?? 0) * 100))}%`,
              }}
            />
          </div>
        )}
      </section>

      <section className="space-y-3 rounded-lg border bg-card p-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Coordonnées
        </h2>
        <form action={updateCustomer} className="space-y-3">
          <input type="hidden" name="id" value={customer.id} />
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="name">Nom</Label>
              <Input id="name" name="name" defaultValue={customer.name} required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                name="email"
                type="email"
                defaultValue={customer.email ?? ""}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="phone">Téléphone</Label>
              <Input
                id="phone"
                name="phone"
                defaultValue={customer.phone ?? ""}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="address">Adresse</Label>
              <Input
                id="address"
                name="address"
                defaultValue={customer.address ?? ""}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="creditLimit">Limite de crédit TTC (€)</Label>
              <Input
                id="creditLimit"
                name="creditLimit"
                type="number"
                step="0.01"
                min="0"
                defaultValue={customer.creditLimit ?? ""}
                placeholder="Laisser vide pour aucune limite"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              name="notes"
              defaultValue={customer.notes ?? ""}
            />
          </div>
          <div className="flex items-center justify-between">
            <Button type="submit">Enregistrer</Button>
          </div>
        </form>
        <form action={deleteCustomer} className="border-t pt-3">
          <input type="hidden" name="id" value={customer.id} />
          <ConfirmSubmit
            variant="ghost"
            size="sm"
            message={`Supprimer le client "${customer.name}" ?`}
          >
            Supprimer le client
          </ConfirmSubmit>
        </form>
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-medium">
          Commandes ({customer.salesOrders.length})
        </h2>
        <div className="space-y-2">
          {customer.salesOrders.length === 0 && (
            <div className="rounded-lg border bg-card px-4 py-8 text-center text-sm text-muted-foreground">
              Aucune commande pour ce client.
            </div>
          )}
          {customer.salesOrders.map((o) => {
            const totals = orderTotals(o.lines);
            return (
              <Link
                key={o.id}
                href={`/sales-orders/${o.id}`}
                className="flex items-center justify-between gap-2 rounded-lg border bg-card p-3 hover:bg-accent/40"
              >
                <div className="min-w-0">
                  <div className="font-mono text-xs text-primary">
                    {o.reference}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {formatDate(o.orderDate)} · {o.lines.length} ligne
                    {o.lines.length > 1 ? "s" : ""}
                  </div>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <span className="tabular-nums">{formatEuro(totals.ttc)}</span>
                  <Badge className={SALES_STATUS_BADGE[o.status]}>
                    {SALES_STATUS_LABELS[o.status]}
                  </Badge>
                </div>
              </Link>
            );
          })}
        </div>
      </section>
    </div>
  );
}
