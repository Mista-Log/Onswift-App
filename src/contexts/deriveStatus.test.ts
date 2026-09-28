import { describe, it, expect } from "vitest";
import { deriveStatus, type Project } from "./ProjectContext";

const project = (counts: Partial<Project>): Project => ({
  id: "p1",
  name: "P",
  description: "",
  due_date: "",
  status: "in-progress",
  teamMembers: [],
  task_count: 0,
  completed_tasks: 0,
  ...counts,
});

describe("deriveStatus", () => {
  it("is planning with no tasks", () => {
    expect(deriveStatus(project({ task_count: 0 }))).toBe("planning");
  });

  it("is planning for a fresh duplicate: tasks exist but none has started", () => {
    expect(
      deriveStatus(project({ task_count: 5, completed_tasks: 0, in_progress_tasks: 0 }))
    ).toBe("planning");
  });

  it("is in progress once any task is in progress", () => {
    expect(
      deriveStatus(project({ task_count: 5, completed_tasks: 0, in_progress_tasks: 1 }))
    ).toBe("in-progress");
  });

  it("is in progress when some tasks are completed", () => {
    expect(
      deriveStatus(project({ task_count: 5, completed_tasks: 2, in_progress_tasks: 0 }))
    ).toBe("in-progress");
  });

  it("is completed when every task is completed", () => {
    expect(
      deriveStatus(project({ task_count: 3, completed_tasks: 3, in_progress_tasks: 0 }))
    ).toBe("completed");
  });

  it("falls back to in progress when the API doesn't report in_progress_tasks (older cached data)", () => {
    expect(deriveStatus(project({ task_count: 5, completed_tasks: 0 }))).toBe("in-progress");
  });
});
