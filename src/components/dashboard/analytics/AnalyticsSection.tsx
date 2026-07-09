import { ChevronDown, Loader2, TrendingUp, UserPlus, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useCreatorAnalytics, type AnalyticsRange } from "@/hooks/useCreatorAnalytics";
import { CompletionChart } from "./CompletionChart";
import { ClientAcquisitionChart } from "./ClientAcquisitionChart";
import { TalentPerformanceChart } from "./TalentPerformanceChart";

const RANGES: { value: AnalyticsRange; label: string }[] = [
  { value: "24h", label: "Last 24 hours" },
  { value: "7d", label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" },
  { value: "3m", label: "Last 3 months" },
  { value: "12m", label: "Last 12 months" },
  { value: "24m", label: "Last 24 months" },
];

function ChartSkeleton() {
  return (
    <div className="flex h-[220px] items-center justify-center">
      <Loader2 className="h-6 w-6 animate-spin text-primary" />
    </div>
  );
}

function ChartCard({
  icon: Icon,
  title,
  subtitle,
  children,
}: {
  icon: typeof TrendingUp;
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-border/50 p-4">
      <div className="mb-1 flex items-center gap-2">
        <Icon className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      </div>
      <p className="mb-4 text-xs text-muted-foreground">{subtitle}</p>
      {children}
    </div>
  );
}

export function AnalyticsSection() {
  const { data, isLoading, range, setRange } = useCreatorAnalytics("30d");
  const activeLabel = RANGES.find((r) => r.value === range)?.label ?? "Range";

  return (
    <section className="glass-card p-5 sm:p-6 md:p-7 space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-foreground">Analytics</h2>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="sm" className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90">
              {activeLabel}
              <ChevronDown className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {RANGES.map((r) => (
              <DropdownMenuItem key={r.value} onClick={() => setRange(r.value)}>
                {r.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard icon={TrendingUp} title="Completed work" subtitle="Approved deliverables per month">
          {isLoading ? <ChartSkeleton /> : <CompletionChart data={data?.completion ?? []} />}
        </ChartCard>

        <ChartCard icon={UserPlus} title="Client acquisition" subtitle="New clients per month">
          {isLoading ? <ChartSkeleton /> : <ClientAcquisitionChart data={data?.clients ?? []} />}
        </ChartCard>
      </div>

      <ChartCard icon={Users} title="Talent performance" subtitle="How your team is delivering">
        {isLoading ? (
          <ChartSkeleton />
        ) : data && data.talent.length > 0 ? (
          <TalentPerformanceChart data={data.talent} />
        ) : (
          <div className="flex h-[220px] flex-col items-center justify-center text-center text-muted-foreground">
            <Users className="mb-2 h-10 w-10 opacity-40" />
            <p className="text-sm">No team activity yet</p>
            <p className="text-xs">Invite talent and assign work to see performance here.</p>
          </div>
        )}
      </ChartCard>
    </section>
  );
}
