"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import { Input } from "@/components/ui/input";

// Filtre libre sur la référence d'une pièce. Soumis à l'appui sur Entrée ou
// au blur. Datalist branchée sur les références existantes pour faciliter la
// saisie sans bloquer une recherche partielle.
export function PartRefFilter({
  refs,
  current,
}: {
  refs: { reference: string; name: string }[];
  current: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [value, setValue] = useState(current);
  const [pending, startTransition] = useTransition();

  function apply(next: string) {
    const trimmed = next.trim();
    if (trimmed === current) return;
    const params = new URLSearchParams(searchParams.toString());
    if (trimmed) params.set("part", trimmed);
    else params.delete("part");
    const qs = params.toString();
    startTransition(() => {
      router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    });
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        apply(value);
      }}
      className="flex items-center"
    >
      <Input
        aria-label="Code article"
        list="orders-part-refs"
        autoComplete="off"
        className="h-9 w-[180px] text-xs"
        placeholder="Code article"
        value={value}
        disabled={pending}
        onChange={(e) => setValue(e.target.value)}
        onBlur={() => apply(value)}
      />
      <datalist id="orders-part-refs">
        {refs.map((r) => (
          <option key={r.reference} value={r.reference}>
            {r.name}
          </option>
        ))}
      </datalist>
    </form>
  );
}
