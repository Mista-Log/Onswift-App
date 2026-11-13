// The signed-in creator's past Agent conversations, newest first. The server only ever returns their own.
import { useCallback, useRef, useState } from "react";
import { secureFetch } from "@/api/apiClient";
import type { ConversationSummary } from "@/lib/agent/historyGroups";

interface HistoryState {
  items: ConversationSummary[];
  loading: boolean;
  error: boolean;
}

export function useConversationHistory() {
  const [state, setState] = useState<HistoryState>({ items: [], loading: false, error: false });
  const latest = useRef(0);

  const refresh = useCallback(async () => {
    const mine = ++latest.current;
    setState((s) => ({ ...s, loading: true, error: false }));
    try {
      const res = await secureFetch("/api/v9/conversations/");
      if (!res.ok) throw new Error(String(res.status));
      const data = await res.json();
      if (mine !== latest.current) return; // a newer refresh is on its way
      setState({ items: Array.isArray(data) ? data : [], loading: false, error: false });
    } catch {
      if (mine === latest.current) setState((s) => ({ ...s, loading: false, error: true }));
    }
  }, []);

  return { ...state, refresh };
}
