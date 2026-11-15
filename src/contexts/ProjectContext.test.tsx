/**
 * Regression test for "workspace is empty after signing in until I reload".
 * The provider used to fetch once at app start (on the landing page, with no
 * token) and never again. It must now load when a user appears and clear when
 * they leave.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { act, render, screen, waitFor } from "@testing-library/react";
import { ProjectProvider, announceProjectsChanged, useProjects } from "./ProjectContext";

const secureFetch = vi.fn();
let mockUser: { id: string } | null = null;

vi.mock("../api/apiClient", () => ({
  secureFetch: (...args: unknown[]) => secureFetch(...args),
  isNetworkError: () => false,
}));
vi.mock("./AuthContext", () => ({ useAuth: () => ({ user: mockUser }) }));

function Probe() {
  const { projects, isLoading, loadFailed } = useProjects();
  return (
    <div>
      <span data-testid="count">{projects.length}</span>
      <span data-testid="loading">{String(isLoading)}</span>
      <span data-testid="failed">{String(loadFailed)}</span>
    </div>
  );
}

// A new element each call: rerendering the identical element would be skipped by React.
const tree = () => (
  <ProjectProvider>
    <Probe />
  </ProjectProvider>
);

beforeEach(() => {
  localStorage.clear();
  secureFetch.mockReset();
  secureFetch.mockResolvedValue({
    ok: true,
    json: async () => [{ id: "p1", name: "Alpha", task_count: 0, completed_tasks: 0 }],
  });
  mockUser = null;
});

describe("ProjectProvider loading", () => {
  it("does not request anything while logged out", async () => {
    render(tree());
    await new Promise((r) => setTimeout(r, 20));
    expect(secureFetch).not.toHaveBeenCalled();
    expect(screen.getByTestId("count").textContent).toBe("0");
  });

  it("loads once when a user signs in without a reload", async () => {
    const { rerender } = render(tree());
    expect(secureFetch).not.toHaveBeenCalled();

    mockUser = { id: "u1" };
    rerender(tree());

    await waitFor(() => expect(screen.getByTestId("count").textContent).toBe("1"));
    expect(secureFetch).toHaveBeenCalledTimes(1);
    expect(secureFetch).toHaveBeenCalledWith("/api/v2/projects/");
    await waitFor(() => expect(screen.getByTestId("loading").textContent).toBe("false"));
  });

  it("shows a loading state while the first request is in flight", async () => {
    let resolve!: (v: unknown) => void;
    secureFetch.mockReturnValue(new Promise((r) => { resolve = r; }));

    const { rerender } = render(tree());
    mockUser = { id: "u1" };
    rerender(tree());

    await waitFor(() => expect(screen.getByTestId("loading").textContent).toBe("true"));
    resolve({ ok: true, json: async () => [] });
    await waitFor(() => expect(screen.getByTestId("loading").textContent).toBe("false"));
  });

  it("clears projects when the user signs out", async () => {
    mockUser = { id: "u1" };
    const { rerender } = render(tree());
    await waitFor(() => expect(screen.getByTestId("count").textContent).toBe("1"));

    mockUser = null;
    rerender(tree());
    await waitFor(() => expect(screen.getByTestId("count").textContent).toBe("0"));
  });

  it("reloads the list when something outside it (the Agent) changed projects", async () => {
    mockUser = { id: "u1" };
    render(tree());
    await waitFor(() => expect(screen.getByTestId("count").textContent).toBe("1"));

    secureFetch.mockResolvedValue({
      ok: true,
      json: async () => [
        { id: "p1", name: "Alpha", task_count: 0, completed_tasks: 0 },
        { id: "p2", name: "Made by the Agent", task_count: 0, completed_tasks: 0 },
      ],
    });
    announceProjectsChanged();

    await waitFor(() => expect(screen.getByTestId("count").textContent).toBe("2"));
  });

  it("flags a failed load, keeps what was on screen, and retries by itself", async () => {
    mockUser = { id: "u1" };
    render(tree());
    await waitFor(() => expect(screen.getByTestId("count").textContent).toBe("1"));

    vi.useFakeTimers();
    try {
      secureFetch.mockResolvedValueOnce({ ok: false, status: 503, json: async () => ({}) });
      await act(async () => {
        announceProjectsChanged();
        await vi.advanceTimersByTimeAsync(0);
      });
      expect(screen.getByTestId("failed").textContent).toBe("true");
      expect(screen.getByTestId("count").textContent).toBe("1");
      const callsAfterFailure = secureFetch.mock.calls.length;

      await act(async () => {
        await vi.advanceTimersByTimeAsync(2_000);
      });
      expect(secureFetch.mock.calls.length).toBe(callsAfterFailure + 1);
      expect(screen.getByTestId("failed").textContent).toBe("false");
    } finally {
      vi.useRealTimers();
    }
  });

  it("does not keep retrying when the server refuses the request", async () => {
    mockUser = { id: "u1" };
    secureFetch.mockResolvedValue({ ok: false, status: 403, json: async () => ({}) });
    vi.useFakeTimers();
    try {
      render(tree());
      await act(async () => {
        await vi.advanceTimersByTimeAsync(60_000);
      });
      expect(secureFetch).toHaveBeenCalledTimes(1);
      expect(screen.getByTestId("failed").textContent).toBe("true");
    } finally {
      vi.useRealTimers();
    }
  });

  it("gives up retrying by itself after five tries", async () => {
    mockUser = { id: "u1" };
    secureFetch.mockRejectedValue(new TypeError("Failed to fetch"));
    vi.useFakeTimers();
    try {
      render(tree());
      await act(async () => {
        await vi.advanceTimersByTimeAsync(10 * 60_000);
      });
      expect(secureFetch).toHaveBeenCalledTimes(6);
    } finally {
      vi.useRealTimers();
    }
  });

  it("retries a failed load as soon as the tab is looked at again", async () => {
    mockUser = { id: "u1" };
    secureFetch.mockResolvedValueOnce({ ok: false, status: 403, json: async () => ({}) });
    render(tree());
    await waitFor(() => expect(screen.getByTestId("failed").textContent).toBe("true"));

    act(() => {
      document.dispatchEvent(new Event("visibilitychange"));
    });

    await waitFor(() => expect(screen.getByTestId("failed").textContent).toBe("false"));
    expect(screen.getByTestId("count").textContent).toBe("1");
  });

  it("does not reload on tab focus when the list was loaded moments ago", async () => {
    mockUser = { id: "u1" };
    render(tree());
    await waitFor(() => expect(screen.getByTestId("count").textContent).toBe("1"));

    document.dispatchEvent(new Event("visibilitychange"));
    await new Promise((r) => setTimeout(r, 20));
    expect(secureFetch).toHaveBeenCalledTimes(1);
  });

  it("ignores that announcement while logged out", async () => {
    render(tree());
    announceProjectsChanged();
    await new Promise((r) => setTimeout(r, 20));
    expect(secureFetch).not.toHaveBeenCalled();
  });
});
