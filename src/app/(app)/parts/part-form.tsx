import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";

type Option = { id: string; name: string };

type PartValues = {
  id?: string;
  reference: string;
  name: string;
  description: string | null;
  brand: string | null;
  categoryId: string | null;
  supplierId: string | null;
  vatRate: number;
  reorderThreshold: number;
  location: string | null;
};

function Field({
  label,
  htmlFor,
  children,
  hint,
  className,
}: {
  label: string;
  htmlFor?: string;
  children: React.ReactNode;
  hint?: string;
  className?: string;
}) {
  return (
    <div className={`space-y-1.5 ${className ?? ""}`}>
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

// Shared by /parts/new and /parts/[id]/edit. `part` undefined → create mode.
export function PartForm({
  action,
  categories,
  suppliers,
  part,
}: {
  action: (formData: FormData) => void;
  categories: Option[];
  suppliers: Option[];
  part?: PartValues;
}) {
  const isEdit = !!part;

  return (
    <form action={action} className="space-y-6">
      {isEdit && <input type="hidden" name="id" value={part.id} />}

      <section className="space-y-4 rounded-lg border bg-card p-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Identification
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Référence TecDoc"
            htmlFor="reference"
            className="sm:col-span-2"
            hint="Identifiant pivot de la pièce."
          >
            <Input
              id="reference"
              name="reference"
              required
              defaultValue={part?.reference ?? ""}
              placeholder="0986494600"
            />
          </Field>
          <Field
            label="Désignation"
            htmlFor="name"
            className="sm:col-span-2"
          >
            <Input
              id="name"
              name="name"
              required
              defaultValue={part?.name ?? ""}
              placeholder="Jeu de plaquettes de frein avant"
            />
          </Field>
          <Field label="Marque" htmlFor="brand">
            <Input
              id="brand"
              name="brand"
              defaultValue={part?.brand ?? ""}
              placeholder="Bosch"
            />
          </Field>
          <Field label="Catégorie" htmlFor="categoryId">
            <Select
              id="categoryId"
              name="categoryId"
              defaultValue={part?.categoryId ?? ""}
            >
              <option value="">— Aucune —</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field
            label="Description"
            htmlFor="description"
            className="sm:col-span-2"
          >
            <Textarea
              id="description"
              name="description"
              defaultValue={part?.description ?? ""}
              placeholder="Notes techniques, contenu du kit…"
            />
          </Field>
        </div>
      </section>

      <section className="space-y-4 rounded-lg border bg-card p-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Fournisseur & TVA
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Fournisseur" htmlFor="supplierId">
            <Select
              id="supplierId"
              name="supplierId"
              defaultValue={part?.supplierId ?? ""}
            >
              <option value="">— Aucun —</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field
            label="TVA (%)"
            htmlFor="vatRate"
            hint="Le prix d'achat et le prix de vente ne se saisissent pas ici : ils se constituent via les commandes (PMP)."
          >
            <Input
              id="vatRate"
              name="vatRate"
              type="number"
              step="0.1"
              min="0"
              max="100"
              defaultValue={
                part ? Math.round(part.vatRate * 1000) / 10 : 20
              }
            />
          </Field>
        </div>
      </section>

      <section className="space-y-4 rounded-lg border bg-card p-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Stock
        </h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field
            label="Seuil de réapprovisionnement"
            htmlFor="reorderThreshold"
            hint="Une alerte apparaît quand le stock descend à ce niveau."
          >
            <Input
              id="reorderThreshold"
              name="reorderThreshold"
              type="number"
              min="0"
              defaultValue={part?.reorderThreshold ?? 0}
            />
          </Field>
          <Field label="Emplacement entrepôt" htmlFor="location">
            <Input
              id="location"
              name="location"
              defaultValue={part?.location ?? ""}
              placeholder="A1-03"
            />
          </Field>
          {!isEdit && (
            <Field
              label="Stock initial"
              htmlFor="initialStock"
              hint="Crée un mouvement d'entrée à la création."
            >
              <Input
                id="initialStock"
                name="initialStock"
                type="number"
                min="0"
                defaultValue={0}
              />
            </Field>
          )}
        </div>
        {isEdit && (
          <p className="text-xs text-muted-foreground">
            Le stock se modifie uniquement via les mouvements (onglet Stock ou
            fiche pièce).
          </p>
        )}
      </section>

      <div className="flex justify-end">
        <Button type="submit">
          {isEdit ? "Enregistrer les modifications" : "Créer la pièce"}
        </Button>
      </div>
    </form>
  );
}
