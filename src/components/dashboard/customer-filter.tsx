"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { Select } from "@/components/ui/select";

type CustomerOption = { id: string; name: string };

export function CustomerFilter({
  customers,
  current,
}: {
  customers: CustomerOption[];
  current: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();

  function onChange(value: string) {
    const next = new URLSearchParams(searchParams.toString());
    if (value) next.set("customer", value);
    else next.delete("customer");
    const qs = next.toString();
    startTransition(() => {
      router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    });
  }

  return (
    <Select
      aria-label="Client"
      className="h-9 w-[200px] text-xs"
      value={current}
      disabled={pending}
      onChange={(e) => onChange(e.target.value)}
    >
      <option value="">Tous clients</option>
      {customers.map((c) => (
        <option key={c.id} value={c.id}>
          {c.name}
        </option>
      ))}
    </Select>
  );
}
