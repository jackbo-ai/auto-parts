import Link from "next/link";
import {
  DEFAULT_PERIOD,
  PERIOD_LABELS,
  PRESET_RANGES,
  type PeriodRange,
} from "@/lib/period";
import { cn } from "@/lib/utils";

export function PeriodFilter({
  current,
  preserve,
  basePath = "/",
}: {
  current: PeriodRange;
  preserve?: Record<string, string | undefined>;
  basePath?: string;
}) {
  return (
    <div
      role="group"
      aria-label="Période"
      className="inline-flex items-center gap-1 rounded-md border bg-card p-1 shadow-sm"
    >
      {PRESET_RANGES.map((range) => {
        const active = range === current;
        const qs = new URLSearchParams();
        if (range !== DEFAULT_PERIOD) qs.set("range", range);
        for (const [k, v] of Object.entries(preserve ?? {})) {
          if (v) qs.set(k, v);
        }
        const href = qs.toString() ? `${basePath}?${qs.toString()}` : basePath;
        return (
          <Link
            key={range}
            href={href}
            scroll={false}
            aria-pressed={active}
            className={cn(
              "rounded px-3 py-1.5 text-xs font-medium transition-colors",
              active
                ? "bg-primary text-primary-foreground shadow"
                : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
            )}
          >
            {PERIOD_LABELS[range]}
          </Link>
        );
      })}
    </div>
  );
}
