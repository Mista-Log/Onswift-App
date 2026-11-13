import { describe, expect, it, vi } from "vitest";
import { announceFormUpdated, onFormUpdated } from "./formEvents";

describe("form update events", () => {
  it("tells a listener which form changed", () => {
    const handler = vi.fn();
    const stop = onFormUpdated(handler);
    announceFormUpdated("form-1");
    expect(handler).toHaveBeenCalledWith("form-1");
    stop();
  });

  it("stops telling a listener that has unsubscribed", () => {
    const handler = vi.fn();
    onFormUpdated(handler)();
    announceFormUpdated("form-1");
    expect(handler).not.toHaveBeenCalled();
  });

  it("reaches every listener", () => {
    const [a, b] = [vi.fn(), vi.fn()];
    const stops = [onFormUpdated(a), onFormUpdated(b)];
    announceFormUpdated("form-2");
    expect([a, b].map((fn) => fn.mock.calls.length)).toEqual([1, 1]);
    stops.forEach((stop) => stop());
  });

  it("ignores an event with no form id", () => {
    const handler = vi.fn();
    const stop = onFormUpdated(handler);
    window.dispatchEvent(new CustomEvent("onswift:form-updated", { detail: {} }));
    window.dispatchEvent(new CustomEvent("onswift:form-updated"));
    expect(handler).not.toHaveBeenCalled();
    stop();
  });
});
