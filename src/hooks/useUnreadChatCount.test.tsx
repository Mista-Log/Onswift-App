import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import type { ReactNode } from "react";

const secureFetch = vi.fn();
vi.mock("@/api/apiClient", () => ({ secureFetch: (...a: unknown[]) => secureFetch(...a) }));
const chime = vi.fn();
vi.mock("@/lib/feedback", () => ({ message: () => chime() }));

import { useUnreadChatCount } from "./useUnreadChatCount";

const json = (data: unknown) => ({ ok: true, json: async () => data });
let unread = 0;

const wrapper =
  (path: string) =>
  ({ children }: { children: ReactNode }) =>
    <MemoryRouter initialEntries={[path]}>{children}</MemoryRouter>;

beforeEach(() => {
  vi.useFakeTimers();
  localStorage.clear();
  chime.mockReset();
  unread = 0;
  secureFetch.mockImplementation(async (url: string) =>
    url.includes("conversations") ? json([{ unread_count: unread }]) : json([])
  );
});

afterEach(() => vi.useRealTimers());

const poll = () => act(async () => { await vi.advanceTimersByTimeAsync(30_000); });

describe("useUnreadChatCount chime", () => {
  it("stays silent on the first load, then chimes when the unread total rises", async () => {
    unread = 2; // already waiting when the app opens
    const { result } = renderHook(() => useUnreadChatCount(), { wrapper: wrapper("/dashboard") });
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    expect(result.current).toBe(2);
    expect(chime).not.toHaveBeenCalled();

    unread = 3;
    await poll();
    expect(chime).toHaveBeenCalledTimes(1);

    await poll(); // nothing new
    expect(chime).toHaveBeenCalledTimes(1);

    unread = 1; // reading messages lowers the count: no chime
    await poll();
    expect(chime).toHaveBeenCalledTimes(1);
  });

  it("does not chime while the Messages page is focused", async () => {
    vi.spyOn(document, "hasFocus").mockReturnValue(true);
    renderHook(() => useUnreadChatCount(), { wrapper: wrapper("/messages") });
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    unread = 4;
    await poll();
    expect(chime).not.toHaveBeenCalled();
  });
});
