import { useState, useEffect, useCallback } from "react";
import { secureFetch } from "@/api/apiClient";
import { readCache, writeCache } from "@/lib/cache";

const ANALYTICS_TTL_MS = 30 * 60 * 1000;

export type AnalyticsRange = "24h" | "7d" | "30d" | "3m" | "12m" | "24m";

export interface CompletionPoint {
  month: string;
  label: string;
  approved: number;
}

export interface ClientPoint {
  month: string;
  label: string;
  new_clients: number;
}

export interface TalentRow {
  user_id: string;
  name: string;
  approved: number;
  submitted: number;
  approval_rate: number;
  tasks_completed: number;
  pending: number;
}

export interface CreatorAnalytics {
  range: string;
  completion: CompletionPoint[];
  clients: ClientPoint[];
  talent: TalentRow[];
}

/**
 * Fetches the creator dashboard analytics for a selectable time range.
 * Refetches whenever `range` changes.
 */
export function useCreatorAnalytics(initial: AnalyticsRange = "30d") {
  const [range, setRange] = useState<AnalyticsRange>(initial);
  const [data, setData] = useState<CreatorAnalytics | null>(
    () => readCache<CreatorAnalytics>(`analytics:${initial}`)
  );
  const [isLoading, setIsLoading] = useState(() => !readCache(`analytics:${initial}`));
  const [error, setError] = useState<string | null>(null);

  const fetchAnalytics = useCallback(async (r: AnalyticsRange) => {
    try {
      // Show this range's browser copy straight away; the spinner is only for a first visit.
      const cached = readCache<CreatorAnalytics>(`analytics:${r}`);
      if (cached) setData(cached);
      setIsLoading(!cached);
      setError(null);
      const res = await secureFetch(`/api/v2/creator/analytics/?range=${r}`);
      if (res.ok) {
        const fresh: CreatorAnalytics = await res.json();
        setData(fresh);
        writeCache(`analytics:${r}`, fresh, ANALYTICS_TTL_MS);
      } else if (cached) {
        // Keep showing the saved copy rather than an error over good data.
      } else {
        setError(`Couldn't load analytics (error ${res.status}).`);
      }
    } catch (err) {
      console.error("Error fetching analytics:", err);
      if (readCache(`analytics:${r}`)) return; // offline: the saved copy stays on screen
      setError("Couldn't reach the server. Check your connection and try again.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAnalytics(range);
  }, [range, fetchAnalytics]);

  const refetch = useCallback(() => fetchAnalytics(range), [range, fetchAnalytics]);

  return { data, isLoading, error, refetch, range, setRange };
}
