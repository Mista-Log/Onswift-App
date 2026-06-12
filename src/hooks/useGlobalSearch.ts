import { useState, useEffect, useRef, useCallback } from "react";
import { secureFetch } from "@/api/apiClient";

export interface SearchResult {
  type: "doc" | "file" | "project" | "talent" | "crm";
  id: string;
  title: string;
  subtitle: string;
  icon: string;
  route: string;
  url?: string;
  avatar?: string | null;
  updated_at?: string;
}

export interface SearchResults {
  docs: SearchResult[];
  files: SearchResult[];
  projects: SearchResult[];
  talents: SearchResult[];
  crm: SearchResult[];
}

const EMPTY: SearchResults = { docs: [], files: [], projects: [], talents: [], crm: [] };

export function useGlobalSearch() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResults>(EMPTY);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  const search = useCallback(async (q: string) => {
    if (!q || q.length < 2) {
      setResults(EMPTY);
      setOpen(false);
      return;
    }
    setLoading(true);
    try {
      const res = await secureFetch(`/api/v8/search/?q=${encodeURIComponent(q)}`);
      if (res.ok) {
        const data: SearchResults = await res.json();
        setResults(data);
        const hasAny =
          data.docs.length + data.files.length + data.projects.length + data.talents.length + (data.crm?.length ?? 0) > 0;
        setOpen(hasAny);
      }
    } catch {
      // silent — search failures shouldn't break the UI
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    clearTimeout(debounceRef.current);
    if (!query.trim()) {
      setResults(EMPTY);
      setOpen(false);
      return;
    }
    debounceRef.current = setTimeout(() => search(query), 300);
    return () => clearTimeout(debounceRef.current);
  }, [query, search]);

  const clear = useCallback(() => {
    setQuery("");
    setResults(EMPTY);
    setOpen(false);
  }, []);

  const totalCount =
    results.docs.length + results.files.length + results.projects.length + results.talents.length + (results.crm?.length ?? 0);

  return { query, setQuery, results, loading, open, setOpen, clear, totalCount };
}
