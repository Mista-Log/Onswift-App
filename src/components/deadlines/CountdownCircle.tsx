import { useEffect, useState } from "react";
import { Timer } from "lucide-react";
import { cn } from "@/lib/utils";
import { DigitalNumber } from "@/components/ui/digital-number";

const HOUR_MS = 3_600_000;
const DAY_MS = 24 * HOUR_MS;

const pad = (n: number) => String(n).padStart(2, "0");

interface CountdownCircleProps {
  target: Date;
  /** Which task is approaching; omitted where the surrounding page already says so. */
  taskName?: string;
}

function Segment({ value, label }: { value: string; label: string }) {
  return (
    <div className="flex flex-col items-center">
      <DigitalNumber value={value} className="text-2xl sm:text-4xl" />
      <span className="mt-1.5 text-[10px] uppercase tracking-wide text-muted-foreground">{label}</span>
    </div>
  );
}

/**
 * Round "Next Deadline" countdown in a 7-segment LCD font.
 * Under 24h the ring turns red with an urgent prompt; under 1h (or overdue) it blinks.
 */
export function CountdownCircle({ target, taskName }: CountdownCircleProps) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const tick = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(tick);
  }, []);

  const diff = target.getTime() - now;
  const overdue = diff <= 0;
  const urgent = diff < DAY_MS;
  const blinking = diff < HOUR_MS;
  const remaining = Math.max(diff, 0);

  const days = Math.floor(remaining / DAY_MS);
  const hours = Math.floor((remaining % DAY_MS) / HOUR_MS);
  const minutes = Math.floor((remaining % HOUR_MS) / 60_000);
  const seconds = Math.floor((remaining % 60_000) / 1_000);

  const state = overdue ? "overdue" : blinking ? "critical" : urgent ? "urgent" : "normal";

  return (
    <div
      role="timer"
      data-state={state}
      className={cn(
        "mx-auto flex aspect-square w-full max-w-[20rem] flex-col items-center justify-center rounded-full bg-card/80 px-8 text-center backdrop-blur-xl",
        urgent ? "border-4 border-destructive" : "border-2 border-primary/30",
        blinking && "countdown-blink"
      )}
    >
      <div className="mb-2 flex items-center gap-2">
        <Timer className={cn("h-5 w-5", urgent ? "text-destructive" : "text-primary")} />
        <h3 className="font-semibold text-foreground">Next Deadline</h3>
      </div>

      {taskName && (
        <p className="mb-2 max-w-[14rem] truncate text-sm font-medium text-foreground" title={taskName}>
          {taskName}
        </p>
      )}

      <div
        className={cn(
          "flex select-none items-start justify-center gap-1 sm:gap-1.5",
          urgent ? "text-destructive" : "text-primary"
        )}
      >
        <Segment value={pad(days)} label="days" />
        <DigitalNumber value=":" className="text-2xl sm:text-4xl" />
        <Segment value={pad(hours)} label="hrs" />
        <DigitalNumber value=":" className="text-2xl sm:text-4xl" />
        <Segment value={pad(minutes)} label="min" />
        <DigitalNumber value=":" className="text-2xl sm:text-4xl" />
        <Segment value={pad(seconds)} label="sec" />
      </div>

      {urgent && (
        <p className="mt-3 max-w-[13rem] text-xs font-semibold text-destructive">
          {overdue
            ? "Overdue! Wrap up this task as soon as you can."
            : "URGENT: Due in less than 24 hours!"}
        </p>
      )}
    </div>
  );
}
