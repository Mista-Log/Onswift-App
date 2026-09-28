import { useRef, useState } from "react";
import type { CSSProperties, PointerEvent as ReactPointerEvent } from "react";
import { swipe as feedbackSwipe } from "@/lib/feedback";

export type SwipeStatus = "planning" | "in-progress" | "completed";

const STAGES: SwipeStatus[] = ["planning", "in-progress", "completed"];
const LOCK_DISTANCE = 8;
const MAX_PULL = 96;

interface Options {
  status: SwipeStatus;
  onChange: (next: SwipeStatus) => void;
  /** Called instead of onChange when a swipe is attempted but not allowed. */
  onBlocked?: () => void;
  /** What a swipe to `next` does for this user (see lib/taskStages); omitted = always apply. */
  actionFor?: (next: SwipeStatus) => "apply" | "gate" | "locked";
  /** Called instead of onChange when actionFor says the move needs the completion gate. */
  onGate?: (next: SwipeStatus) => void;
  disabled?: boolean;
  threshold?: number;
}

/**
 * Horizontal swipe to move a task one stage: left = next stage, right = previous (same as the board).
 * Vertical movement is left to the browser so lists still scroll.
 */
export function useSwipeStatus({ status, onChange, onBlocked, actionFor, onGate, disabled, threshold = 64 }: Options) {
  const [offset, setOffset] = useState(0);
  const [dragging, setDragging] = useState(false);
  const start = useRef<{ x: number; y: number } | null>(null);
  const lock = useRef<"none" | "horizontal" | "vertical">("none");
  const crossed = useRef(false);
  const moved = useRef(false);

  const reset = () => {
    start.current = null;
    lock.current = "none";
    crossed.current = false;
    setDragging(false);
    setOffset(0);
  };

  const onPointerDown = (e: ReactPointerEvent) => {
    if (disabled) return;
    if (e.pointerType === "mouse" && e.button !== 0) return;
    // A press on a control (the stage menu, a link) is a tap on that control, not the start of a
    // swipe; otherwise the menu opens under the finger while the card is being dragged.
    if ((e.target as HTMLElement).closest?.("button, a, input, [role='menuitem']")) return;
    start.current = { x: e.clientX, y: e.clientY };
    lock.current = "none";
    crossed.current = false;
    moved.current = false;
  };

  const onPointerMove = (e: ReactPointerEvent) => {
    if (!start.current) return;
    const dx = e.clientX - start.current.x;
    const dy = e.clientY - start.current.y;

    if (lock.current === "none") {
      if (Math.abs(dx) < LOCK_DISTANCE && Math.abs(dy) < LOCK_DISTANCE) return;
      lock.current = Math.abs(dx) > Math.abs(dy) ? "horizontal" : "vertical";
      if (lock.current === "horizontal") {
        setDragging(true);
        try {
          (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
        } catch {
          // capture is a nicety
        }
      }
    }
    if (lock.current !== "horizontal") return;

    // Don't pull the card in a direction that isn't allowed for this user.
    const towards = STAGES[STAGES.indexOf(status) + (dx > 0 ? -1 : 1)];
    if (!towards || actionFor?.(towards) === "locked") {
      setOffset(0);
      return;
    }

    moved.current = true;
    setOffset(Math.max(-MAX_PULL, Math.min(MAX_PULL, dx)));
    const past = Math.abs(dx) >= threshold;
    if (past && !crossed.current) feedbackSwipe();
    crossed.current = past;
  };

  const finish = (e: ReactPointerEvent) => {
    if (!start.current) return;
    const wasHorizontal = lock.current === "horizontal";
    const dx = e.clientX - start.current.x;
    reset();
    if (!wasHorizontal || Math.abs(dx) < threshold) return;

    const idx = STAGES.indexOf(status);
    const next = dx > 0 ? STAGES[idx - 1] : STAGES[idx + 1];
    if (!next) return;
    const action = actionFor ? actionFor(next) : "apply";
    if (action === "locked") return;
    if (action === "gate") onGate?.(next);
    else if (onBlocked) onBlocked();
    else onChange(next);
  };

  return {
    offset,
    dragging,
    /** The stage a swipe in the current direction would move to (for a hint behind the card). */
    target: offset === 0 ? undefined : STAGES[STAGES.indexOf(status) + (offset > 0 ? -1 : 1)],
    /** True right after a drag, so the click that follows it can be ignored. */
    wasDragged: () => {
      const m = moved.current;
      moved.current = false;
      return m;
    },
    handlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp: finish,
      onPointerCancel: reset,
    },
    style: {
      touchAction: "pan-y",
      transform: offset ? `translateX(${offset}px)` : undefined,
      transition: dragging ? "none" : "transform 180ms ease-out",
    } as CSSProperties,
  };
}
