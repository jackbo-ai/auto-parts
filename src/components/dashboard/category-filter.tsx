"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { Select } from "@/components/ui/select";

type CategoryOption = { id: string; name: string };

export function CategoryFilter({
  categories,
  current,
}: {
  categories: CategoryOption[];
  current: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();

  function onChange(value: string) {
    const next = new URLSearchParams(searchParams.toString());
    if (value) next.set("category", value);
    else next.delete("category");
    const qs = next.toString();
    startTransition(() => {
      router.push(qs ? `/?${qs}` : "/", { scroll: false });
    });
  }

  return (
    <Select
      aria-label="Catégorie"
      className="h-9 w-[200px] text-xs"
      value={current}
      disabled={pending}
      onChange={(e) => onChange(e.target.value)}
    >
      <option value="">Toutes catégories</option>
      {categories.map((c) => (
        <option key={c.id} value={c.id}>
          {c.name}
        </option>
      ))}
    </Select>
  );
}
