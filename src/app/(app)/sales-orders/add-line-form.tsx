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
  pmpVente: number | null;
  vatRate: number;
  stockQty: number;
};

// Sélectionne une pièce et pré-remplit le prix de vente (PMP vente en cours) /
// la TVA. Le stock disponible est rappelé à titre indicatif.
export function AddSalesLineForm({
  salesOrderId,
  parts,
  action,
}: {
  salesOrderId: string;
  parts: PartOption[];
  action: (formData: FormData) => void;
}) {
  const [partId, setPartId] = useState("");
  const selected = parts.find((p) => p.id === partId);

  return (
    <div className="space-y-1.5">
      <form action={action} className="grid gap-2 sm:grid-cols-12 sm:items-end">
        <input type="hidden" name="salesOrderId" value={salesOrderId} />

        <div className="space-y-1.5 sm:col-span-5">
          <Label htmlFor="partId">Pièce</Label>
          <Select
            id="partId"
            name="partId"
            required
            value={partId}
            onChange={(e) => setPartId(e.target.value)}
          >
            <option value="">— Choisir —</option>
            {parts.map((p) => (
              <option key={p.id} value={p.id}>
                {p.reference} — {p.name}
              </option>
            ))}
          </Select>
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
          <Label htmlFor="unitPriceHt">PU vente HT</Label>
          <Input
            id="unitPriceHt"
            name="unitPriceHt"
            type="number"
            step="0.01"
            min="0"
            required
            key={partId}
            defaultValue={selected?.pmpVente ?? ""}
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
            key={`vat-${partId}`}
            defaultValue={
              selected ? Math.round(selected.vatRate * 1000) / 10 : 20
            }
          />
        </div>

        <div className="sm:col-span-1">
          <Button type="submit" className="w-full">
            +
          </Button>
        </div>
      </form>
      {selected && (
        <p className="text-xs text-muted-foreground">
          Stock disponible pour {selected.reference} : {selected.stockQty}
        </p>
      )}
    </div>
  );
}
