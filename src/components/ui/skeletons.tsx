// Ready-made loading placeholders built from the shared Skeleton block (ui/skeleton.tsx). Each is
// one "status" region, so a screen reader hears a single "Loading" rather than a pile of grey boxes.
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

function Loading({ label, className, children }: { label: string; className?: string; children: React.ReactNode }) {
  return (
    <div role="status" aria-busy="true" aria-label={label} className={className}>
      {children}
    </div>
  );
}

// Pulsing stops for people who ask their device for reduced motion.
const still = "motion-reduce:animate-none";

/** A grid of card-shaped placeholders (projects, team members). */
export function CardGridSkeleton({
  count = 6,
  label = "Loading",
  className,
}: {
  count?: number;
  label?: string;
  className?: string;
}) {
  return (
    <Loading label={label} className={cn("grid gap-6 md:grid-cols-2 lg:grid-cols-3", className)}>
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="glass-card space-y-4 p-6" aria-hidden>
          <div className="flex items-center justify-between gap-3">
            <Skeleton className={cn("h-5 w-2/3", still)} />
            <Skeleton className={cn("h-3.5 w-3.5 rounded-full", still)} />
          </div>
          <Skeleton className={cn("h-4 w-full", still)} />
          <Skeleton className={cn("h-4 w-4/5", still)} />
          <Skeleton className={cn("h-2 w-full rounded-full", still)} />
        </div>
      ))}
    </Loading>
  );
}

/** A stack of row-shaped placeholders (notifications, forms, lists). */
export function ListSkeleton({
  count = 5,
  label = "Loading",
  className,
}: {
  count?: number;
  label?: string;
  className?: string;
}) {
  return (
    <Loading label={label} className={cn("space-y-3", className)}>
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="glass-card flex items-center gap-4 p-4" aria-hidden>
          <Skeleton className={cn("h-10 w-10 shrink-0 rounded-full", still)} />
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton className={cn("h-4 w-1/2", still)} />
            <Skeleton className={cn("h-3.5 w-3/4", still)} />
          </div>
          <Skeleton className={cn("hidden h-8 w-20 shrink-0 sm:block", still)} />
        </div>
      ))}
    </Loading>
  );
}

/** Three board columns of cards (the project task board). */
export function BoardSkeleton({ label = "Loading tasks" }: { label?: string }) {
  return (
    <Loading label={label} className="grid gap-5 md:grid-cols-3">
      {Array.from({ length: 3 }, (_, col) => (
        <div key={col} className="space-y-3 rounded-2xl border border-border/50 p-5" aria-hidden>
          <Skeleton className={cn("h-5 w-1/3", still)} />
          {Array.from({ length: col === 1 ? 2 : 3 }, (_, i) => (
            <div key={i} className="space-y-2 rounded-xl border border-border/50 p-4">
              <Skeleton className={cn("h-4 w-3/4", still)} />
              <Skeleton className={cn("h-3.5 w-1/2", still)} />
            </div>
          ))}
        </div>
      ))}
    </Loading>
  );
}
