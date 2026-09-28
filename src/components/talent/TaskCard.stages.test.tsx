import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { TaskCard } from "./TaskCard";
import { stageAction, type Stage } from "@/lib/taskStages";

vi.mock("@/lib/feedback", () => ({ swipe: vi.fn(), success: vi.fn() }));

const HINT = "Swipe left or right to change stage";

function card(role: string, status: Stage, awaiting = false) {
  return render(
    <TaskCard
      id="t1"
      name="Design"
      projectName="Alpha"
      status={status}
      awaitingApproval={awaiting}
      onStatusChange={vi.fn()}
      stageRule={(to) => stageAction(role, status, to, awaiting)}
    />
  );
}

describe("TaskCard swipe hint follows the role's rule", () => {
  it("shows the hint to a talent for a task they can start", () => {
    card("talent", "planning");
    expect(screen.getByTitle(HINT)).toBeInTheDocument();
  });

  it("shows the hint to a talent for an in-progress task (can pause, or go to the gate)", () => {
    card("talent", "in-progress");
    expect(screen.getByTitle(HINT)).toBeInTheDocument();
  });

  it("hides the hint for a talent's completed task", () => {
    card("talent", "completed");
    expect(screen.queryByTitle(HINT)).not.toBeInTheDocument();
  });

  it("hides the hint for a talent's task awaiting approval", () => {
    card("talent", "in-progress", true);
    expect(screen.queryByTitle(HINT)).not.toBeInTheDocument();
    expect(screen.getByText("Pending approval")).toBeInTheDocument();
  });

  it("opens the stage menu from a chevron button, not a status circle", () => {
    card("creator", "planning");
    expect(screen.getByRole("button", { name: "Change stage (now Planning)" })).toBeInTheDocument();
  });

  it("gives a locked card no stage menu", () => {
    card("talent", "completed");
    expect(screen.queryByRole("button", { name: /Change stage/ })).not.toBeInTheDocument();
  });

  it("still shows the hint to a creator on a completed task", () => {
    card("creator", "completed");
    expect(screen.getByTitle(HINT)).toBeInTheDocument();
  });
});
