import { useSyncExternalStore } from "react";
import { secureFetch } from "@/api/apiClient";

// Write-behind queue for task status changes: the screen updates instantly, the change is stored on
// this device, and it is sent to the server in the background, retrying until the server accepts it
// (weak network, offline, or a reload in between). Only status changes go through here.

export type StatusKind = "task" | "personal";
export type TaskStatus = "planning" | "in-progress" | "completed";

interface QueuedChange {
  key: string;
  method: "PATCH";
  url: string;
  body: { status: TaskStatus };
  meta: { kind: StatusKind; id: string; status: TaskStatus };
  version: number;
  attempts: number;
}

export interface SyncResult {
  ok: boolean;
  kind: StatusKind;
  id: string;
  status: TaskStatus;
  /** HTTP status when the server rejected the change. */
  httpStatus?: number;
}

export interface SyncSnapshot {
  pending: number;
  syncing: boolean;
  online: boolean;
}

// Shares the cache prefix so logging out (clearAllCache) also drops unsent changes; they must
// never be replayed under a different account.
const STORAGE_KEY = "onswift_cache_sync_queue";
const FLUSH_INTERVAL_MS = 15_000;
const MAX_BACKOFF_MS = 30_000;

const URLS: Record<StatusKind, (id: string) => string> = {
  task: (id) => `/api/v2/tasks/${id}/`,
  personal: (id) => `/api/v2/personal-tasks/${id}/`,
};

function load(): QueuedChange[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((i) => i && i.key && i.url && i.body?.status) : [];
  } catch {
    return [];
  }
}

let items: QueuedChange[] = load();
let flushing = false;
let versionCounter = Date.now();
let retryTimer: ReturnType<typeof setTimeout> | null = null;
let started = false;

const listeners = new Set<() => void>();
const resultListeners = new Set<(r: SyncResult) => void>();

const isOnline = () => (typeof navigator === "undefined" ? true : navigator.onLine !== false);

let snapshot: SyncSnapshot = { pending: items.length, syncing: false, online: isOnline() };

function refreshSnapshot() {
  const next: SyncSnapshot = { pending: items.length, syncing: flushing, online: isOnline() };
  if (
    next.pending !== snapshot.pending ||
    next.syncing !== snapshot.syncing ||
    next.online !== snapshot.online
  ) {
    snapshot = next;
    listeners.forEach((l) => l());
  }
}

function persist() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch {
    // Storage full or unavailable: the queue still works for this session.
  }
}

function emit(result: SyncResult) {
  resultListeners.forEach((l) => l(result));
}

function scheduleRetry(attempts: number) {
  if (retryTimer) clearTimeout(retryTimer);
  const delay = Math.min(MAX_BACKOFF_MS, 1000 * 2 ** Math.max(0, attempts - 1));
  retryTimer = setTimeout(() => {
    retryTimer = null;
    void flush();
  }, delay);
}

function start() {
  if (started || typeof window === "undefined") return;
  started = true;
  window.addEventListener("online", () => {
    refreshSnapshot();
    void flush();
  });
  window.addEventListener("offline", refreshSnapshot);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") void flush();
  });
  setInterval(() => void flush(), FLUSH_INTERVAL_MS);
  void flush();
}

/** Send everything that is waiting. Safe to call at any time; concurrent calls are ignored. */
export async function flush(): Promise<void> {
  if (flushing || items.length === 0) return;
  if (!isOnline()) {
    refreshSnapshot();
    return;
  }

  flushing = true;
  refreshSnapshot();
  try {
    while (items.length > 0) {
      const item = items[0];
      const sentVersion = item.version;

      let res: Response;
      try {
        res = await secureFetch(item.url, { method: item.method, body: JSON.stringify(item.body) });
      } catch {
        item.attempts += 1;
        persist();
        scheduleRetry(item.attempts);
        return;
      }

      const current = items.find((i) => i.key === item.key);
      if (res.ok) {
        // A newer value for the same task may have been queued while this one was in flight;
        // keep that one and send it next.
        if (current && current.version === sentVersion) {
          items = items.filter((i) => i.key !== item.key);
        }
        persist();
        emit({ ok: true, ...item.meta });
      } else if (res.status >= 500 || res.status === 408 || res.status === 429) {
        item.attempts += 1;
        persist();
        scheduleRetry(item.attempts);
        return;
      } else {
        // The server refused it (not allowed, gone, invalid): retrying can't help.
        items = items.filter((i) => i.key !== item.key);
        persist();
        emit({ ok: false, httpStatus: res.status, ...item.meta });
      }
      refreshSnapshot();
    }
  } finally {
    flushing = false;
    refreshSnapshot();
  }
}

/**
 * Record a status change to be sent in the background. Several quick changes to the same task
 * collapse into one request carrying the latest status.
 */
export function queueStatusChange(kind: StatusKind, id: string, status: TaskStatus): void {
  start();
  const change: QueuedChange = {
    key: `${kind}-status:${id}`,
    method: "PATCH",
    url: URLS[kind](id),
    body: { status },
    meta: { kind, id, status },
    version: ++versionCounter,
    attempts: 0,
  };
  const at = items.findIndex((i) => i.key === change.key);
  if (at >= 0) items[at] = change;
  else items.push(change);
  persist();
  refreshSnapshot();
  void flush();
}

/** The status the user set that the server has not confirmed yet, if any. */
export function pendingStatusOf(kind: StatusKind, id: string): TaskStatus | undefined {
  return items.find((i) => i.meta.kind === kind && i.meta.id === id)?.meta.status;
}

/** Layer unconfirmed status changes over freshly fetched data so a refresh can't undo them. */
export function applyPendingStatuses<T extends { id: string; status: string }>(kind: StatusKind, list: T[]): T[] {
  if (items.length === 0) return list;
  return list.map((entry) => {
    const pending = pendingStatusOf(kind, entry.id);
    return pending && pending !== entry.status ? { ...entry, status: pending } : entry;
  });
}

/** Be told when a queued change was accepted (ok) or rejected by the server. */
export function onSyncResult(listener: (r: SyncResult) => void): () => void {
  resultListeners.add(listener);
  return () => {
    resultListeners.delete(listener);
  };
}

function subscribe(listener: () => void) {
  start();
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

const getSnapshot = () => snapshot;

/** Live queue state for a status indicator. */
export function useSyncStatus(): SyncSnapshot {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

/** Test helper: forget everything in memory and storage. */
export function __resetSyncQueueForTests() {
  items = [];
  flushing = false;
  if (retryTimer) clearTimeout(retryTimer);
  retryTimer = null;
  resultListeners.clear();
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
  snapshot = { pending: 0, syncing: false, online: isOnline() };
}

/** Test helper: reload the queue from storage, like a page refresh would. */
export function __reloadSyncQueueFromStorageForTests() {
  items = load();
  snapshot = { pending: items.length, syncing: false, online: isOnline() };
}
