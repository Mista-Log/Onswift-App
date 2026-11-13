import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const secureFetch = vi.fn();
vi.mock("@/api/apiClient", () => ({ secureFetch: (...a: unknown[]) => secureFetch(...a) }));

import { useConversationHistory } from "./useConversationHistory";

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
const row = (id: string) => ({ id, title: id, created_at: "2026-11-06T10:00:00Z", updated_at: "2026-11-06T10:00:00Z" });

beforeEach(() => secureFetch.mockReset());

describe("useConversationHistory", () => {
  it("starts empty and idle", () => {
    const { result } = renderHook(() => useConversationHistory());
    expect(result.current).toMatchObject({ items: [], loading: false, error: false });
    expect(secureFetch).not.toHaveBeenCalled();
  });

  it("loads the list and clears loading", async () => {
    secureFetch.mockResolvedValue(json(200, [row("a"), row("b")]));
    const { result } = renderHook(() => useConversationHistory());
    await act(() => result.current.refresh());
    expect(secureFetch).toHaveBeenCalledWith("/api/v9/conversations/");
    expect(result.current.items.map((c) => c.id)).toEqual(["a", "b"]);
    expect(result.current).toMatchObject({ loading: false, error: false });
  });

  it("reports an error, and keeps what it already had", async () => {
    secureFetch.mockResolvedValueOnce(json(200, [row("a")])).mockResolvedValueOnce(json(500, {}));
    const { result } = renderHook(() => useConversationHistory());
    await act(() => result.current.refresh());
    await act(() => result.current.refresh());
    expect(result.current).toMatchObject({ loading: false, error: true });
    expect(result.current.items.map((c) => c.id)).toEqual(["a"]);
  });

  it("reports an error when the network fails", async () => {
    secureFetch.mockRejectedValueOnce(new Error("offline"));
    const { result } = renderHook(() => useConversationHistory());
    await act(() => result.current.refresh());
    expect(result.current.error).toBe(true);
  });

  it("treats an unexpected response shape as an empty list, not a crash", async () => {
    secureFetch.mockResolvedValue(json(200, { detail: "surprise" }));
    const { result } = renderHook(() => useConversationHistory());
    await act(() => result.current.refresh());
    expect(result.current.items).toEqual([]);
    expect(result.current.error).toBe(false);
  });

  it("ignores an older refresh that finishes after a newer one", async () => {
    let releaseSlow!: (r: Response) => void;
    secureFetch
      .mockReturnValueOnce(new Promise<Response>((resolve) => { releaseSlow = resolve; }))
      .mockResolvedValueOnce(json(200, [row("fresh")]));
    const { result } = renderHook(() => useConversationHistory());
    let slow!: Promise<void>;
    act(() => {
      slow = result.current.refresh();
    });
    await act(() => result.current.refresh());
    await act(async () => {
      releaseSlow(json(200, [row("stale")]));
      await slow;
    });
    expect(result.current.items.map((c) => c.id)).toEqual(["fresh"]);
  });
});
