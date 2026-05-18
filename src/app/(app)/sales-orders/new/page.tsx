import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/permissions";
import { Role } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { createSalesOrder } from "../actions";
import { CustomerPicker } from "./customer-picker";

export default async function NewSalesOrderPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  await requireRole([Role.ADMIN, Role.MANAGER]);
  const { error } = await searchParams;

  const customers = await prisma.customer.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true, accountNumber: true },
  });

  return (
    <div className="mx-auto max-w-xl space-y-4">
      <Link
        href="/sales-orders"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Retour aux commandes client
      </Link>
      <h1 className="text-2xl font-semibold">Nouvelle commande client</h1>

      {error && (
        <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}

      <form
        action={createSalesOrder}
        className="space-y-4 rounded-lg border bg-card p-4"
      >
        <CustomerPicker customers={customers} />
        <div className="space-y-1.5">
          <Label htmlFor="notes">Notes</Label>
          <Textarea
            id="notes"
            name="notes"
            placeholder="Conditions, contact…"
          />
        </div>
        <p className="text-xs text-muted-foreground">
          La commande est créée en brouillon. Vous ajouterez les lignes
          (pièces) à l&apos;étape suivante. Un nouveau client renseigné sera
          créé en même temps.
        </p>
        <div className="flex justify-end">
          <Button type="submit">Créer le brouillon</Button>
        </div>
      </form>
    </div>
  );
}
