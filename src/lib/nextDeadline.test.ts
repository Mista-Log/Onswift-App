import { describe, it, expect } from "vitest";
import { deadlineInstant, pickNextDeadline } from "./nextDeadline";

const row = (name: string, deadline: string, extra: Partial<{ task_time: string | null; status: string }> = {}) => ({
  name,
  deadline,
  status: "planning",
  ...extra,
});

describe("deadlineInstant", () => {
  it("uses the task time when there is one", () => {
    const at = deadlineInstant({ deadline: "2026-10-01", task_time: "14:30:00" });
    expect([at.getFullYear(), at.getMonth(), at.getDate(), at.getHours(), at.getMinutes()]).toEqual([2026, 9, 1, 14, 30]);
  });

  it("falls back to the end of the day", () => {
    const at = deadlineInstant({ deadline: "2026-10-01", task_time: null });
    expect([at.getDate(), at.getHours(), at.getMinutes(), at.getSeconds()]).toEqual([1, 23, 59, 59]);
  });
});

describe("pickNextDeadline", () => {
  it("picks the earliest open task, respecting time of day on the same date", () => {
    const next = pickNextDeadline([
      row("evening", "2026-10-01", { task_time: "18:00:00" }),
      row("morning", "2026-10-01", { task_time: "09:00:00" }),
      row("no time", "2026-10-01"),
    ]);
    expect(next?.row.name).toBe("morning");
  });

  it("ignores completed tasks", () => {
    const next = pickNextDeadline([row("done", "2026-09-01", { status: "completed" }), row("open", "2026-10-05")]);
    expect(next?.row.name).toBe("open");
  });

  it("keeps an overdue open task, so the clock shows that it slipped", () => {
    const next = pickNextDeadline([row("late", "2020-01-01"), row("future", "2999-01-01")]);
    expect(next?.row.name).toBe("late");
  });

  it("returns nothing when there is nothing open", () => {
    expect(pickNextDeadline([])).toBeUndefined();
    expect(pickNextDeadline([row("done", "2026-10-01", { status: "completed" })])).toBeUndefined();
  });
});
