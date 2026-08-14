import { useRef, useState } from "react";

// Swipe-to-reply + long-press for chat message bubbles (mobile only — callers
// pass `disabled: true` on desktop). Built on native Pointer events rather
// than Touch events: React makes onTouchMove passive by default, which
// silently breaks preventDefault, whereas Pointer events don't have that
// restriction (same reasoning as the existing contact-list resize handle).

const LONG_PRESS_MS = 2000;
const LONG_PRESS_MOVE_TOLERANCE_PX = 8;
const DIRECTION_LOCK_THRESHOLD_PX = 10;
const SWIPE_REPLY_THRESHOLD_PX = 64;
const SWIPE_MAX_DRAG_PX = 88;

interface UseMessageGestureOptions {
  isOwn: boolean;
  disabled: boolean;
  isSelecting: boolean;
  onSwipeReply: () => void;
  onLongPress: () => void;
  onTap: () => void;
}

export function useMessageGesture({
  isOwn,
  disabled,
  isSelecting,
  onSwipeReply,
  onLongPress,
  onTap,
}: UseMessageGestureOptions) {
  const [dragX, setDragX] = useState(0);
  const [isDragging, setIsDragging] = useState(false);

  const startXRef = useRef(0);
  const startYRef = useRef(0);
  const lockRef = useRef<"none" | "horizontal" | "vertical" | "longpress">("none");
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pointerIdRef = useRef<number | null>(null);

  const clearLongPressTimer = () => {
    if (longPressTimerRef.current !== null) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  const reset = () => {
    clearLongPressTimer();
    lockRef.current = "none";
    pointerIdRef.current = null;
    setIsDragging(false);
    setDragX(0);
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (disabled) return;
    startXRef.current = e.clientX;
    startYRef.current = e.clientY;
    lockRef.current = "none";
    pointerIdRef.current = e.pointerId;

    if (!isSelecting) {
      longPressTimerRef.current = setTimeout(() => {
        if (lockRef.current === "none") {
          lockRef.current = "longpress";
          onLongPress();
        }
      }, LONG_PRESS_MS);
    }
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (disabled || pointerIdRef.current === null) return;
    const dx = e.clientX - startXRef.current;
    const dy = e.clientY - startYRef.current;

    if (lockRef.current === "none") {
      if (Math.hypot(dx, dy) > DIRECTION_LOCK_THRESHOLD_PX) {
        clearLongPressTimer();
        if (isSelecting) {
          // Tap-to-toggle only while selecting — no drag tracking needed.
          lockRef.current = "vertical";
          return;
        }
        lockRef.current = Math.abs(dx) > Math.abs(dy) ? "horizontal" : "vertical";
        if (lockRef.current === "horizontal") {
          e.currentTarget.setPointerCapture(e.pointerId);
        }
      } else if (Math.abs(dx) > LONG_PRESS_MOVE_TOLERANCE_PX || Math.abs(dy) > LONG_PRESS_MOVE_TOLERANCE_PX) {
        clearLongPressTimer();
      }
      return;
    }

    if (lockRef.current !== "horizontal") return;

    // Own bubbles (right, purple) only respond to leftward drag; others only
    // respond to rightward drag — the disallowed direction is ignored.
    const allowed = isOwn ? Math.min(dx, 0) : Math.max(dx, 0);
    const clamped = Math.max(-SWIPE_MAX_DRAG_PX, Math.min(SWIPE_MAX_DRAG_PX, allowed));
    setIsDragging(true);
    setDragX(clamped);
  };

  const onPointerUp = (e: React.PointerEvent) => {
    if (disabled || pointerIdRef.current === null) return;
    clearLongPressTimer();

    if (lockRef.current === "horizontal" && Math.abs(dragX) >= SWIPE_REPLY_THRESHOLD_PX) {
      onSwipeReply();
    } else if (isSelecting && lockRef.current === "none") {
      // Only a true tap (no meaningful movement) toggles selection — a
      // vertical drag here is the user scrolling the list, not selecting.
      onTap();
    }

    if (e.currentTarget.hasPointerCapture?.(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    reset();
  };

  const onPointerCancel = (e: React.PointerEvent) => {
    if (e.currentTarget.hasPointerCapture?.(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    reset();
  };

  return {
    handlers: { onPointerDown, onPointerMove, onPointerUp, onPointerCancel },
    style: {
      transform: dragX !== 0 ? `translateX(${dragX}px)` : undefined,
      transition: isDragging ? "none" : "transform 200ms ease-out",
      touchAction: "pan-y" as const,
    },
    isDragging,
    dragProgress: Math.min(1, Math.abs(dragX) / SWIPE_REPLY_THRESHOLD_PX),
  };
}
