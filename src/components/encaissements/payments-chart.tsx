import { formatEuro } from "@/lib/utils";

export type ChartPoint = { label: string; ttc: number; ht: number };

// Courbe TTC + HT encaissés. Rendu SVG inline, sans dépendance.
export function PaymentsChart({ points }: { points: ChartPoint[] }) {
  if (points.length === 0) {
    return (
      <div className="rounded-lg border bg-card p-8 text-center text-sm text-muted-foreground">
        Aucun encaissement sur la période.
      </div>
    );
  }

  const width = 1000;
  const height = 240;
  const padding = { top: 16, right: 16, bottom: 28, left: 56 };
  const innerW = width - padding.left - padding.right;
  const innerH = height - padding.top - padding.bottom;

  const max = Math.max(1, ...points.map((p) => p.ttc));
  // Échelle : arrondi sup au pas naturel (1, 2, 5 × 10^n).
  const niceMax = niceCeil(max);
  const yScale = (v: number) => padding.top + innerH * (1 - v / niceMax);
  const xScale =
    points.length === 1
      ? () => padding.left + innerW / 2
      : (i: number) => padding.left + (innerW * i) / (points.length - 1);

  const ttcPath = points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${xScale(i)} ${yScale(p.ttc)}`)
    .join(" ");
  const htPath = points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${xScale(i)} ${yScale(p.ht)}`)
    .join(" ");
  // Aire sous la courbe TTC pour l'effet « rempli ».
  const ttcArea =
    `M ${xScale(0)} ${yScale(0)} ` +
    points.map((p, i) => `L ${xScale(i)} ${yScale(p.ttc)}`).join(" ") +
    ` L ${xScale(points.length - 1)} ${yScale(0)} Z`;

  // 4 graduations horizontales.
  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((f) => f * niceMax);
  // Étiquettes x : ~6 max.
  const xStep = Math.max(1, Math.ceil(points.length / 6));

  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="mb-2 flex items-center gap-4 text-xs">
        <span className="flex items-center gap-1">
          <span className="inline-block h-2 w-3 rounded bg-emerald-500" />
          CA TTC encaissé
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-2 w-3 rounded bg-sky-500" />
          CA HT encaissé
        </span>
      </div>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
        className="h-56 w-full"
        role="img"
        aria-label="Courbe d'encaissement sur la période"
      >
        {yTicks.map((v) => (
          <g key={v}>
            <line
              x1={padding.left}
              x2={width - padding.right}
              y1={yScale(v)}
              y2={yScale(v)}
              stroke="currentColor"
              className="text-border"
              strokeWidth={1}
            />
            <text
              x={padding.left - 6}
              y={yScale(v) + 3}
              textAnchor="end"
              className="fill-muted-foreground text-[10px]"
            >
              {formatEuro(v)}
            </text>
          </g>
        ))}

        <path d={ttcArea} className="fill-emerald-500/15" />
        <path
          d={ttcPath}
          fill="none"
          stroke="rgb(16 185 129)"
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        <path
          d={htPath}
          fill="none"
          stroke="rgb(14 165 233)"
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
          strokeDasharray="4 3"
        />

        {points.map((p, i) =>
          i % xStep === 0 || i === points.length - 1 ? (
            <text
              key={p.label + i}
              x={xScale(i)}
              y={height - 8}
              textAnchor="middle"
              className="fill-muted-foreground text-[10px]"
            >
              {p.label}
            </text>
          ) : null,
        )}
      </svg>
    </div>
  );
}

function niceCeil(n: number): number {
  if (n <= 0) return 1;
  const pow = Math.pow(10, Math.floor(Math.log10(n)));
  const f = n / pow;
  let step: number;
  if (f <= 1) step = 1;
  else if (f <= 2) step = 2;
  else if (f <= 5) step = 5;
  else step = 10;
  return step * pow;
}
