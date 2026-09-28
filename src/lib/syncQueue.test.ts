import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const secureFetch = vi.fn();
vi.mock("@/api/apiClient", () => ({ secureFetch: (...a: unknown[]) => secureFetch(...a) }));

import {
  queueStatusChange,
  pendingStatusOf,
  applyPendingStatuses,
  onSyncResult,
  flush,
  __resetSyncQueueForTests,
  __reloadSyncQueueFromStorageForTests,
  type SyncResult,
} from "./syncQueue";

const ok = () => ({ ok: true, status: 200 });
const status = (code: number) => ({ ok: false, status: code });

const setOnline = (online: boolean) =>
  Object.defineProperty(navigator, "onLine", { value: online, configurable: true });

const storedQueue = () => JSON.parse(localStorage.getItem("onswift_cache_sync_queue") || "[]");

beforeEach(() => {
  vi.useFakeTimers();
  secureFetch.mockReset();
  secureFetch.mockResolvedValue(ok());
  setOnline(true);
  __resetSyncQueueForTests();
});

afterEach(() => {
  vi.useRealTimers();
  delete (navigator as unknown as { onLine?: boolean }).onLine;
});

describe("syncQueue", () => {
  it("sends a status change in the background and clears it once accepted", async () => {
    const results: SyncResult[] = [];
    onSyncResult((r) => results.push(r));

    queueStatusChange("task", "t1", "in-progress");
    expect(pendingStatusOf("task", "t1")).toBe("in-progress"); // visible immediately

    await vi.advanceTimersByTimeAsync(0);
    expect(secureFetch).toHaveBeenCalledWith("/api/v2/tasks/t1/", {
      method: "PATCH",
      body: JSON.stringify({ status: "in-progress" }),
    });
    expect(pendingStatusOf("task", "t1")).toBeUndefined();
    expect(storedQueue()).toEqual([]);
    expect(results).toEqual([{ ok: true, kind: "task", id: "t1", status: "in-progress" }]);
  });

  it("uses the personal-tasks endpoint for personal tasks", async () => {
    queueStatusChange("personal", "p1", "completed");
    await vi.advanceTimersByTimeAsync(0);
    expect(secureFetch.mock.calls[0][0]).toBe("/api/v2/personal-tasks/p1/");
  });

  it("keeps changes on the device while offline and collapses repeats into the latest", () => {
    setOnline(false);
    queueStatusChange("task", "t1", "in-progress");
    queueStatusChange("task", "t1", "completed");
    queueStatusChange("task", "t1", "planning");

    expect(secureFetch).not.toHaveBeenCalled();
    expect(storedQueue()).toHaveLength(1);
    expect(pendingStatusOf("task", "t1")).toBe("planning");
  });

  it("survives a page reload and sends once the connection is back", async () => {
    setOnline(false);
    queueStatusChange("task", "t1", "completed");

    __reloadSyncQueueFromStorageForTests(); // like refreshing the page
    expect(pendingStatusOf("task", "t1")).toBe("completed");

    setOnline(true);
    window.dispatchEvent(new Event("online"));
    await vi.advanceTimersByTimeAsync(0);

    expect(secureFetch).toHaveBeenCalledTimes(1);
    expect(storedQueue()).toEqual([]);
  });

  it("retries after a network failure with backoff and keeps the change meanwhile", async () => {
    secureFetch.mockRejectedValueOnce(new Error("network down")).mockResolvedValue(ok());

    queueStatusChange("task", "t1", "in-progress");
    await vi.advanceTimersByTimeAsync(0);
    expect(secureFetch).toHaveBeenCalledTimes(1);
    expect(pendingStatusOf("task", "t1")).toBe("in-progress"); // still saved locally

    await vi.advanceTimersByTimeAsync(1000);
    expect(secureFetch).toHaveBeenCalledTimes(2);
    expect(pendingStatusOf("task", "t1")).toBeUndefined();
  });

  it("retries on server errors", async () => {
    secureFetch.mockResolvedValueOnce(status(503)).mockResolvedValue(ok());

    queueStatusChange("task", "t1", "completed");
    await vi.advanceTimersByTimeAsync(0);
    expect(pendingStatusOf("task", "t1")).toBe("completed");

    await vi.advanceTimersByTimeAsync(1000);
    expect(secureFetch).toHaveBeenCalledTimes(2);
    expect(pendingStatusOf("task", "t1")).toBeUndefined();
  });

  it("drops a change the server refuses and reports it, without retrying", async () => {
    secureFetch.mockResolvedValue(status(403));
    const results: SyncResult[] = [];
    onSyncResult((r) => results.push(r));

    queueStatusChange("task", "t1", "completed");
    await vi.advanceTimersByTimeAsync(0);
    await vi.advanceTimersByTimeAsync(60_000);

    expect(secureFetch).toHaveBeenCalledTimes(1);
    expect(pendingStatusOf("task", "t1")).toBeUndefined();
    expect(results).toEqual([{ ok: false, httpStatus: 403, kind: "task", id: "t1", status: "completed" }]);
  });

  it("sends a newer value queued while the first request was in flight", async () => {
    let releaseFirst!: (v: unknown) => void;
    secureFetch
      .mockImplementationOnce(() => new Promise((r) => { releaseFirst = r; }))
      .mockResolvedValue(ok());

    queueStatusChange("task", "t1", "in-progress");
    await vi.advanceTimersByTimeAsync(0); // first request now in flight
    queueStatusChange("task", "t1", "completed"); // user moves on before the reply

    releaseFirst(ok());
    await vi.advanceTimersByTimeAsync(0);

    expect(secureFetch).toHaveBeenCalledTimes(2);
    expect(secureFetch.mock.calls[1][1].body).toBe(JSON.stringify({ status: "completed" }));
    expect(pendingStatusOf("task", "t1")).toBeUndefined();
  });

  it("layers unconfirmed changes over fetched data so a refresh can't undo them", () => {
    setOnline(false);
    queueStatusChange("task", "t2", "completed");

    const fetched = [
      { id: "t1", status: "planning" },
      { id: "t2", status: "in-progress" },
    ];
    expect(applyPendingStatuses("task", fetched)).toEqual([
      { id: "t1", status: "planning" },
      { id: "t2", status: "completed" },
    ]);
  });

  it("does nothing on flush when the queue is empty", async () => {
    await flush();
    expect(secureFetch).not.toHaveBeenCalled();
  });
});
