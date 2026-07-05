/**
 * QuickStartLauncher — a LinkedIn-messaging-style floating widget pinned to the
 * bottom-right of the creator dashboard. Collapsed, it "pokes its head" from the
 * bottom edge with a beaming purple dot for first-time creators. Opened, it shows
 * a guided checklist of the most important first actions; each item links to the
 * feature and strikes through once done. When all are complete it shows a
 * Duolingo-style purple-heart + confetti reward, then hides for good.
 *
 * Role gating is handled by the mount point (MainLayout, creators only).
 */
import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { CheckCircle2, Circle, ChevronDown, X, Rocket, Heart } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useQuickStart } from "@/hooks/useQuickStart";

const CONFETTI_COLORS = ["#7C5CF0", "#a78bfa", "#ede9fe", "#5A4BD1", "#ec4899"];

function usePrefersReducedMotion() {
  return useMemo(
    () =>
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    []
  );
}

/** Beaming purple dot shown on the collapsed bar for incomplete checklists. */
function BeamingDot({ animate }: { animate: boolean }) {
  return (
    <span className="relative flex h-2.5 w-2.5">
      {animate && (
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
      )}
      <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-primary" />
    </span>
  );
}

function ConfettiField() {
  const pieces = Array.from({ length: 18 }, (_, i) => {
    const color = CONFETTI_COLORS[i % CONFETTI_COLORS.length];
    const left = `${4 + (i * 13) % 92}%`;
    const delay = `${((i * 0.13) % 1.6).toFixed(2)}s`;
    const isCircle = i % 3 === 0;
    return (
      <div
        key={i}
        className="confetti-piece"
        style={{
          left,
          top: "-12px",
          width: isCircle ? "8px" : "6px",
          height: isCircle ? "6px" : "9px",
          backgroundColor: color,
          borderRadius: isCircle ? "50%" : "2px",
          animationDelay: delay,
        }}
      />
    );
  });
  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 h-40 overflow-hidden">
      {pieces}
    </div>
  );
}

export function QuickStartLauncher() {
  const navigate = useNavigate();
  const reduceMotion = usePrefersReducedMotion();
  const {
    items,
    completedCount,
    total,
    allDone,
    isDismissed,
    isRewarded,
    open,
    setOpen,
    dismiss,
    markRewarded,
  } = useQuickStart();

  // Gone for good once the creator dismisses it or has seen the reward.
  if (isDismissed || isRewarded) return null;

  const shellClasses =
    "fixed bottom-0 right-4 sm:right-6 z-50 w-[calc(100vw-2rem)] max-w-sm";

  // ── Reward screen (all items complete) ─────────────────────────────────────
  if (allDone) {
    return (
      <div className={shellClasses}>
        <div className="animate-scale-in overflow-hidden rounded-t-2xl border border-b-0 border-border/60 bg-card shadow-glow-lg">
          <div className="relative overflow-hidden bg-gradient-to-br from-primary/15 via-purple-500/5 to-pink-500/10 pt-9 pb-6 text-center">
            {!reduceMotion && <ConfettiField />}
            <Heart
              className={cn(
                "relative z-10 mx-auto h-14 w-14 fill-primary text-primary",
                !reduceMotion && "animate-bounce"
              )}
            />
          </div>
          <div className="space-y-2 px-6 pb-6 pt-4 text-center">
            <h2 className="text-xl font-bold text-foreground">You're all set! 💜</h2>
            <p className="text-sm leading-relaxed text-muted-foreground">
              You've explored everything that matters to get started. Go build
              something great on Onswift.
            </p>
            <div className="pt-3">
              <Button className="w-full" onClick={markRewarded}>
                Let's go
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Collapsed "poking head" bar ────────────────────────────────────────────
  if (!open) {
    return (
      <div className={shellClasses}>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex w-full items-center gap-3 rounded-t-2xl border border-b-0 border-border/60 bg-card px-4 py-3 text-left shadow-glow transition-colors hover:bg-secondary/40"
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Rocket className="h-4 w-4" />
          </span>
          <span className="flex-1">
            <span className="block text-sm font-semibold text-foreground">
              Quick Start
            </span>
            <span className="block text-xs text-muted-foreground">
              {completedCount}/{total} done. Pick up where you left off.
            </span>
          </span>
          <BeamingDot animate={!reduceMotion} />
        </button>
      </div>
    );
  }

  // ── Expanded checklist panel ───────────────────────────────────────────────
  const progress = Math.round((completedCount / total) * 100);
  return (
    <div className={shellClasses}>
      <div className="animate-scale-in overflow-hidden rounded-t-2xl border border-b-0 border-border/60 bg-card shadow-glow-lg">
        {/* Header */}
        <div className="flex items-center gap-2 border-b border-border/50 bg-gradient-to-br from-primary/10 to-transparent px-4 py-3">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Rocket className="h-4 w-4" />
          </span>
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-foreground">Quick Start</h3>
            <p className="text-xs text-muted-foreground">
              A quick crash course through OnSwift
            </p>
          </div>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
            aria-label="Collapse Quick Start"
          >
            <ChevronDown className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={dismiss}
            className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
            aria-label="Dismiss Quick Start"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Progress bar */}
        <div className="px-4 pt-3">
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="mt-1.5 text-right text-xs text-muted-foreground">
            {completedCount} of {total} complete
          </p>
        </div>

        {/* Checklist */}
        <ul className="max-h-[50vh] space-y-1 overflow-y-auto p-2">
          {items.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                disabled={item.done}
                onClick={() => {
                  setOpen(false);
                  navigate(item.href);
                }}
                className={cn(
                  "flex w-full items-start gap-3 rounded-lg px-2 py-2.5 text-left transition-colors",
                  item.done
                    ? "cursor-default opacity-70"
                    : "hover:bg-secondary/60"
                )}
              >
                {item.done ? (
                  <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 fill-primary text-primary-foreground" />
                ) : (
                  <Circle className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />
                )}
                <span className="min-w-0 flex-1">
                  <span
                    className={cn(
                      "block text-sm font-medium",
                      item.done
                        ? "text-muted-foreground line-through"
                        : "text-foreground"
                    )}
                  >
                    {item.label}
                  </span>
                  {!item.done && (
                    <span className="block text-xs text-muted-foreground">
                      {item.description}
                    </span>
                  )}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
