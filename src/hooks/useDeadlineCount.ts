import { useEffect, useState } from "react";
import { useProjects } from "@/contexts/ProjectContext";
import { readCache, writeCache } from "@/lib/cache";

// Counts active deadlines across all of the user's projects — tasks that have a
// deadline set and are not yet completed (matches the Deadlines page's
// urgent/overdue + due tasks). Drives the sidebar "Deadlines" badge.
// The last value is cached so the badge shows instantly, then refreshes on mount.
export function useDeadlineCount(): number {
  const { projects, fetchProjectTasks } = useProjects();
  const [count, setCount] = useState<number>(
    () => readCache<number>("deadline-count") ?? 0
  );

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      if (projects.length === 0) {
        if (!cancelled) {
          setCount(0);
          writeCache("deadline-count", 0);
        }
        return;
      }

      try {
        const results = await Promise.all(
          projects.map((p) => fetchProjectTasks(p.id))
        );
        const total = results
          .flat()
          .filter((t) => t.deadline && t.status !== "completed").length;

        if (!cancelled) {
          setCount(total);
          writeCache("deadline-count", total);
        }
      } catch {
        // Keep the cached value on failure.
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [projects, fetchProjectTasks]);

  return count;
}
