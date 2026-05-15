import Link from "next/link";
import { Mail, Phone } from "lucide-react";
import { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/permissions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { createCustomer } from "./actions";

export default async function CustomersPage() {
  await requireRole([Role.ADMIN]);

  const customers = await prisma.customer.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { salesOrders: true } } },
  });

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-semibold">Clients</h1>

      <section className="space-y-2 rounded-lg border bg-card p-4">
        <h2 className="text-sm font-medium">Ajouter un client</h2>
        <form action={createCustomer} className="grid gap-2 sm:grid-cols-2">
          <Input name="name" required placeholder="Nom *" />
          <Input name="email" type="email" placeholder="Email" />
          <Input name="phone" placeholder="Téléphone" />
          <Input name="address" placeholder="Adresse" />
          <Textarea
            name="notes"
            placeholder="Notes (conditions, contact…)"
            className="sm:col-span-2"
          />
          <div className="sm:col-span-2">
            <Button type="submit">Ajouter</Button>
          </div>
        </form>
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-medium">
          Clients référencés ({customers.length})
        </h2>
        {customers.length === 0 && (
          <div className="rounded-lg border bg-card px-4 py-10 text-center text-sm text-muted-foreground">
            Aucun client.
          </div>
        )}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {customers.map((c) => (
            <Link
              key={c.id}
              href={`/admin/customers/${c.id}`}
              className="rounded-lg border bg-card p-4 hover:bg-accent/40"
            >
              <div className="font-medium">{c.name}</div>
              <div className="mt-1 space-y-0.5 text-sm text-muted-foreground">
                {c.email && (
                  <div className="flex items-center gap-1.5">
                    <Mail className="h-3.5 w-3.5" />
                    {c.email}
                  </div>
                )}
                {c.phone && (
                  <div className="flex items-center gap-1.5">
                    <Phone className="h-3.5 w-3.5" />
                    {c.phone}
                  </div>
                )}
              </div>
              <div className="mt-2 text-xs text-muted-foreground">
                {c._count.salesOrders} commande
                {c._count.salesOrders > 1 ? "s" : ""}
              </div>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
