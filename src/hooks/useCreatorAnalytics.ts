import { useState, useEffect, useCallback } from "react";
import { secureFetch } from "@/api/apiClient";

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
  const [data, setData] = useState<CreatorAnalytics | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchAnalytics = useCallback(async (r: AnalyticsRange) => {
    try {
      setIsLoading(true);
      const res = await secureFetch(`/api/v2/creator/analytics/?range=${r}`);
      if (res.ok) setData(await res.json());
    } catch (error) {
      console.error("Error fetching analytics:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAnalytics(range);
  }, [range, fetchAnalytics]);

  return { data, isLoading, range, setRange };
}
