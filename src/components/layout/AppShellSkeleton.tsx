import { Skeleton } from "@/components/ui/skeleton";
import { CardGridSkeleton } from "@/components/ui/skeletons";

/**
 * Shown while the app checks who is signed in. It draws the app's own frame (sidebar rail, top bar and
 * a content area) so the screen is already the right shape when the real page replaces it.
 */
export function AppShellSkeleton() {
  return (
    <div className="flex min-h-screen w-full bg-background" role="status" aria-busy="true" aria-label="Loading the app">
      <div className="hidden w-20 shrink-0 flex-col items-center gap-4 border-r border-border/50 py-6 md:flex" aria-hidden>
        <Skeleton className="h-10 w-10 rounded-xl" />
        {Array.from({ length: 6 }, (_, i) => (
          <Skeleton key={i} className="h-9 w-9 rounded-lg" />
        ))}
      </div>

      <div className="flex min-w-0 flex-1 flex-col" aria-hidden>
        <div className="flex h-16 items-center justify-between border-b border-border/50 px-4 pl-16 md:pl-4">
          <Skeleton className="h-9 w-40 rounded-full sm:w-64" />
          <div className="flex items-center gap-3">
            <Skeleton className="h-9 w-9 rounded-full" />
            <Skeleton className="h-9 w-9 rounded-full" />
          </div>
        </div>
        <div className="space-y-6 p-4 sm:space-y-8">
          <div className="space-y-2">
            <Skeleton className="h-8 w-48 sm:w-72" />
            <Skeleton className="h-4 w-64 max-w-full sm:w-96" />
          </div>
          <CardGridSkeleton count={3} label="Loading" />
        </div>
      </div>
    </div>
  );
}
