import { useState } from "react";
import { Timer } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { CountdownCircle } from "@/components/deadlines/CountdownCircle";
import { useNextDeadline } from "@/hooks/useNextDeadline";
import { useReminderSettings } from "@/hooks/useReminderSettings";

// Same data and pick rule as the clock on the Deadlines page (see lib/nextDeadline), so the two
// always count down to the same task. The Hide/Show choice is the same account setting the
// Deadlines page uses, so hiding the clock in one place hides it in the other.
export function DeadlineCountdown() {
  const next = useNextDeadline();
  const { settings, save } = useReminderSettings();
  // What was just clicked, shown at once while the save is in flight.
  const [pending, setPending] = useState<boolean | null>(null);
  const showTimer = pending ?? settings?.show_deadline_timer !== false;

  const toggleTimer = async () => {
    const wanted = !showTimer;
    setPending(wanted);
    const ok = await save({ show_deadline_timer: wanted });
    if (!ok) {
      // Not saved: go back to what the account has, and say so.
      setPending(null);
      toast.error("Couldn't save that choice. It will reset when you reload.");
    }
  };

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

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button
          variant={showTimer ? "default" : "outline"}
          size="sm"
          onClick={toggleTimer}
          aria-pressed={showTimer}
          className="font-semibold gap-2"
        >
          <Timer className="h-4 w-4" />
          {showTimer ? "Hide" : "Show"} Deadline Timer
        </Button>
      </div>
      {showTimer && <CountdownCircle target={next.at} taskName={next.row.name} />}
    </div>
  );
}
