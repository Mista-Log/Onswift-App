import { useEffect, useMemo, useState } from "react";
import { secureFetch } from "@/api/apiClient";
import { readCache, writeCache } from "@/lib/cache";
import { pickNextDeadline, type DeadlineLike } from "@/lib/nextDeadline";

const POLL_MS = 30_000;

/**
 * The task the Next Deadline clock counts down to, from the same `/api/v2/deadlines/` data and the
 * same pick rule as the Deadlines page, so the Talent dashboard clock always matches it. Uses the
 * shared `deadlines` browser copy so it paints instantly.
 */
export function useNextDeadline() {
  const [rows, setRows] = useState<DeadlineLike[]>(() => readCache<DeadlineLike[]>("deadlines") ?? []);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await secureFetch("/api/v2/deadlines/");
        if (!res.ok || cancelled) return;
        const data: DeadlineLike[] = await res.json();
        if (cancelled) return;
        setRows(data);
        writeCache("deadlines", data);
      } catch {
        // Keep whatever is on screen (the saved copy) if the request fails.
      }
    };
    load();
    const timer = setInterval(() => {
      if (!document.hidden) load();
    }, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, []);

  return useMemo(() => pickNextDeadline(rows), [rows]);
}
