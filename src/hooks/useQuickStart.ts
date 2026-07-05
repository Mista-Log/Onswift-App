/**
 * useQuickStart — progress state for the creator Quick Start checklist.
 *
 * All progress lives in localStorage (matching the existing
 * `onswift_celebrated_first_*` milestone pattern). Flags are re-read on every
 * route change and whenever the window regains focus, so an item strikes through
 * as soon as the creator returns from completing the action. Visit-based items
 * (Docs, Onboarding) are marked complete simply by opening their page — no edits
 * to those pages required.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import {
  QUICK_START_ITEMS,
  QUICK_START_KEYS,
  type QuickStartItem,
} from "@/components/quickstart/quickStartConfig";

/** Items considered done just by opening their page. */
const VISIT_BASED_IDS = new Set(["docs", "onboarding"]);

function readFlag(key: string): boolean {
  return typeof window !== "undefined" && localStorage.getItem(key) === "1";
}

export interface QuickStartItemState extends QuickStartItem {
  done: boolean;
}

export function useQuickStart() {
  const location = useLocation();
  // Bumped to force a re-read of localStorage-backed values.
  const [version, setVersion] = useState(0);
  const refresh = useCallback(() => setVersion((v) => v + 1), []);

  // Re-read flags when the window regains focus (e.g. after completing an action).
  useEffect(() => {
    window.addEventListener("focus", refresh);
    return () => window.removeEventListener("focus", refresh);
  }, [refresh]);

  // Mark visit-based items (Docs, Onboarding) complete when their page is opened.
  useEffect(() => {
    const match = QUICK_START_ITEMS.find(
      (item) =>
        VISIT_BASED_IDS.has(item.id) && location.pathname.startsWith(item.href)
    );
    if (match && !readFlag(match.doneFlag)) {
      localStorage.setItem(match.doneFlag, "1");
      refresh();
    }
  }, [location.pathname, refresh]);

  const items = useMemo<QuickStartItemState[]>(
    () =>
      QUICK_START_ITEMS.map((item) => ({ ...item, done: readFlag(item.doneFlag) })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [version, location.pathname]
  );

  const total = items.length;
  const completedCount = items.filter((i) => i.done).length;
  const allDone = completedCount === total;

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const isDismissed = useMemo(() => readFlag(QUICK_START_KEYS.dismissed), [version]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const isRewarded = useMemo(() => readFlag(QUICK_START_KEYS.rewarded), [version]);

  const [open, setOpenState] = useState(() => readFlag(QUICK_START_KEYS.open));
  const setOpen = useCallback((next: boolean) => {
    if (next) localStorage.setItem(QUICK_START_KEYS.open, "1");
    else localStorage.removeItem(QUICK_START_KEYS.open);
    setOpenState(next);
  }, []);

  const dismiss = useCallback(() => {
    localStorage.setItem(QUICK_START_KEYS.dismissed, "1");
    refresh();
  }, [refresh]);

  const markRewarded = useCallback(() => {
    localStorage.setItem(QUICK_START_KEYS.rewarded, "1");
    refresh();
  }, [refresh]);

  return {
    items,
    completedCount,
    total,
    allDone,
    isDismissed,
    isRewarded,
    open,
    setOpen,
    dismiss,
    markRewarded,
  };
}
