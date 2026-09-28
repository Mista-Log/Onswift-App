import { describe, it, expect, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { useSwipeStatus, type SwipeStatus } from "./use-swipe-status";
import { stageAction } from "@/lib/taskStages";

vi.mock("@/lib/feedback", () => ({ swipe: vi.fn() }));

function Card({
  status,
  onChange,
  role,
  onGate,
}: {
  status: SwipeStatus;
  onChange: (s: SwipeStatus) => void;
  role?: string;
  onGate?: (s: SwipeStatus) => void;
}) {
  const swipe = useSwipeStatus({
    status,
    onChange,
    onGate,
    actionFor: role ? (next) => stageAction(role, status, next) : undefined,
  });
  return <div data-testid="card" {...swipe.handlers} style={swipe.style} />;
}

const drag = (el: HTMLElement, dx: number, dy = 0) => {
  fireEvent.pointerDown(el, { clientX: 100, clientY: 100, pointerId: 1, pointerType: "touch" });
  fireEvent.pointerMove(el, { clientX: 100 + dx, clientY: 100 + dy, pointerId: 1, pointerType: "touch" });
  fireEvent.pointerUp(el, { clientX: 100 + dx, clientY: 100 + dy, pointerId: 1, pointerType: "touch" });
};

describe("useSwipeStatus", () => {
  it("moves to the next stage on a left swipe past the threshold", () => {
    const onChange = vi.fn();
    render(<Card status="planning" onChange={onChange} />);
    drag(screen.getByTestId("card"), -90);
    expect(onChange).toHaveBeenCalledWith("in-progress");
  });

  it("moves to the previous stage on a right swipe", () => {
    const onChange = vi.fn();
    render(<Card status="completed" onChange={onChange} />);
    drag(screen.getByTestId("card"), 90);
    expect(onChange).toHaveBeenCalledWith("in-progress");
  });

  it("ignores short drags and vertical scrolling", () => {
    const onChange = vi.fn();
    render(<Card status="planning" onChange={onChange} />);
    drag(screen.getByTestId("card"), 30);
    drag(screen.getByTestId("card"), 20, 120);
    expect(onChange).not.toHaveBeenCalled();
  });

  it("does nothing past the first or last stage", () => {
    const onChange = vi.fn();
    render(<Card status="completed" onChange={onChange} />);
    drag(screen.getByTestId("card"), -90); // nothing after completed
    expect(onChange).not.toHaveBeenCalled();
  });

  it("does not start a swipe from a press on a control inside the card", () => {
    const onChange = vi.fn();
    function WithButton() {
      const swipe = useSwipeStatus({ status: "planning", onChange });
      return (
        <div data-testid="card" {...swipe.handlers} style={swipe.style}>
          <button data-testid="menu">stage</button>
        </div>
      );
    }
    render(<WithButton />);
    drag(screen.getByTestId("menu"), -90);
    expect(onChange).not.toHaveBeenCalled();
    drag(screen.getByTestId("card"), -90); // the same drag on the card body still works
    expect(onChange).toHaveBeenCalledWith("in-progress");
  });

  it("lets a talent swipe between planning and in-progress", () => {
    const onChange = vi.fn();
    const onGate = vi.fn();
    render(<Card status="planning" role="talent" onChange={onChange} onGate={onGate} />);
    drag(screen.getByTestId("card"), -90);
    expect(onChange).toHaveBeenCalledWith("in-progress");
    expect(onGate).not.toHaveBeenCalled();
  });

  it("sends a talent's swipe to completed through the gate instead of changing it", () => {
    const onChange = vi.fn();
    const onGate = vi.fn();
    render(<Card status="in-progress" role="talent" onChange={onChange} onGate={onGate} />);
    drag(screen.getByTestId("card"), -90);
    expect(onGate).toHaveBeenCalledWith("completed");
    expect(onChange).not.toHaveBeenCalled();
  });

  it("ignores swipes on a completed task for a talent, but not for a creator", () => {
    const talentChange = vi.fn();
    const { unmount } = render(<Card status="completed" role="talent" onChange={talentChange} />);
    drag(screen.getByTestId("card"), 90);
    expect(talentChange).not.toHaveBeenCalled();
    unmount();

    const creatorChange = vi.fn();
    render(<Card status="completed" role="creator" onChange={creatorChange} />);
    drag(screen.getByTestId("card"), 90);
    expect(creatorChange).toHaveBeenCalledWith("in-progress");
  });
});
