import type { TalentRow } from "@/hooks/useCreatorAnalytics";

const avatar = (name: string) => `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(name)}`;

/** One row per team member: completed-task volume as a bar, approval rate alongside. */
export function TeamPerformanceList({ data }: { data: TalentRow[] }) {
  const rows = [...data].sort((a, b) => b.tasks_completed - a.tasks_completed || b.approved - a.approved);
  const max = Math.max(1, ...rows.map((t) => t.tasks_completed));

  return (
    <ul className="space-y-3">
      {rows.map((t) => (
        <li key={t.user_id} className="flex min-w-0 items-center gap-3">
          <img src={avatar(t.name)} alt="" className="h-9 w-9 shrink-0 rounded-full border border-border/50 bg-secondary" />
          <div className="w-32 min-w-0 shrink-0 sm:w-44">
            <p className="truncate text-sm font-medium text-foreground" title={t.name}>{t.name}</p>
            <p className="truncate text-xs text-muted-foreground">
              {t.approved}/{t.submitted} approved · {t.pending} pending
            </p>
          </div>
          <div className="hidden h-2 flex-1 overflow-hidden rounded-full bg-muted sm:block">
            <div
              className="h-full rounded-full bg-primary transition-all duration-500"
              style={{ width: `${(t.tasks_completed / max) * 100}%` }}
            />
          </div>
          <span className="ml-auto shrink-0 text-right text-sm font-semibold text-foreground sm:ml-0 sm:w-20">
            {t.tasks_completed} {t.tasks_completed === 1 ? "task" : "tasks"}
          </span>
          <span className="w-24 shrink-0 text-right text-xs font-medium text-emerald-600 dark:text-emerald-400">
            {t.approval_rate}% approval
          </span>
        </li>
      ))}
    </ul>
  );
}
