import Link from "next/link";
import { Mail, Phone } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireUser, canManageCatalog } from "@/lib/permissions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { createSupplier } from "./actions";

export default async function SuppliersPage() {
  const me = await requireUser();
  const canManage = canManageCatalog(me.role);

  const suppliers = await prisma.supplier.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { parts: true } } },
  });

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-semibold">Fournisseurs</h1>

      {canManage && (
        <section className="space-y-2 rounded-lg border bg-card p-4">
          <h2 className="text-sm font-medium">Ajouter un fournisseur</h2>
          <form action={createSupplier} className="grid gap-2 sm:grid-cols-2">
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
      )}

      <section className="space-y-2">
        <h2 className="text-sm font-medium">
          Fournisseurs référencés ({suppliers.length})
        </h2>
        {suppliers.length === 0 && (
          <div className="rounded-lg border bg-card px-4 py-10 text-center text-sm text-muted-foreground">
            Aucun fournisseur.
          </div>
        )}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {suppliers.map((s) => (
            <Link
              key={s.id}
              href={`/suppliers/${s.id}`}
              className="rounded-lg border bg-card p-4 hover:bg-accent/40"
            >
              <div className="font-medium">{s.name}</div>
              <div className="mt-1 space-y-0.5 text-sm text-muted-foreground">
                {s.email && (
                  <div className="flex items-center gap-1.5">
                    <Mail className="h-3.5 w-3.5" />
                    {s.email}
                  </div>
                )}
                {s.phone && (
                  <div className="flex items-center gap-1.5">
                    <Phone className="h-3.5 w-3.5" />
                    {s.phone}
                  </div>
                )}
              </div>
              <div className="mt-2 text-xs text-muted-foreground">
                {s._count.parts} pièce{s._count.parts > 1 ? "s" : ""} au
                catalogue
              </div>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
