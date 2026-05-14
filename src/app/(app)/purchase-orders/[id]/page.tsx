import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Trash2 } from "lucide-react";
import { PurchaseOrderStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireUser, canManageOrders } from "@/lib/permissions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ConfirmSubmit } from "@/components/confirm-submit";
import { formatDate, formatEuro } from "@/lib/utils";
import { lineTotals, orderTotals } from "@/lib/totals";
import { PURCHASE_STATUS_BADGE, PURCHASE_STATUS_LABELS } from "@/lib/orders";
import { AddPurchaseLineForm } from "../add-line-form";
import {
  addPurchaseLine,
  cancelPurchaseOrder,
  deletePurchaseOrder,
  markPurchaseOrdered,
  receivePurchaseOrder,
  removePurchaseLine,
} from "../actions";

export default async function PurchaseOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const me = await requireUser();
  const { id } = await params;
  const canManage = canManageOrders(me.role);

  const order = await prisma.purchaseOrder.findUnique({
    where: { id },
    include: {
      supplier: true,
      createdBy: { select: { name: true } },
      lines: {
        include: { part: { select: { id: true, reference: true, name: true } } },
      },
    },
  });
  if (!order) notFound();

  const totals = orderTotals(order.lines);
  const isDraft = order.status === PurchaseOrderStatus.DRAFT;
  const isOrdered = order.status === PurchaseOrderStatus.ORDERED;

  const parts =
    canManage && isDraft
      ? await prisma.part.findMany({
          where: { active: true },
          orderBy: { reference: "asc" },
          select: {
            id: true,
            reference: true,
            name: true,
            purchasePriceHt: true,
            vatRate: true,
          },
        })
      : [];

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <Link
        href="/purchase-orders"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Retour aux commandes d&apos;achat
      </Link>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-mono text-2xl font-semibold">{order.reference}</h1>
          <p className="text-sm text-muted-foreground">
            <Link
              href={`/suppliers/${order.supplier.id}`}
              className="hover:underline"
            >
              {order.supplier.name}
            </Link>
          </p>
        </div>
        <Badge className={`${PURCHASE_STATUS_BADGE[order.status]} text-sm`}>
          {PURCHASE_STATUS_LABELS[order.status]}
        </Badge>
      </div>

      <section className="grid gap-3 rounded-lg border bg-card p-4 text-sm sm:grid-cols-3">
        <div>
          <div className="text-xs uppercase text-muted-foreground">
            Date de commande
          </div>
          <div>{formatDate(order.orderDate)}</div>
        </div>
        <div>
          <div className="text-xs uppercase text-muted-foreground">
            Livraison attendue
          </div>
          <div>{formatDate(order.expectedAt)}</div>
        </div>
        <div>
          <div className="text-xs uppercase text-muted-foreground">
            Réceptionnée le
          </div>
          <div>{formatDate(order.receivedAt)}</div>
        </div>
        {order.notes && (
          <div className="sm:col-span-3">
            <div className="text-xs uppercase text-muted-foreground">Notes</div>
            <div className="whitespace-pre-wrap">{order.notes}</div>
          </div>
        )}
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-medium">Lignes ({order.lines.length})</h2>
        <div className="overflow-hidden rounded-lg border bg-card">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/60 text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-2">Pièce</th>
                <th className="px-4 py-2 text-right">Qté</th>
                <th className="px-4 py-2 text-right">PU HT</th>
                <th className="px-4 py-2 text-right">TVA</th>
                <th className="px-4 py-2 text-right">Total TTC</th>
                {canManage && isDraft && <th className="px-4 py-2" />}
              </tr>
            </thead>
            <tbody>
              {order.lines.length === 0 && (
                <tr>
                  <td
                    colSpan={canManage && isDraft ? 6 : 5}
                    className="px-4 py-8 text-center text-muted-foreground"
                  >
                    Aucune ligne. Ajoutez des pièces ci-dessous.
                  </td>
                </tr>
              )}
              {order.lines.map((line) => {
                const t = lineTotals(line);
                return (
                  <tr key={line.id} className="border-b last:border-0">
                    <td className="px-4 py-2">
                      <Link
                        href={`/parts/${line.part.id}`}
                        className="hover:underline"
                      >
                        <span className="font-mono text-xs text-primary">
                          {line.part.reference}
                        </span>
                        <div className="text-xs text-muted-foreground">
                          {line.part.name}
                        </div>
                      </Link>
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums">
                      {line.quantity}
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums">
                      {formatEuro(line.unitPriceHt)}
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums text-muted-foreground">
                      {Math.round(line.vatRate * 1000) / 10}%
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums">
                      {formatEuro(t.ttc)}
                    </td>
                    {canManage && isDraft && (
                      <td className="px-4 py-2 text-right">
                        <form action={removePurchaseLine}>
                          <input type="hidden" name="id" value={line.id} />
                          <input
                            type="hidden"
                            name="purchaseOrderId"
                            value={order.id}
                          />
                          <Button
                            type="submit"
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-muted-foreground hover:text-destructive"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </form>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
            <tfoot className="border-t bg-muted/30">
              <tr>
                <td
                  className="px-4 py-2 text-right text-xs uppercase text-muted-foreground"
                  colSpan={canManage && isDraft ? 4 : 3}
                >
                  Total HT
                </td>
                <td className="px-4 py-2 text-right tabular-nums">
                  {formatEuro(totals.ht)}
                </td>
                {canManage && isDraft && <td />}
              </tr>
              <tr>
                <td
                  className="px-4 py-2 text-right text-xs uppercase text-muted-foreground"
                  colSpan={canManage && isDraft ? 4 : 3}
                >
                  TVA
                </td>
                <td className="px-4 py-2 text-right tabular-nums text-muted-foreground">
                  {formatEuro(totals.vat)}
                </td>
                {canManage && isDraft && <td />}
              </tr>
              <tr>
                <td
                  className="px-4 py-2 text-right text-xs font-semibold uppercase"
                  colSpan={canManage && isDraft ? 4 : 3}
                >
                  Total TTC
                </td>
                <td className="px-4 py-2 text-right font-semibold tabular-nums">
                  {formatEuro(totals.ttc)}
                </td>
                {canManage && isDraft && <td />}
              </tr>
            </tfoot>
          </table>
        </div>
      </section>

      {canManage && isDraft && (
        <section className="space-y-2 rounded-lg border bg-card p-4">
          <h2 className="text-sm font-medium">Ajouter une ligne</h2>
          {parts.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Aucune pièce active au catalogue.
            </p>
          ) : (
            <AddPurchaseLineForm
              purchaseOrderId={order.id}
              parts={parts}
              action={addPurchaseLine}
            />
          )}
        </section>
      )}

      {canManage && (
        <section className="flex flex-wrap items-center gap-2 rounded-lg border bg-card p-4">
          {isDraft && (
            <form action={markPurchaseOrdered}>
              <input type="hidden" name="id" value={order.id} />
              <Button type="submit" disabled={order.lines.length === 0}>
                Valider la commande
              </Button>
            </form>
          )}
          {isOrdered && (
            <form action={receivePurchaseOrder}>
              <input type="hidden" name="id" value={order.id} />
              <Button type="submit">Réceptionner (entrée en stock)</Button>
            </form>
          )}
          {(isDraft || isOrdered) && (
            <form action={cancelPurchaseOrder}>
              <input type="hidden" name="id" value={order.id} />
              <ConfirmSubmit
                variant="outline"
                message="Annuler cette commande d'achat ?"
              >
                Annuler
              </ConfirmSubmit>
            </form>
          )}
          {order.status !== PurchaseOrderStatus.RECEIVED && (
            <form action={deletePurchaseOrder} className="ml-auto">
              <input type="hidden" name="id" value={order.id} />
              <ConfirmSubmit
                variant="ghost"
                size="sm"
                message={`Supprimer définitivement la commande ${order.reference} ?`}
              >
                Supprimer
              </ConfirmSubmit>
            </form>
          )}
        </section>
      )}

      {order.status === PurchaseOrderStatus.RECEIVED && (
        <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          Commande réceptionnée — les pièces ont été ajoutées au stock. Voir les
          mouvements sur la page{" "}
          <Link href="/stock" className="font-medium hover:underline">
            Stock
          </Link>
          .
        </p>
      )}
    </div>
  );
}
