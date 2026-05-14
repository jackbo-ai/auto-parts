import Link from "next/link";
import { Plus } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireUser, canManageOrders } from "@/lib/permissions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatDate, formatEuro } from "@/lib/utils";
import { orderTotals } from "@/lib/totals";
import { SALES_STATUS_BADGE, SALES_STATUS_LABELS } from "@/lib/orders";

export default async function SalesOrdersPage() {
  const me = await requireUser();
  const canManage = canManageOrders(me.role);

  const orders = await prisma.salesOrder.findMany({
    orderBy: { orderDate: "desc" },
    include: {
      customer: { select: { name: true } },
      lines: true,
    },
  });

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Commandes client</h1>
        {canManage && (
          <Button asChild>
            <Link href="/sales-orders/new">
              <Plus className="h-4 w-4" />
              Nouvelle commande
            </Link>
          </Button>
        )}
      </div>

      {orders.length === 0 && (
        <div className="rounded-lg border bg-card px-4 py-10 text-center text-sm text-muted-foreground">
          Aucune commande client.
        </div>
      )}

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
    </div>
  );
}
