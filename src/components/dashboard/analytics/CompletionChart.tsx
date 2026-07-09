import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import type { CompletionPoint } from "@/hooks/useCreatorAnalytics";

// Colours validated (light + dark) via the dataviz palette validator.
const config = {
  approved: {
    label: "Approved",
    theme: { light: "#6B5CE7", dark: "#8B7FF0" },
  },
} satisfies ChartConfig;

export function CompletionChart({ data }: { data: CompletionPoint[] }) {
  return (
    <ChartContainer config={config} className="h-[220px] w-full">
      <AreaChart data={data} margin={{ left: -12, right: 8, top: 8 }}>
        <CartesianGrid vertical={false} strokeDasharray="3 3" className="stroke-border/40" />
        <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} minTickGap={16} interval="preserveStartEnd" className="text-xs" />
        <YAxis allowDecimals={false} width={28} tickLine={false} axisLine={false} className="text-xs" />
        <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
        <defs>
          <linearGradient id="fillApproved" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="var(--color-approved)" stopOpacity={0.35} />
            <stop offset="95%" stopColor="var(--color-approved)" stopOpacity={0.04} />
          </linearGradient>
        </defs>
        <Area
          dataKey="approved"
          type="natural"
          fill="url(#fillApproved)"
          stroke="var(--color-approved)"
          strokeWidth={2}
        />
      </AreaChart>
    </ChartContainer>
  );
}
