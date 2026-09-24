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
    <div className="grid min-w-0 grid-cols-1 items-center gap-6 lg:grid-cols-2">
      <div className="min-w-0 space-y-3">
      <ChartContainer config={config} className="mx-auto h-[220px] w-full sm:h-[300px] xl:h-[380px]">
        <PieChart>
          <ChartTooltip cursor={false} content={<ChartTooltipContent nameKey="status" hideLabel />} />
          <Pie
            data={chartData}
            dataKey="value"
            nameKey="status"
            innerRadius="62%"
            outerRadius="88%"
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
                      <tspan x={cx} y={cy} className="fill-foreground text-2xl font-bold sm:text-3xl">
                        {approvalRate}%
                      </tspan>
                      <tspan x={cx} y={cy + 20} className="fill-muted-foreground text-[11px] sm:text-xs">
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

      <ul className="min-w-0 divide-y divide-border/50">
        {[...data]
          .sort((a, b) => b.approved - a.approved || b.tasks_completed - a.tasks_completed)
          .map((t) => (
            <li
              key={t.user_id}
              className="flex min-w-0 flex-col gap-1 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-3"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-foreground" title={t.name}>{t.name}</p>
                <p className="text-xs text-muted-foreground">
                  {t.tasks_completed} {t.tasks_completed === 1 ? "task" : "tasks"} completed
                </p>
              </div>
              <div className="min-w-0 sm:text-right">
                <p className="text-sm font-semibold text-foreground">{t.approval_rate}% approval</p>
                <p className="flex flex-wrap gap-x-2 text-xs text-muted-foreground sm:justify-end">
                  <span>{t.approved}/{t.submitted} approved</span>
                  <span>{t.pending} pending</span>
                </p>
              </div>
            </li>
          ))}
      </ul>
    </div>
  );
}
