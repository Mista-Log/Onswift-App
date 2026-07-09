import { useState } from "react";
import { Bar, BarChart, CartesianGrid, LabelList, XAxis, YAxis } from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { TalentRow } from "@/hooks/useCreatorAnalytics";

type Metric = "approved" | "approval_rate" | "tasks_completed" | "pending";

const METRICS: { key: Metric; label: string }[] = [
  { key: "approved", label: "Approved" },
  { key: "approval_rate", label: "Approval rate" },
  { key: "tasks_completed", label: "Tasks done" },
  { key: "pending", label: "Pending" },
];

// One purple hue (single series); validated light + dark.
const baseColor = { theme: { light: "#6B5CE7", dark: "#8B7FF0" } };

export function TalentPerformanceChart({ data }: { data: TalentRow[] }) {
  const [metric, setMetric] = useState<Metric>("approved");
  const active = METRICS.find((m) => m.key === metric)!;
  const isPct = metric === "approval_rate";

  const rows = data.map((t) => ({ name: t.name, value: t[metric] }));
  const config = { value: { label: active.label, ...baseColor } } satisfies ChartConfig;

  return (
    <div className="space-y-3">
      <Tabs value={metric} onValueChange={(v) => setMetric(v as Metric)}>
        <TabsList className="flex-wrap h-auto">
          {METRICS.map((m) => (
            <TabsTrigger key={m.key} value={m.key} className="text-xs">
              {m.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <ChartContainer config={config} className="h-[260px] w-full">
        <BarChart data={rows} layout="vertical" margin={{ left: 8, right: 28, top: 4, bottom: 4 }}>
          <CartesianGrid horizontal={false} strokeDasharray="3 3" className="stroke-border/40" />
          <XAxis
            type="number"
            domain={isPct ? [0, 100] : undefined}
            allowDecimals={false}
            tickLine={false}
            axisLine={false}
            className="text-xs"
          />
          <YAxis
            type="category"
            dataKey="name"
            width={100}
            tickLine={false}
            axisLine={false}
            className="text-xs"
          />
          <ChartTooltip
            cursor={false}
            content={<ChartTooltipContent formatter={(v) => (isPct ? `${v}%` : `${v}`)} />}
          />
          <Bar dataKey="value" fill="var(--color-value)" radius={[0, 4, 4, 0]}>
            <LabelList
              dataKey="value"
              position="right"
              className="fill-muted-foreground text-[11px]"
              formatter={(v: number) => (isPct ? `${v}%` : v)}
            />
          </Bar>
        </BarChart>
      </ChartContainer>
    </div>
  );
}
