/**
 * Regression test for "workspace is empty after signing in until I reload".
 * The provider used to fetch once at app start (on the landing page, with no
 * token) and never again. It must now load when a user appears and clear when
 * they leave.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { ProjectProvider, useProjects } from "./ProjectContext";

const secureFetch = vi.fn();
let mockUser: { id: string } | null = null;

vi.mock("../api/apiClient", () => ({
  secureFetch: (...args: unknown[]) => secureFetch(...args),
  isNetworkError: () => false,
}));
vi.mock("./AuthContext", () => ({ useAuth: () => ({ user: mockUser }) }));

function Probe() {
  const { projects, isLoading } = useProjects();
  return (
    <div>
      <span data-testid="count">{projects.length}</span>
      <span data-testid="loading">{String(isLoading)}</span>
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
});
