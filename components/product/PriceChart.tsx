"use client";

import { useMemo, useState } from "react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatBRL } from "@/lib/utils/money";
import { useTheme } from "@/components/theme/ThemeProvider";

// Paleta categórica validada (ordem fixa) — ver skill dataviz / references/palette.md.
const SERIES_COLORS_LIGHT = [
  "#2a78d6",
  "#eb6834",
  "#1baf7a",
  "#eda100",
  "#e87ba4",
  "#008300",
  "#4a3aa7",
  "#e34948",
];
const SERIES_COLORS_DARK = [
  "#3987e5",
  "#d95926",
  "#199e70",
  "#c98500",
  "#d55181",
  "#008300",
  "#9085e9",
  "#e66767",
];

const CHROME_LIGHT = {
  grid: "#e1e0d9",
  axis: "#c3c2b7",
  mutedText: "#898781",
  surface: "#fcfcfb",
  text: "#0b0b0b",
};
const CHROME_DARK = {
  grid: "#2c2c2a",
  axis: "#383835",
  mutedText: "#898781",
  surface: "#1a1a19",
  text: "#ffffff",
};

type RangeKey = "7d" | "30d" | "90d";

const RANGE_DAYS: Record<RangeKey, number> = { "7d": 7, "30d": 30, "90d": 90 };
const RANGE_LABELS: Record<RangeKey, string> = { "7d": "7 dias", "30d": "30 dias", "90d": "90 dias" };

export interface PriceChartOffer {
  id: string;
  storeName: string;
  history: { price: number; recordedAt: string }[];
}

function buildChartData(offers: PriceChartOffer[], cutoff: Date) {
  const dateKeys = new Set<string>();
  const points = offers.map((offer) => ({
    id: offer.id,
    history: offer.history
      .filter((h) => new Date(h.recordedAt) >= cutoff)
      .map((h) => ({ date: h.recordedAt.slice(0, 10), price: h.price })),
  }));

  points.forEach((p) => p.history.forEach((h) => dateKeys.add(h.date)));
  const dates = Array.from(dateKeys).sort();

  return dates.map((date) => {
    const row: Record<string, string | number | null> = { date };
    for (const p of points) {
      const atOrBefore = [...p.history].reverse().find((h) => h.date <= date);
      row[p.id] = atOrBefore ? atOrBefore.price : null;
    }
    return row;
  });
}

function formatDateLabel(value: string): string {
  const [, month, day] = value.split("-");
  return `${day}/${month}`;
}

interface TooltipPayloadItem {
  dataKey: string;
  value: number | null;
  color: string;
}

function ChartTooltip({
  active,
  payload,
  label,
  storeNameById,
  chrome,
}: {
  active?: boolean;
  payload?: TooltipPayloadItem[];
  label?: string;
  storeNameById: Map<string, string>;
  chrome: typeof CHROME_LIGHT;
}) {
  if (!active || !payload || payload.length === 0) return null;

  return (
    <div
      className="rounded-lg border border-border px-3 py-2 text-xs shadow-md"
      style={{ background: chrome.surface }}
    >
      <p className="mb-1 font-medium text-muted-foreground">{label ? formatDateLabel(label) : ""}</p>
      {payload
        .filter((item) => item.value !== null && item.value !== undefined)
        .map((item) => (
          <p key={item.dataKey} className="flex items-center gap-1.5" style={{ color: chrome.text }}>
            <span
              className="inline-block h-2 w-2 rounded-full"
              style={{ background: item.color }}
              aria-hidden
            />
            {storeNameById.get(item.dataKey) ?? item.dataKey}: {formatBRL(item.value as number)}
          </p>
        ))}
    </div>
  );
}

export function PriceChart({ offers }: { offers: PriceChartOffer[] }) {
  const [range, setRange] = useState<RangeKey>("30d");
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";
  const chrome = isDark ? CHROME_DARK : CHROME_LIGHT;
  const seriesColors = isDark ? SERIES_COLORS_DARK : SERIES_COLORS_LIGHT;

  const offersWithHistory = useMemo(() => offers.filter((o) => o.history.length > 0), [offers]);

  const cutoff = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - RANGE_DAYS[range]);
    return d;
  }, [range]);

  const data = useMemo(
    () => buildChartData(offersWithHistory, cutoff),
    [offersWithHistory, cutoff],
  );

  const storeNameById = useMemo(
    () => new Map(offersWithHistory.map((o) => [o.id, o.storeName])),
    [offersWithHistory],
  );

  if (offersWithHistory.length === 0 || data.length < 2) {
    return (
      <div className="flex h-48 items-center justify-center rounded-xl border border-border text-sm text-muted-foreground">
        Ainda não há histórico suficiente para exibir o gráfico. Volte em alguns dias.
      </div>
    );
  }

  return (
    <div>
      <div className="mb-3 flex items-center justify-end gap-1">
        {(Object.keys(RANGE_LABELS) as RangeKey[]).map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => setRange(key)}
            className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
              range === key
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-muted"
            }`}
          >
            {RANGE_LABELS[key]}
          </button>
        ))}
      </div>

      <ResponsiveContainer width="100%" height={280}>
        <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke={chrome.grid} strokeDasharray="0" />
          <XAxis
            dataKey="date"
            tickFormatter={formatDateLabel}
            tick={{ fill: chrome.mutedText, fontSize: 12 }}
            axisLine={{ stroke: chrome.axis }}
            tickLine={false}
          />
          <YAxis
            tickFormatter={(value: number) => formatBRL(value)}
            tick={{ fill: chrome.mutedText, fontSize: 12 }}
            axisLine={false}
            tickLine={false}
            width={80}
          />
          <Tooltip content={<ChartTooltip storeNameById={storeNameById} chrome={chrome} />} />
          {offersWithHistory.length > 1 && (
            <Legend
              formatter={(id: string) => (
                <span style={{ color: chrome.mutedText }}>{storeNameById.get(id) ?? id}</span>
              )}
            />
          )}
          {offersWithHistory.map((offer, index) => (
            <Line
              key={offer.id}
              dataKey={offer.id}
              name={offer.id}
              stroke={seriesColors[index % seriesColors.length]}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 5, stroke: chrome.surface, strokeWidth: 2 }}
              connectNulls
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
