import { useMemo } from "react";
import { Timer } from "lucide-react";
import type { Task } from "@/contexts/ProjectContext";
import { CountdownCircle } from "@/components/deadlines/CountdownCircle";

// deadline is date-only; task_time (HH:MM:SS) sharpens it, else end of day.
function effectiveDeadline(task: Task): Date {
  return new Date(`${task.deadline}T${task.task_time || "23:59:59"}`);
}

export function DeadlineCountdown({ tasks }: { tasks: Task[] }) {
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

  return <CountdownCircle target={effectiveDeadline(nextTask)} taskName={nextTask.name} />;
}
