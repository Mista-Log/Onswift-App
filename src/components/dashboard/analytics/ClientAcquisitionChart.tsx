import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import type { ClientPoint } from "@/hooks/useCreatorAnalytics";

// Teal validated (light + dark) via the dataviz palette validator.
const config = {
  new_clients: {
    label: "New clients",
    theme: { light: "#0E9488", dark: "#0E9488" },
  },
} satisfies ChartConfig;

export function ClientAcquisitionChart({ data }: { data: ClientPoint[] }) {
  return (
    <ChartContainer config={config} className="h-[220px] w-full">
      <BarChart data={data} margin={{ left: -12, right: 8, top: 8 }}>
        <CartesianGrid vertical={false} strokeDasharray="3 3" className="stroke-border/40" />
        <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} minTickGap={16} interval="preserveStartEnd" className="text-xs" />
        <YAxis allowDecimals={false} width={28} tickLine={false} axisLine={false} className="text-xs" />
        <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
        <Bar dataKey="new_clients" fill="var(--color-new_clients)" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ChartContainer>
  );
}
