import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import Projects from "./Projects";

const auth = { user: { id: "talent-1", role: "talent", full_name: "Tala Nt" } as { id: string; role: string; full_name: string } };
const ctx = {
  projects: [] as Array<Record<string, unknown>>,
  addProject: vi.fn(),
  deleteProject: vi.fn(),
  updateProject: vi.fn(),
  duplicateProject: vi.fn(),
};
const secureFetch = vi.fn();

vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => auth }));
vi.mock("@/contexts/ProjectContext", () => ({
  useProjects: () => ctx,
  deriveStatus: (p: { status: string }) => p.status,
}));
vi.mock("@/api/apiClient", () => ({
  secureFetch: (...a: unknown[]) => secureFetch(...a),
  isNetworkError: () => false,
}));
vi.mock("@/components/layout/MainLayout", () => ({ MainLayout: ({ children }: { children: React.ReactNode }) => <div>{children}</div> }));

const project = (over: Record<string, unknown> = {}) => ({
  id: "p1", name: "My side gig", description: "", due_date: "2030-01-01", status: "planning",
  task_count: 2, completed_tasks: 1, creator: "talent-1", shared_with_creators: false, ...over,
});

const page = () => render(<MemoryRouter><Projects /></MemoryRouter>);

beforeEach(() => {
  ctx.projects = [];
  ctx.updateProject.mockReset().mockResolvedValue(undefined);
  secureFetch.mockReset().mockResolvedValue(new Response("[]", { status: 200 }));
  auth.user = { id: "talent-1", role: "talent", full_name: "Tala Nt" };
});

describe("a talent with no projects", () => {
  it("is told they can start their own, and can", async () => {
    page();
    expect(screen.getByText("Start your own project")).toBeInTheDocument();
    expect(screen.getByText(/private until you choose to share/i)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /Create My First Project/ }));
    expect(screen.getByText("Create New Project")).toBeInTheDocument();
  });

  it("has a New Project button in the header", () => {
    page();
    expect(screen.getAllByRole("button", { name: /New Project/ }).length).toBeGreaterThan(0);
  });
});

describe("a talent's project board", () => {
  it("cards stay clean: no sharing switch or label on the board (it lives inside the project)", () => {
    ctx.projects = [project(), project({ id: "p2", name: "Brand film", creator: "creator-9" })];
    page();
    expect(screen.getByText("My side gig")).toBeInTheDocument();
    expect(screen.getByText("Brand film")).toBeInTheDocument();
    expect(screen.queryByRole("switch")).toBeNull();
    expect(screen.queryByText(/share with my creators/i)).toBeNull();
  });

  it("never asks the server for projects shared with a creator", () => {
    ctx.projects = [project()];
    page();
    expect(secureFetch).not.toHaveBeenCalled();
  });
});

describe("a creator", () => {
  beforeEach(() => {
    auth.user = { id: "creator-1", role: "creator", full_name: "Cree Ator" };
  });

  it("sees what their team shared, labelled and view only", async () => {
    ctx.projects = [project({ id: "mine", name: "Own work", creator: "creator-1" })];
    secureFetch.mockResolvedValue(new Response(JSON.stringify([
      project({ id: "s1", name: "Tala's pitch", owner_name: "Tala Nt", shared_with_creators: true }),
    ]), { status: 200 }));
    page();
    expect(await screen.findByText("Shared by your team")).toBeInTheDocument();
    expect(screen.getByText("Tala's pitch")).toBeInTheDocument();
    expect(screen.getByText("By Tala Nt")).toBeInTheDocument();
    expect(secureFetch).toHaveBeenCalledWith("/api/v2/projects/shared/");
  });

  it("has no sharing switch, and no shared section when nothing is shared", async () => {
    ctx.projects = [project({ id: "mine", name: "Own work", creator: "creator-1" })];
    page();
    await waitFor(() => expect(secureFetch).toHaveBeenCalled());
    expect(screen.queryByText("Shared by your team")).toBeNull();
    expect(screen.queryByRole("switch")).toBeNull();
  });

  it("is not broken by a failed shared-projects request", async () => {
    ctx.projects = [project({ id: "mine", name: "Own work", creator: "creator-1" })];
    secureFetch.mockRejectedValue(new TypeError("offline"));
    page();
    expect(screen.getByText("Own work")).toBeInTheDocument();
    expect(screen.queryByText("Shared by your team")).toBeNull();
  });
});
