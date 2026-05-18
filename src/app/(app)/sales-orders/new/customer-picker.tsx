"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export type CustomerOption = {
  id: string;
  name: string;
  accountNumber: string | null;
};

// Saisie d'un client par nom libre. Si le nom matche exactement un client
// existant, on n'envoie rien d'autre — le serveur résoudra par nom. Sinon, on
// déploie email/téléphone optionnels et le serveur créera le client à la volée.
export function CustomerPicker({ customers }: { customers: CustomerOption[] }) {
  const [name, setName] = useState("");
  const trimmed = name.trim();
  const existing = trimmed
    ? customers.find(
        (c) => c.name.toLowerCase() === trimmed.toLowerCase(),
      )
    : undefined;
  const isNew = trimmed.length > 0 && !existing;

  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <Label htmlFor="customerName">Client</Label>
        <Input
          id="customerName"
          name="customerName"
          required
          list="sales-customer-names"
          autoComplete="off"
          placeholder="Nom du client (existant ou nouveau)"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <datalist id="sales-customer-names">
          {customers.map((c) => (
            <option key={c.id} value={c.name}>
              {c.accountNumber ?? ""}
            </option>
          ))}
        </datalist>
        {existing && (
          <p className="text-xs text-emerald-700">
            Client existant
            {existing.accountNumber ? ` · ${existing.accountNumber}` : ""}
          </p>
        )}
        {isNew && (
          <p className="text-xs text-amber-700">
            Nouveau client — sera créé à la volée avec un numéro CLI-XXXX
            attribué automatiquement.
          </p>
        )}
      </div>

      {isNew && (
        <div className="grid gap-2 rounded-md border border-amber-300 bg-amber-50 p-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="customerEmail">Email (optionnel)</Label>
            <Input
              id="customerEmail"
              name="customerEmail"
              type="email"
              placeholder="contact@…"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="customerPhone">Téléphone (optionnel)</Label>
            <Input
              id="customerPhone"
              name="customerPhone"
              placeholder="01 23 45 67 89"
            />
          </div>
        </div>
      )}
    </div>
  );
}
