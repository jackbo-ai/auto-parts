"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { cn } from "@/lib/utils";

export function CustomRangeInput({
  from,
  to,
  active,
}: {
  from: string;
  to: string;
  active: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();

  function apply(nextFrom: string, nextTo: string) {
    const next = new URLSearchParams(searchParams.toString());
    if (nextFrom || nextTo) {
      next.set("range", "custom");
      if (nextFrom) next.set("from", nextFrom);
      else next.delete("from");
      if (nextTo) next.set("to", nextTo);
      else next.delete("to");
    } else {
      // Les deux champs vides : on retombe sur la période par défaut.
      next.delete("range");
      next.delete("from");
      next.delete("to");
    }
    const qs = next.toString();
    startTransition(() => {
      router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    });
  }

  const inputClass = cn(
    "h-7 rounded border bg-background px-2 text-xs leading-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
    active ? "border-primary" : "border-input",
  );

  return (
    <div
      className="inline-flex items-center gap-1 rounded-md border bg-card p-1 text-xs shadow-sm"
      aria-label="Période personnalisée"
    >
      <span className="px-1 text-[10px] uppercase tracking-wider text-muted-foreground">
        Du
      </span>
      <input
        type="date"
        className={inputClass}
        defaultValue={from}
        disabled={pending}
        onChange={(e) => apply(e.target.value, to)}
        aria-label="Date de début"
      />
      <span className="px-1 text-[10px] uppercase tracking-wider text-muted-foreground">
        Au
      </span>
      <input
        type="date"
        className={inputClass}
        defaultValue={to}
        disabled={pending}
        onChange={(e) => apply(from, e.target.value)}
        aria-label="Date de fin"
      />
    </div>
  );
}
