import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Role } from "@prisma/client";
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
        include: { lines: true },
      },
    },
  });
  if (!customer) notFound();

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
