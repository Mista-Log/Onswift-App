/**
 * Isolated reproduction for the "deadline isn't accurate" report.
 *
 * TaskCard.tsx drives the deadline label shown on the Creator's own "My Tasks"
 * panel (via MyTasksPanel) as well as talent's task lists. Its private
 * formatDeadline() parses the bare `YYYY-MM-DD` deadline string with
 * `new Date(date)`, which JS treats as UTC midnight rather than local
 * midnight. These tests pin down the two ways that goes wrong, purely by
 * rendering the component and reading what a user would see — no fix applied.
 *
 * Both tests fix the JS timezone to America/New_York (UTC-4 in September) so
 * they reproduce deterministically regardless of the machine/CI running them.
 */
process.env.TZ = "America/New_York";

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { TaskCard } from "./TaskCard";

function renderCard(deadline: string) {
  return render(
    <TaskCard
      id="t1"
      name="Write launch copy"
      deadline={deadline}
      projectName="Website Relaunch"
      status="planning"
    />
  );
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("TaskCard deadline label (formatDeadline)", () => {
  it("shows the deadline's actual calendar date, not one day early", () => {
    // "Now" is Sep 1, well before the deadline, so this only exercises the
    // `Due: <date>` (>7 days out) branch and its toLocaleDateString() call.
    vi.setSystemTime(new Date(2026, 8, 1, 12, 0, 0)); // Sep 1 2026, 12:00 local

    renderCard("2026-09-20");

    // The deadline was set to Sep 20. new Date("2026-09-20") parses as UTC
    // midnight, which is Sep 19 8pm in America/New_York — so
    // toLocaleDateString() renders "9/19/2026" instead of the correct
    // "9/20/2026". This assertion documents the CORRECT behavior and is
    // expected to fail against the current implementation.
    expect(screen.getByText("Due: 9/20/2026")).toBeInTheDocument();
  });

  it("does not mark a task 'Overdue' while it is still due today", () => {
    // Deadline is TODAY (Sep 10), and it's late evening but still Sep 10
    // local time — the task should not be overdue yet.
    vi.setSystemTime(new Date(2026, 8, 10, 23, 0, 0)); // Sep 10 2026, 23:00 local

    renderCard("2026-09-10");

    // Because the deadline is parsed as UTC midnight (= Sep 9, 8pm local),
    // it is already "in the past" relative to 11pm local on Sep 10, so the
    // component renders "Overdue" here instead of "Due Today".
    expect(screen.getByText("Due Today")).toBeInTheDocument();
    expect(screen.queryByText("Overdue")).not.toBeInTheDocument();
  });
});
