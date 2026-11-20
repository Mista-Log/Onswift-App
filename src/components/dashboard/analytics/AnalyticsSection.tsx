import { ChevronDown, Loader2, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { useCreatorAnalytics, type AnalyticsRange } from "@/hooks/useCreatorAnalytics";
import { useProjects } from "@/contexts/ProjectContext";
import { StatusDot } from "@/components/dashboard/StatusDot";
import { ThroughputChart } from "./ThroughputChart";
import { TeamPerformanceList } from "./TeamPerformanceList";

const RANGES: { value: AnalyticsRange; label: string }[] = [
  { value: "24h", label: "Last 24 hours" },
  { value: "7d", label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" },
  { value: "3m", label: "Last 3 months" },
  { value: "12m", label: "Last 12 months" },
  { value: "24m", label: "Last 24 months" },
];

// Slice colours match StatusDot (purple / red / green), so the donut and the legend dots agree.
const STATUSES = [
  { value: "in-progress", label: "In Progress", color: "hsl(250 76% 63%)" },
  { value: "planning", label: "Planning", color: "rgb(239 68 68)" },
  { value: "completed", label: "Completed", color: "rgb(16 185 129)" },
] as const;

/** Donut drawn with a conic gradient: no chart library needed, and it renders the same everywhere. */
function StatusDonut({ slices, total }: { slices: { color: string; count: number }[]; total: number }) {
  let start = 0;
  const stops = slices
    .filter((s) => s.count > 0)
    .map((s) => {
      const end = start + (s.count / total) * 360;
      const stop = `${s.color} ${start}deg ${end}deg`;
      start = end;
      return stop;
    });
  return (
    <div
      className="relative h-32 w-32 shrink-0 rounded-full"
      style={{ background: `conic-gradient(${stops.join(", ")})` }}
      aria-hidden
    >
      <div className="absolute inset-[18%] flex flex-col items-center justify-center rounded-full bg-card">
        <span className="text-2xl font-bold leading-none text-foreground">{total}</span>
        <span className="mt-1 text-[11px] text-muted-foreground">{total === 1 ? "project" : "projects"}</span>
      </div>
    </div>
  );
}

function Spinner({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center justify-center", className)}>
      <Loader2 className="h-6 w-6 animate-spin text-primary" />
    </div>
  );
}

function Panel({ title, aside, className, children }: { title: string; aside?: React.ReactNode; className?: string; children: React.ReactNode }) {
  return (
    <section className={cn("glass-card min-w-0 p-4 sm:p-5", className)}>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-foreground">{title}</h2>
        {aside}
      </div>
      {children}
    </section>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="glass-card min-w-0 p-4">
      <p className="truncate text-xs font-medium text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-bold leading-tight text-foreground">{value}</p>
    </div>
  );
}

export function AnalyticsSection() {
  const { data, isLoading, error, refetch, range, setRange } = useCreatorAnalytics("30d");
  const { projects, isLoading: projectsLoading } = useProjects();

  const approved = data?.completion.reduce((sum, p) => sum + p.approved, 0) ?? 0;
  const newClients = data?.clients.reduce((sum, p) => sum + p.new_clients, 0) ?? 0;
  const submitted = data?.talent.reduce((sum, t) => sum + t.submitted, 0) ?? 0;
  const talentApproved = data?.talent.reduce((sum, t) => sum + t.approved, 0) ?? 0;
  const approvalRate = submitted > 0 ? `${Math.round((talentApproved / submitted) * 100)}%` : "—";
  const activeProjects = projects.filter((p) => p.status !== "completed").length;
  const statusCounts = STATUSES.map((s) => ({ ...s, count: projects.filter((p) => p.status === s.value).length }));
  const show = (v: string) => (isLoading && !data ? "—" : v);
  const activeLabel = RANGES.find((r) => r.value === range)?.label ?? "Range";

  return (
    <div className="space-y-4 sm:space-y-5">
      {/* Header + range switch */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground sm:text-3xl">Analytics</h1>
          <p className="mt-1 text-sm text-muted-foreground">How your agency is delivering across projects and team.</p>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="sm" className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90">
              {activeLabel}
              <ChevronDown className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {RANGES.map((r) => (
              <DropdownMenuItem
                key={r.value}
                onClick={() => setRange(r.value)}
                className={cn(range === r.value && "font-semibold text-primary")}
              >
                {r.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {error && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3">
          <p className="text-sm text-destructive">{error}</p>
          <Button size="sm" variant="outline" onClick={refetch}>Try again</Button>
        </div>
      )}

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Approved deliverables" value={show(String(approved))} />
        <StatCard label="New clients" value={show(String(newClients))} />
        <StatCard label="Approval rate" value={show(approvalRate)} />
        <StatCard label="Active projects" value={projectsLoading && projects.length === 0 ? "—" : String(activeProjects)} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Throughput */}
        <Panel
          title="Deliverables & clients"
          className="lg:col-span-2"
          aside={
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-[hsl(250_76%_63%)]" />Approved</span>
              <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-[hsl(250_60%_85%)] dark:bg-[hsl(250_30%_45%)]" />New clients</span>
            </div>
          }
        >
          {isLoading && !data ? (
            <Spinner className="h-[200px] sm:h-[240px] xl:h-[280px]" />
          ) : (
            <ThroughputChart completion={data?.completion ?? []} clients={data?.clients ?? []} />
          )}
        </Panel>

        {/* Projects by status */}
        <Panel title="Projects by status">
          {projectsLoading && projects.length === 0 ? (
            <Spinner className="h-32" />
          ) : projects.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">No projects yet</p>
          ) : (
            <div className="flex flex-wrap items-center justify-center gap-5 sm:flex-nowrap lg:flex-wrap xl:flex-nowrap">
              <StatusDonut slices={statusCounts} total={projects.length} />
              <ul className="min-w-0 flex-1 space-y-2.5">
                {statusCounts.map((s) => (
                  <li key={s.value} className="flex items-center gap-2.5 text-sm">
                    <StatusDot status={s.value} className="h-3 w-3" />
                    <span className="flex-1 truncate text-foreground">{s.label}</span>
                    <span className="font-semibold text-foreground">{s.count}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Panel>
      </div>

      {/* Team performance */}
      <Panel title="Team performance">
        {isLoading && !data ? (
          <Spinner className="h-32" />
        ) : error && !data ? (
          <p className="py-8 text-center text-sm text-muted-foreground">Data unavailable.</p>
        ) : data && data.talent.length > 0 ? (
          <TeamPerformanceList data={data.talent} />
        ) : (
          <div className="flex flex-col items-center justify-center py-8 text-center text-muted-foreground">
            <Users className="mb-2 h-10 w-10 opacity-40" />
            <p className="text-sm">No team activity yet</p>
            <p className="text-xs">Invite talent and assign work to see performance here.</p>
          </div>
        )}
      </Panel>
    </div>
  );
}
