import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireUser, canManageCatalog } from "@/lib/permissions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ConfirmSubmit } from "@/components/confirm-submit";
import { formatEuro, formatNumber } from "@/lib/utils";
import { deleteSupplier, updateSupplier } from "../actions";

export default async function SupplierDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const me = await requireUser();
  const { id } = await params;
  const canManage = canManageCatalog(me.role);

  const supplier = await prisma.supplier.findUnique({
    where: { id },
    include: {
      parts: {
        orderBy: { reference: "asc" },
        select: {
          id: true,
          reference: true,
          name: true,
          salePriceHt: true,
          stockQty: true,
        },
      },
    },
  });
  if (!supplier) notFound();

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <Link
        href="/suppliers"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Retour aux fournisseurs
      </Link>
      <h1 className="text-2xl font-semibold">{supplier.name}</h1>

      {canManage ? (
        <section className="space-y-3 rounded-lg border bg-card p-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Coordonnées
          </h2>
          <form action={updateSupplier} className="space-y-3">
            <input type="hidden" name="id" value={supplier.id} />
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="name">Nom</Label>
                <Input id="name" name="name" defaultValue={supplier.name} required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  defaultValue={supplier.email ?? ""}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="phone">Téléphone</Label>
                <Input
                  id="phone"
                  name="phone"
                  defaultValue={supplier.phone ?? ""}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="address">Adresse</Label>
                <Input
                  id="address"
                  name="address"
                  defaultValue={supplier.address ?? ""}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                name="notes"
                defaultValue={supplier.notes ?? ""}
              />
            </div>
            <div className="flex items-center justify-between">
              <Button type="submit">Enregistrer</Button>
            </div>
          </form>
          <form action={deleteSupplier} className="border-t pt-3">
            <input type="hidden" name="id" value={supplier.id} />
            <ConfirmSubmit
              variant="ghost"
              size="sm"
              message={`Supprimer le fournisseur "${supplier.name}" ? Les ${supplier.parts.length} pièce(s) liée(s) seront détachées (non supprimées).`}
            >
              Supprimer le fournisseur
            </ConfirmSubmit>
          </form>
        </section>
      ) : (
        <section className="space-y-1 rounded-lg border bg-card p-4 text-sm">
          {supplier.email && <div>Email : {supplier.email}</div>}
          {supplier.phone && <div>Téléphone : {supplier.phone}</div>}
          {supplier.address && <div>Adresse : {supplier.address}</div>}
          {supplier.notes && (
            <div className="whitespace-pre-wrap text-muted-foreground">
              {supplier.notes}
            </div>
          )}
        </section>
      )}

      <section className="space-y-2">
        <h2 className="text-sm font-medium">
          Pièces fournies ({supplier.parts.length})
        </h2>
        <div className="space-y-2">
          {supplier.parts.length === 0 && (
            <div className="rounded-lg border bg-card px-4 py-8 text-center text-sm text-muted-foreground">
              Aucune pièce rattachée à ce fournisseur.
            </div>
          )}
          {supplier.parts.map((p) => (
            <Link
              key={p.id}
              href={`/parts/${p.id}`}
              className="flex items-center justify-between gap-2 rounded-lg border bg-card p-3 hover:bg-accent/40"
            >
              <div className="min-w-0">
                <div className="font-mono text-xs text-primary">
                  {p.reference}
                </div>
                <div className="truncate text-sm">{p.name}</div>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <span className="tabular-nums">
                  {formatEuro(p.salePriceHt)}
                </span>
                <Badge className="border-border bg-muted text-muted-foreground">
                  {formatNumber(p.stockQty)} en stock
                </Badge>
              </div>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
