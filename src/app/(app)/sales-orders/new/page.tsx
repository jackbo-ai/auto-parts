import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/permissions";
import { Role } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { createSalesOrder } from "../actions";

export default async function NewSalesOrderPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  await requireRole([Role.ADMIN, Role.MANAGER]);
  const { error } = await searchParams;

  const customers = await prisma.customer.findMany({
    orderBy: { name: "asc" },
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

      {customers.length === 0 ? (
        <div className="rounded-lg border bg-card px-4 py-8 text-center text-sm text-muted-foreground">
          Aucun client enregistré.{" "}
          <Link href="/customers" className="text-primary hover:underline">
            Ajoutez-en un d&apos;abord.
          </Link>
        </div>
      ) : (
        <form
          action={createSalesOrder}
          className="space-y-4 rounded-lg border bg-card p-4"
        >
          <div className="space-y-1.5">
            <Label htmlFor="customerId">Client</Label>
            <Select id="customerId" name="customerId" required>
              <option value="">— Choisir —</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="notes">Notes</Label>
            <Textarea id="notes" name="notes" placeholder="Conditions, contact…" />
          </div>
          <p className="text-xs text-muted-foreground">
            La commande est créée en brouillon. Vous ajouterez les lignes
            (pièces) à l&apos;étape suivante.
          </p>
          <div className="flex justify-end">
            <Button type="submit">Créer le brouillon</Button>
          </div>
        </form>
      )}
    </div>
  );
}
