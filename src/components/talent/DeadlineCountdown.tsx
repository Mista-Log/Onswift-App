import { Timer } from "lucide-react";
import { CountdownCircle } from "@/components/deadlines/CountdownCircle";
import { useNextDeadline } from "@/hooks/useNextDeadline";

// Same data and pick rule as the clock on the Deadlines page (see lib/nextDeadline), so the two
// always count down to the same task.
export function DeadlineCountdown() {
  const next = useNextDeadline();

  if (!next) {
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

  return <CountdownCircle target={next.at} taskName={next.row.name} />;
}
