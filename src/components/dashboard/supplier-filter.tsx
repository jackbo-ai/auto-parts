"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { Select } from "@/components/ui/select";

type SupplierOption = { id: string; name: string };

export function SupplierFilter({
  suppliers,
  current,
}: {
  suppliers: SupplierOption[];
  current: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();

  function onChange(value: string) {
    const next = new URLSearchParams(searchParams.toString());
    if (value) next.set("supplier", value);
    else next.delete("supplier");
    const qs = next.toString();
    startTransition(() => {
      router.push(qs ? `/?${qs}` : "/", { scroll: false });
    });
  }

  return (
    <Select
      aria-label="Fournisseur"
      className="h-9 w-[200px] text-xs"
      value={current}
      disabled={pending}
      onChange={(e) => onChange(e.target.value)}
    >
      <option value="">Tous fournisseurs</option>
      {suppliers.map((s) => (
        <option key={s.id} value={s.id}>
          {s.name}
        </option>
      ))}
    </Select>
  );
}
