import { Bar, BarChart, CartesianGrid, XAxis } from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import type { ClientPoint, CompletionPoint } from "@/hooks/useCreatorAnalytics";

// Brand purple for the headline series, a pale purple for the secondary one (mirrors the landing preview).
const config = {
  approved: { label: "Approved deliverables", theme: { light: "hsl(250 76% 63%)", dark: "hsl(250 76% 63%)" } },
  new_clients: { label: "New clients", theme: { light: "hsl(250 60% 85%)", dark: "hsl(250 30% 45%)" } },
} satisfies ChartConfig;

/** Grouped bars per time bucket. Both series come from the same backend buckets, so they line up by key. */
export function ThroughputChart({ completion, clients }: { completion: CompletionPoint[]; clients: ClientPoint[] }) {
  const byKey = new Map(clients.map((c) => [c.month, c.new_clients]));
  const data = completion.map((c) => ({ label: c.label, approved: c.approved, new_clients: byKey.get(c.month) ?? 0 }));

  return (
    <ChartContainer config={config} className="h-[200px] w-full sm:h-[240px] xl:h-[280px]">
      <BarChart data={data} margin={{ left: 0, right: 0, top: 8 }} barGap={3}>
        <CartesianGrid vertical={false} strokeDasharray="3 3" className="stroke-border/40" />
        <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} minTickGap={16} interval="preserveStartEnd" className="text-xs" />
        <ChartTooltip cursor={{ fill: "hsl(var(--muted) / 0.4)" }} content={<ChartTooltipContent />} />
        <Bar dataKey="approved" fill="var(--color-approved)" radius={[4, 4, 0, 0]} maxBarSize={22} />
        <Bar dataKey="new_clients" fill="var(--color-new_clients)" radius={[4, 4, 0, 0]} maxBarSize={22} />
      </BarChart>
    </ChartContainer>
  );
}
