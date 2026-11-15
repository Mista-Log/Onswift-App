/**
 * Regression test for "Open it on an Agent card says Project not found, then the project appears".
 * A project missing from the loaded list is not proof it doesn't exist: the page asks the server
 * for it, shows a loading state meanwhile, and says "not found" only when the server says so.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import type { ReactNode } from "react";

const secureFetch = vi.fn();
const fetchProjects = vi.fn();
let projects: unknown[] = [];

vi.mock("@/api/apiClient", () => ({
  secureFetch: (...args: unknown[]) => secureFetch(...args),
  isNetworkError: () => false,
}));
vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ user: { id: "u1", role: "creator" } }),
}));
vi.mock("@/contexts/TeamContext", () => ({ useTeam: () => ({ teamMembers: [] }) }));
vi.mock("@/contexts/ProjectContext", () => ({
  useProjects: () => ({
    projects,
    fetchProjects,
    fetchProjectTasks: async () => [],
    addTask: vi.fn(),
    updateTask: vi.fn(),
    deleteTask: vi.fn(),
    deleteProject: vi.fn(),
    updateProject: vi.fn(),
  }),
  deriveStatus: () => "planning",
  onProjectsChanged: () => () => {},
}));
vi.mock("@/components/layout/MainLayout", () => ({
  MainLayout: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

import ProjectDetail from "./ProjectDetail";

const json = (status: number, body: unknown) => ({ ok: status < 400, status, json: async () => body });

/** Answers the single-project request with `project`; every other request gets an empty list. */
function serveProject(project: () => unknown) {
  secureFetch.mockImplementation(async (url: string) =>
    url === "/api/v2/projects/p1/" ? project() : json(200, []),
  );
}

const page = () =>
  render(
    <MemoryRouter initialEntries={["/projects/p1"]}>
      <Routes>
        <Route path="/projects/:id" element={<ProjectDetail />} />
      </Routes>
    </MemoryRouter>,
  );

beforeEach(() => {
  localStorage.clear();
  secureFetch.mockReset();
  fetchProjects.mockReset();
  projects = [];
});

describe("ProjectDetail when the project is not in the loaded list", () => {
  it("shows a loading state, not 'Project not found', while it asks the server", async () => {
    serveProject(() => new Promise(() => {}));
    page();
    expect(await screen.findByLabelText("Loading project")).toBeInTheDocument();
    expect(screen.queryByText("Project not found")).not.toBeInTheDocument();
    expect(secureFetch).toHaveBeenCalledWith("/api/v2/projects/p1/");
  });

  it("says 'Project not found' once the server says it does not exist", async () => {
    serveProject(() => json(404, {}));
    page();
    expect(await screen.findByText("Project not found")).toBeInTheDocument();
  });

  it("offers a retry when the request fails, and loads the project on the second try", async () => {
    let attempts = 0;
    serveProject(() => {
      attempts += 1;
      if (attempts === 1) throw new TypeError("Failed to fetch");
      return json(200, { id: "p1", creator: "u1", name: "Made by the Agent", task_count: 0, completed_tasks: 0 });
    });
    page();
    fireEvent.click(await screen.findByRole("button", { name: "Try again" }));
    expect(await screen.findByText("Made by the Agent")).toBeInTheDocument();
    expect(screen.queryByText("Project not found")).not.toBeInTheDocument();
  });

  it("opens the user's own project and brings the stale list up to date", async () => {
    serveProject(() =>
      json(200, { id: "p1", creator: "u1", name: "Made by the Agent", task_count: 0, completed_tasks: 0 }),
    );
    page();
    expect(await screen.findByText("Made by the Agent")).toBeInTheDocument();
    await waitFor(() => expect(fetchProjects).toHaveBeenCalledTimes(1));
  });
});
