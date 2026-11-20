import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AnalyticsSection } from "./AnalyticsSection";

const analytics = vi.hoisted(() => ({ current: {} as Record<string, unknown> }));
const projects = vi.hoisted(() => ({ current: {} as Record<string, unknown> }));

vi.mock("@/hooks/useCreatorAnalytics", () => ({ useCreatorAnalytics: () => analytics.current }));
vi.mock("@/contexts/ProjectContext", () => ({ useProjects: () => projects.current }));
// Recharts needs real layout to draw; the section's own logic is what's under test here.
vi.mock("./ThroughputChart", () => ({ ThroughputChart: () => <div data-testid="throughput-chart" /> }));

const DATA = {
  range: "30d",
  completion: [
    { month: "2026-11-01", label: "Nov 1", approved: 3 },
    { month: "2026-11-02", label: "Nov 2", approved: 2 },
  ],
  clients: [
    { month: "2026-11-01", label: "Nov 1", new_clients: 1 },
    { month: "2026-11-02", label: "Nov 2", new_clients: 1 },
  ],
  talent: [
    { user_id: "a", name: "Ada Lane", approved: 4, submitted: 5, approval_rate: 80, tasks_completed: 6, pending: 1 },
    { user_id: "b", name: "Ben Cole", approved: 1, submitted: 3, approval_rate: 33, tasks_completed: 2, pending: 2 },
  ],
};

const setRange = vi.fn();
const refetch = vi.fn();
const base = { data: DATA, isLoading: false, error: null, refetch, range: "30d", setRange };

beforeEach(() => {
  setRange.mockReset();
  refetch.mockReset();
  analytics.current = { ...base };
  projects.current = {
    isLoading: false,
    projects: [
      { id: "1", status: "in-progress" },
      { id: "2", status: "in-progress" },
      { id: "3", status: "planning" },
      { id: "4", status: "completed" },
    ],
  };
});

describe("AnalyticsSection", () => {
  it("totals the stat cards from the API data and the project list", () => {
    render(<AnalyticsSection />);
    // Stat cards come first in the DOM; "New clients" also appears later in the chart legend.
    const card = (label: string) => screen.getAllByText(label)[0].nextElementSibling;
    expect(card("Approved deliverables")).toHaveTextContent("5");
    expect(card("New clients")).toHaveTextContent("2");
    expect(card("Approval rate")).toHaveTextContent("63%"); // 5 approved of 8 submitted
    expect(card("Active projects")).toHaveTextContent("3");
    expect(screen.getByTestId("throughput-chart")).toBeInTheDocument();
  });

  it("shows project status counts and the team, busiest first", () => {
    render(<AnalyticsSection />);
    expect(screen.getByRole("img", { name: "Status: Planning" })).toBeInTheDocument();
    const names = screen.getAllByText(/^(Ada Lane|Ben Cole)$/).map((n) => n.textContent);
    expect(names).toEqual(["Ada Lane", "Ben Cole"]);
    expect(screen.getByText("80% approval")).toBeInTheDocument();
  });

  it("shows the current range on the dropdown button and switches range from its menu", async () => {
    render(<AnalyticsSection />);
    const trigger = screen.getByRole("button", { name: /Last 30 days/ });
    // Radix opens its menu on pointerdown/keyboard, not click.
    fireEvent.keyDown(trigger, { key: "Enter" });
    fireEvent.click(await screen.findByRole("menuitem", { name: "Last 12 months" }));
    expect(setRange).toHaveBeenCalledWith("12m");
  });

  it("puts the project total in the middle of the status donut", () => {
    render(<AnalyticsSection />);
    expect(screen.getByText("projects").previousElementSibling).toHaveTextContent("4");
  });

  it("shows placeholders while the first load is in flight", () => {
    analytics.current = { ...base, data: null, isLoading: true };
    render(<AnalyticsSection />);
    expect(screen.getByText("Approved deliverables").nextElementSibling).toHaveTextContent("—");
    expect(screen.queryByTestId("throughput-chart")).not.toBeInTheDocument();
  });

  it("offers a retry when loading fails", () => {
    analytics.current = { ...base, data: null, error: "Couldn't load analytics (error 500)." };
    render(<AnalyticsSection />);
    expect(screen.getByText("Data unavailable.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(refetch).toHaveBeenCalled();
  });

  it("handles a brand-new account with no team or projects", () => {
    analytics.current = { ...base, data: { ...DATA, talent: [], completion: [], clients: [] } };
    projects.current = { isLoading: false, projects: [] };
    render(<AnalyticsSection />);
    expect(screen.getByText("No team activity yet")).toBeInTheDocument();
    expect(screen.getByText("No projects yet")).toBeInTheDocument();
    expect(screen.getByText("Approval rate").nextElementSibling).toHaveTextContent("—");
  });
});
