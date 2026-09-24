import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { CountdownCircle } from "./CountdownCircle";

const NOW = new Date("2026-09-24T12:00:00");
const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

function renderIn(offsetMs: number, taskName?: string) {
  return render(<CountdownCircle target={new Date(NOW.getTime() + offsetMs)} taskName={taskName} />);
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});

afterEach(() => {
  vi.useRealTimers();
});

describe("CountdownCircle", () => {
  it("is calm when the deadline is more than a day away", () => {
    renderIn(2 * DAY);
    const ring = screen.getByRole("timer");
    expect(ring.dataset.state).toBe("normal");
    expect(ring.className).not.toContain("border-destructive");
    expect(ring.className).not.toContain("countdown-blink");
    expect(screen.queryByText(/URGENT/)).toBeNull();
    expect(screen.getByText("Next Deadline")).toBeTruthy();
  });

  it("turns red with the urgent prompt under 24 hours, without blinking yet", () => {
    renderIn(5 * HOUR);
    const ring = screen.getByRole("timer");
    expect(ring.dataset.state).toBe("urgent");
    expect(ring.className).toContain("border-destructive");
    expect(ring.className).not.toContain("countdown-blink");
    expect(screen.getByText("URGENT: Due in less than 24 hours!")).toBeTruthy();
  });

  it("blinks under one hour", () => {
    renderIn(30 * MIN);
    const ring = screen.getByRole("timer");
    expect(ring.dataset.state).toBe("critical");
    expect(ring.className).toContain("countdown-blink");
    expect(screen.getByText("URGENT: Due in less than 24 hours!")).toBeTruthy();
  });

  it("stays out of blink mode at exactly one hour", () => {
    renderIn(HOUR);
    expect(screen.getByRole("timer").className).not.toContain("countdown-blink");
  });

  it("shows an overdue message and keeps blinking once the deadline passes", () => {
    renderIn(-5 * MIN);
    const ring = screen.getByRole("timer");
    expect(ring.dataset.state).toBe("overdue");
    expect(ring.className).toContain("countdown-blink");
    expect(screen.getByText(/Overdue!/)).toBeTruthy();
    expect(screen.queryByText(/URGENT/)).toBeNull();
  });

  it("zero-pads every unit and shows the task name when given", () => {
    renderIn(DAY + 2 * HOUR + 3 * MIN + 4_000, "Write launch copy");
    for (const value of ["01", "02", "03", "04"]) {
      expect(screen.getByText(value)).toBeTruthy();
    }
    expect(screen.getByText("Write launch copy")).toBeTruthy();
  });
});
