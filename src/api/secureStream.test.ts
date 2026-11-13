import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { secureStream } from "./apiClient";

const res = (status: number, body: unknown = {}) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem("onswift_access", "old-token");
  localStorage.setItem("onswift_refresh", "refresh-token");
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

const authOf = (call: unknown[]) => new Headers((call[1] as RequestInit).headers).get("Authorization");

describe("secureStream", () => {
  it("sends the bearer token and JSON content type", async () => {
    fetchMock.mockResolvedValueOnce(res(200));
    await secureStream("/api/v9/conversations/", { method: "POST", body: "{}" });
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toMatch(/\/api\/v9\/conversations\/$/);
    expect(authOf(fetchMock.mock.calls[0])).toBe("Bearer old-token");
    expect(new Headers((init as RequestInit).headers).get("Content-Type")).toBe("application/json");
  });

  it("refreshes the token on 401 and replays the request once with the new token", async () => {
    fetchMock
      .mockResolvedValueOnce(res(401))
      .mockResolvedValueOnce(res(200, { access: "new-token" })) // refresh
      .mockResolvedValueOnce(res(200));
    const out = await secureStream("/api/v9/x/", { method: "POST" });
    expect(out.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(authOf(fetchMock.mock.calls[2])).toBe("Bearer new-token");
    expect(localStorage.getItem("onswift_access")).toBe("new-token");
  });

  it("returns the 401 and clears the session when the refresh is rejected", async () => {
    fetchMock.mockResolvedValueOnce(res(401)).mockResolvedValueOnce(res(401));
    const out = await secureStream("/api/v9/x/", { method: "POST" });
    expect(out.status).toBe(401);
    expect(fetchMock).toHaveBeenCalledTimes(2); // no second replay
    expect(localStorage.getItem("onswift_access")).toBeNull();
  });

  it("returns the 401 and clears the session when there is no refresh token", async () => {
    localStorage.removeItem("onswift_refresh");
    fetchMock.mockResolvedValueOnce(res(401));
    const out = await secureStream("/api/v9/x/", { method: "POST" });
    expect(out.status).toBe(401);
    expect(localStorage.getItem("onswift_access")).toBeNull();
  });

  it("does not retry a non-401 error (a 429 must reach the caller)", async () => {
    fetchMock.mockResolvedValueOnce(res(429, { code: "stream_in_progress" }));
    const out = await secureStream("/api/v9/x/", { method: "POST" });
    expect(out.status).toBe(429);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("does not retry on a network failure", async () => {
    fetchMock.mockRejectedValueOnce(new TypeError("network down"));
    await expect(secureStream("/api/v9/x/", { method: "POST" })).rejects.toThrow("network down");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("throws without calling the network when signed out", async () => {
    localStorage.removeItem("onswift_access");
    await expect(secureStream("/api/v9/x/")).rejects.toThrow("No access token");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("passes the caller's abort signal through untouched, with no timeout wrapper", async () => {
    const controller = new AbortController();
    fetchMock.mockResolvedValueOnce(res(200));
    await secureStream("/api/v9/x/", { method: "POST", signal: controller.signal });
    expect((fetchMock.mock.calls[0][1] as RequestInit).signal).toBe(controller.signal);
  });
});
