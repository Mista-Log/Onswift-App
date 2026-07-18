import { Label, Pie, PieChart } from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import type { TalentRow } from "@/hooks/useCreatorAnalytics";

// Two-slice status split; colours validated (light + dark) via the dataviz palette validator.
const config = {
  approved: { label: "Approved", theme: { light: "#6B5CE7", dark: "#8B7FF0" } },
  pending: { label: "Pending", theme: { light: "#F59E0B", dark: "#FBBF24" } },
} satisfies ChartConfig;

export function TeamStatusDonut({ data }: { data: TalentRow[] }) {
  const approved = data.reduce((sum, t) => sum + t.approved, 0);
  const pending = data.reduce((sum, t) => sum + t.pending, 0);
  const submitted = data.reduce((sum, t) => sum + t.submitted, 0);
  const approvalRate = submitted > 0 ? Math.round((approved / submitted) * 100) : 0;

  const chartData = [
    { status: "approved", value: approved, fill: "var(--color-approved)" },
    { status: "pending", value: pending, fill: "var(--color-pending)" },
  ];

  return (
    <div className="space-y-3">
      <ChartContainer config={config} className="mx-auto h-[220px] w-full">
        <PieChart>
          <ChartTooltip cursor={false} content={<ChartTooltipContent nameKey="status" hideLabel />} />
          <Pie
            data={chartData}
            dataKey="value"
            nameKey="status"
            innerRadius={65}
            outerRadius={90}
            paddingAngle={2}
            strokeWidth={2}
          >
            <Label
              content={({ viewBox }) => {
                if (viewBox && "cx" in viewBox && "cy" in viewBox) {
                  const cx = viewBox.cx ?? 0;
                  const cy = viewBox.cy ?? 0;
                  return (
                    <text x={cx} y={cy} textAnchor="middle" dominantBaseline="middle">
                      <tspan x={cx} y={cy} className="fill-foreground text-3xl font-bold">
                        {approvalRate}%
                      </tspan>
                      <tspan x={cx} y={cy + 22} className="fill-muted-foreground text-xs">
                        approval rate
                      </tspan>
                    </text>
                  );
                }
                return null;
              }}
            />
          </Pie>
        </PieChart>
      </ChartContainer>
      <p className="text-center text-xs text-muted-foreground">
        {approved} approved · {pending} pending
      </p>
    </div>
  );
}
