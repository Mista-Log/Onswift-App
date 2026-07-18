import { useEffect, useMemo, useState } from "react";
import { Timer } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Task } from "@/contexts/ProjectContext";

// Matches the Calendar's red rule: urgent inside 2 days, overdue past due.
const URGENT_MS = 2 * 24 * 60 * 60 * 1000;

// deadline is date-only; task_time (HH:MM:SS) sharpens it, else end of day.
function effectiveDeadline(task: Task): Date {
  return new Date(`${task.deadline}T${task.task_time || "23:59:59"}`);
}

function Segment({ value, label }: { value: string; label: string }) {
  return (
    <div className="flex flex-col items-center min-w-[2.5rem]">
      <span className="text-3xl font-bold leading-none">{value}</span>
      <span className="text-[10px] uppercase tracking-wide text-muted-foreground mt-1.5">
        {label}
      </span>
    </div>
  );
}

export function DeadlineCountdown({ tasks }: { tasks: Task[] }) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const tick = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(tick);
  }, []);

  const nextTask = useMemo(
    () =>
      tasks
        .filter((t) => t.deadline && t.status !== "completed")
        .sort(
          (a, b) => effectiveDeadline(a).getTime() - effectiveDeadline(b).getTime()
        )[0],
    [tasks]
  );

  if (!nextTask) {
    return (
      <section className="glass-card p-5 sm:p-6 md:p-7">
        <div className="flex items-center gap-2 mb-4">
          <Timer className="h-5 w-5 text-primary" />
          <h3 className="font-semibold text-foreground">Next Deadline</h3>
        </div>
        <p className="text-sm text-muted-foreground text-center py-4">
          No upcoming deadlines. You're all caught up.
        </p>
      </section>
    );
  }

  const diff = effectiveDeadline(nextTask).getTime() - now;
  const overdue = diff <= 0;
  const urgent = diff < URGENT_MS;
  const remaining = Math.max(diff, 0);

  const pad = (n: number) => String(n).padStart(2, "0");
  const days = Math.floor(remaining / 86_400_000);
  const hours = Math.floor((remaining % 86_400_000) / 3_600_000);
  const minutes = Math.floor((remaining % 3_600_000) / 60_000);
  const seconds = Math.floor((remaining % 60_000) / 1_000);

  return (
    <section className="glass-card p-5 sm:p-6 md:p-7">
      <div className="flex items-center gap-2 mb-4">
        <Timer className={cn("h-5 w-5", urgent ? "text-destructive" : "text-primary")} />
        <h3 className="font-semibold text-foreground">Next Deadline</h3>
      </div>

      {/* Which task is approaching */}
      <p
        className="text-sm font-medium text-foreground text-center truncate mb-3"
        title={nextTask.name}
      >
        {nextTask.name}
      </p>

      {/* Stopwatch digits — purple, flipping red on the Calendar's red rule */}
      <div
        className={cn(
          "flex items-start justify-center gap-1 font-mono tabular-nums select-none",
          urgent ? "text-destructive animate-pulse" : "text-primary"
        )}
      >
        <Segment value={pad(days)} label="days" />
        <span className="text-3xl font-bold leading-none">:</span>
        <Segment value={pad(hours)} label="hrs" />
        <span className="text-3xl font-bold leading-none">:</span>
        <Segment value={pad(minutes)} label="min" />
        <span className="text-3xl font-bold leading-none">:</span>
        <Segment value={pad(seconds)} label="sec" />
      </div>

      {overdue && (
        <p className="mt-3 text-center text-xs font-semibold text-destructive">
          Overdue!!
          Wrap up this task as soon as you can.
        </p>
      )}
    </section>
  );
}
