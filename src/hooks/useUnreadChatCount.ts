import { useCallback, useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { secureFetch } from "@/api/apiClient";
import { readCache, writeCache } from "@/lib/cache";

const POLL_MS = 30_000;

// Total unread messages across direct conversations and group chats.
// Drives the sidebar "Chats" badge (same pattern as useDeadlineCount): the last
// value is cached so the badge shows instantly, then refreshes on mount, on
// every route change (so reading messages clears it promptly), and every 30 s.
export function useUnreadChatCount(): number {
  const location = useLocation();
  const [count, setCount] = useState<number>(
    () => readCache<number>("unread-chat-count") ?? 0
  );

  const load = useCallback(async () => {
    try {
      const [convRes, groupRes] = await Promise.all([
        secureFetch("/api/v2/conversations/"),
        secureFetch("/api/v2/groups/"),
      ]);
      let total = 0;
      if (convRes.ok) {
        const convs: Array<{ unread_count?: number }> = await convRes.json();
        total += convs.reduce((sum, c) => sum + (c.unread_count || 0), 0);
      }
      if (groupRes.ok) {
        const groups: Array<{ unread_count?: number }> = await groupRes.json();
        total += groups.reduce((sum, g) => sum + (g.unread_count || 0), 0);
      }
      setCount(total);
      writeCache("unread-chat-count", total);
    } catch {
      // Keep the cached value on failure.
    }
  }, []);

  useEffect(() => {
    load();
    const timer = setInterval(load, POLL_MS);
    return () => clearInterval(timer);
  }, [load, location.pathname]);

  return count;
}
