import { useMemo } from "react";
import {
  ResponsiveContainer, BarChart, Bar, LineChart, Line, ScatterChart, Scatter,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from "recharts";

// ─────────────────────────────────────────────────────────────────────────────
// Renders the chart specs the backend computes from the student's uploaded
// dataset / financial statements (see api-server lib/datasetAnalysis.ts).
// The numbers are computed server-side from the REAL data — this component
// only draws them, so figures and paper text can never disagree.
//
// Colors come from the app's --chart-N tokens (light & dark tuned), resolved
// at runtime so theme switches keep charts on-brand. Hues are assigned in
// fixed order per series index — never cycled or re-assigned.
// ─────────────────────────────────────────────────────────────────────────────

export interface ChartSpecUI {
  id: string;
  type: "bar" | "line" | "scatter" | "histogram";
  title: string;
  xLabel: string;
  yLabel: string;
  xKey: string;
  series: Array<{ key: string; label: string }>;
  data: Array<Record<string, string | number>>;
}

const FALLBACK = ["#1d6ff4", "#1a82b3", "#7c5cd6", "#2f9e6e", "#c2703d"];

function useChartPalette(): string[] {
  return useMemo(() => {
    if (typeof window === "undefined") return FALLBACK;
    const style = getComputedStyle(document.documentElement);
    return [1, 2, 3, 4, 5].map((i, idx) => {
      const raw = style.getPropertyValue(`--chart-${i}`).trim();
      return raw ? `hsl(${raw})` : FALLBACK[idx];
    });
  }, []);
}

const AXIS_TICK = { fontSize: 11, fill: "currentColor", opacity: 0.55 } as const;
const GRID_PROPS = { strokeOpacity: 0.15, vertical: false } as const;

function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ name?: string; value?: number | string; color?: string }>; label?: string | number }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-md border border-border bg-popover px-2.5 py-1.5 text-xs shadow-md">
      {label !== undefined && <div className="font-medium text-foreground mb-0.5">{label}</div>}
      {payload.map((p, i) => (
        <div key={i} className="flex items-center gap-1.5 text-muted-foreground">
          <span className="inline-block w-2 h-2 rounded-full" style={{ background: p.color }} />
          {p.name}: <span className="text-foreground font-medium">{typeof p.value === "number" ? p.value.toLocaleString() : p.value}</span>
        </div>
      ))}
    </div>
  );
}

function SingleChart({ spec, palette }: { spec: ChartSpecUI; palette: string[] }) {
  const multiSeries = spec.series.length > 1;
  const common = (
    <>
      <CartesianGrid {...GRID_PROPS} />
      <Tooltip content={<ChartTooltip />} cursor={{ fillOpacity: 0.06, strokeOpacity: 0.25 }} />
      {multiSeries && <Legend wrapperStyle={{ fontSize: 11 }} />}
    </>
  );

  if (spec.type === "line") {
    return (
      <LineChart data={spec.data} margin={{ top: 8, right: 12, left: 0, bottom: 4 }}>
        {common}
        <XAxis dataKey={spec.xKey} tick={AXIS_TICK} tickLine={false} axisLine={{ strokeOpacity: 0.25 }} label={{ value: spec.xLabel, position: "insideBottom", offset: -2, fontSize: 10, opacity: 0.5 }} />
        <YAxis tick={AXIS_TICK} tickLine={false} axisLine={false} width={52} />
        {spec.series.map((s, i) => (
          <Line key={s.key} dataKey={s.key} name={s.label} type="monotone" stroke={palette[i % palette.length]} strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
        ))}
      </LineChart>
    );
  }

  if (spec.type === "scatter") {
    return (
      <ScatterChart margin={{ top: 8, right: 12, left: 0, bottom: 4 }}>
        {common}
        <XAxis dataKey={spec.xKey} type="number" name={spec.xLabel} tick={AXIS_TICK} tickLine={false} axisLine={{ strokeOpacity: 0.25 }} label={{ value: spec.xLabel, position: "insideBottom", offset: -2, fontSize: 10, opacity: 0.5 }} />
        <YAxis dataKey={spec.series[0]?.key ?? "y"} type="number" name={spec.yLabel} tick={AXIS_TICK} tickLine={false} axisLine={false} width={52} />
        <Scatter data={spec.data} name={spec.yLabel} fill={palette[0]} fillOpacity={0.75} />
      </ScatterChart>
    );
  }

  // bar & histogram
  return (
    <BarChart data={spec.data} margin={{ top: 8, right: 12, left: 0, bottom: 4 }} barCategoryGap="22%">
      {common}
      <XAxis dataKey={spec.xKey} tick={AXIS_TICK} tickLine={false} axisLine={{ strokeOpacity: 0.25 }} interval="preserveStartEnd" />
      <YAxis tick={AXIS_TICK} tickLine={false} axisLine={false} width={52} />
      {spec.series.map((s, i) => (
        <Bar key={s.key} dataKey={s.key} name={s.label} fill={palette[i % palette.length]} radius={[4, 4, 0, 0]} maxBarSize={44} />
      ))}
    </BarChart>
  );
}

export default function PaperCharts({ charts }: { charts: ChartSpecUI[] }) {
  const palette = useChartPalette();
  if (!charts || charts.length === 0) return null;

  return (
    <div className="space-y-5">
      <p className="text-xs text-muted-foreground">
        Figures generated from your uploaded data — the same computed values the paper's analysis cites.
      </p>
      {charts.map((spec, idx) => (
        <figure key={spec.id} className="rounded-lg border border-border bg-card p-4">
          <figcaption className="text-sm font-semibold text-foreground mb-1">
            Figure {idx + 1}. {spec.title}
          </figcaption>
          <div className="text-[11px] text-muted-foreground mb-2">{spec.yLabel} by {spec.xLabel}</div>
          <div className="h-64 text-foreground">
            <ResponsiveContainer width="100%" height="100%">
              {SingleChart({ spec, palette })}
            </ResponsiveContainer>
          </div>
        </figure>
      ))}
    </div>
  );
}
