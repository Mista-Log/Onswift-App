import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { secureFetch } from "@/api/apiClient";
import { readCache, writeCache } from "@/lib/cache";

// Counts active deadlines — tasks (project and personal) that have a due date and are not yet
// completed, matching the Deadlines page. Drives the sidebar "Deadlines" badge.
// One request to /api/v2/deadlines/; the last value is cached so the badge shows instantly.
export function useDeadlineCount(): number {
  const { user } = useAuth();
  const [count, setCount] = useState<number>(
    () => readCache<number>("deadline-count") ?? 0
  );

  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    const load = async () => {
      try {
        const res = await secureFetch("/api/v2/deadlines/");
        if (!res.ok || cancelled) return;
        const rows: Array<{ status: string }> = await res.json();
        const total = rows.filter((r) => r.status !== "completed").length;
        if (!cancelled) {
          setCount(total);
          writeCache("deadline-count", total);
        }
      } catch {
        // Keep the cached value on failure.
      }
    };

    load();
    // A project was deleted (or its deadlines changed): recount now.
    window.addEventListener("onswift:deadlines-changed", load);

    return () => {
      cancelled = true;
      window.removeEventListener("onswift:deadlines-changed", load);
    };
  }, [user?.id]);

  return count;
}
