"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";

export type PartOption = {
  id: string;
  reference: string;
  name: string;
  pmpAchat: number | null;
  vatRate: number;
};

export type BrandOption = { id: string; name: string };
export type CategoryOption = { id: string; name: string };

// Saisie d'une ligne d'achat à partir d'une référence libre. Si la référence
// correspond à une pièce existante, on pré-remplit PMP/TVA. Sinon, on déploie
// les champs nécessaires pour créer la pièce à la volée (le fournisseur est
// hérité de la commande côté serveur).
export function AddPurchaseLineForm({
  purchaseOrderId,
  parts,
  brands,
  categories,
  action,
}: {
  purchaseOrderId: string;
  parts: PartOption[];
  brands: BrandOption[];
  categories: CategoryOption[];
  action: (formData: FormData) => void;
}) {
  const [reference, setReference] = useState("");
  const ref = reference.trim();
  const existing = ref
    ? parts.find((p) => p.reference.toLowerCase() === ref.toLowerCase())
    : undefined;
  const isNew = ref.length > 0 && !existing;

  return (
    <form action={action} className="grid gap-2 sm:grid-cols-12 sm:items-end">
      <input type="hidden" name="purchaseOrderId" value={purchaseOrderId} />

      <div className="space-y-1.5 sm:col-span-5">
        <Label htmlFor="partReference">Référence</Label>
        <Input
          id="partReference"
          name="partReference"
          list="po-parts-refs"
          autoComplete="off"
          required
          placeholder="Référence pièce (TecDoc, OEM, fournisseur…)"
          value={reference}
          onChange={(e) => setReference(e.target.value)}
        />
        <datalist id="po-parts-refs">
          {parts.map((p) => (
            <option key={p.id} value={p.reference}>
              {p.name}
            </option>
          ))}
        </datalist>
        {existing && (
          <p className="text-xs text-emerald-700">
            Pièce existante : {existing.name}
          </p>
        )}
        {isNew && (
          <p className="text-xs text-amber-700">
            Nouvelle référence — la pièce sera créée à la volée.
          </p>
        )}
      </div>

      <div className="space-y-1.5 sm:col-span-2">
        <Label htmlFor="quantity">Qté</Label>
        <Input
          id="quantity"
          name="quantity"
          type="number"
          min="1"
          required
          defaultValue={1}
        />
      </div>

      <div className="space-y-1.5 sm:col-span-2">
        <Label htmlFor="unitPriceHt">PU achat HT</Label>
        <Input
          id="unitPriceHt"
          name="unitPriceHt"
          type="number"
          step="0.01"
          min="0"
          required
          key={existing?.id ?? "new"}
          defaultValue={existing?.pmpAchat ?? ""}
        />
      </div>

      <div className="space-y-1.5 sm:col-span-2">
        <Label htmlFor="vatRate">TVA %</Label>
        <Input
          id="vatRate"
          name="vatRate"
          type="number"
          step="0.1"
          min="0"
          max="100"
          key={`vat-${existing?.id ?? "new"}`}
          defaultValue={existing ? Math.round(existing.vatRate * 1000) / 10 : 20}
        />
      </div>

      <div className="sm:col-span-1">
        <Button type="submit" className="w-full">
          {isNew ? "+ Créer" : "+"}
        </Button>
      </div>

      {isNew && (
        <div className="sm:col-span-12 grid gap-2 rounded-md border border-amber-300 bg-amber-50 p-3 sm:grid-cols-3">
          <div className="space-y-1.5 sm:col-span-3">
            <Label htmlFor="partName">
              Désignation <span className="text-destructive">*</span>
            </Label>
            <Input
              id="partName"
              name="partName"
              required
              placeholder="Plaquettes avant — Renault Clio IV"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="brandId">
              Marque <span className="text-destructive">*</span>
            </Label>
            <Select id="brandId" name="brandId" required defaultValue="">
              <option value="" disabled>
                — Choisir —
              </option>
              {brands.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="categoryId">
              Catégorie <span className="text-destructive">*</span>
            </Label>
            <Select id="categoryId" name="categoryId" required defaultValue="">
              <option value="" disabled>
                — Choisir —
              </option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="reorderThreshold">Stock de sécurité</Label>
            <Input
              id="reorderThreshold"
              name="reorderThreshold"
              type="number"
              min="0"
              step="1"
              placeholder="0"
            />
          </div>
          <p className="text-xs text-amber-900 sm:col-span-3">
            Le fournisseur de la commande sera affecté par défaut à la pièce.
            Vous pourrez ajuster les autres champs (TVA, emplacement) depuis la
            fiche pièce ensuite.
          </p>
        </div>
      )}
    </form>
  );
}
