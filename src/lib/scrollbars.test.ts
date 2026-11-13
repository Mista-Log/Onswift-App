import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { installScrollbarReveal } from "./scrollbars";

describe("installScrollbarReveal", () => {
  let stop: () => void;
  beforeEach(() => {
    vi.useFakeTimers();
    stop = installScrollbarReveal();
  });
  afterEach(() => {
    stop();
    vi.useRealTimers();
    document.body.innerHTML = "";
    document.documentElement.removeAttribute("data-scrolling");
  });

  it("marks the element that scrolls, then clears the mark once it stops", () => {
    const box = document.createElement("div");
    document.body.appendChild(box);
    box.dispatchEvent(new Event("scroll"));
    expect(box).toHaveAttribute("data-scrolling");
    vi.advanceTimersByTime(1000);
    expect(box).not.toHaveAttribute("data-scrolling");
  });

  it("keeps the bar while scrolling continues", () => {
    const box = document.createElement("div");
    document.body.appendChild(box);
    box.dispatchEvent(new Event("scroll"));
    vi.advanceTimersByTime(600);
    box.dispatchEvent(new Event("scroll"));
    vi.advanceTimersByTime(600);
    expect(box).toHaveAttribute("data-scrolling");
    vi.advanceTimersByTime(400);
    expect(box).not.toHaveAttribute("data-scrolling");
  });

  it("marks the page (html) when the document itself scrolls", () => {
    document.dispatchEvent(new Event("scroll"));
    expect(document.documentElement).toHaveAttribute("data-scrolling");
  });

  it("only marks the element that scrolled", () => {
    const [a, b] = [document.createElement("div"), document.createElement("div")];
    document.body.append(a, b);
    a.dispatchEvent(new Event("scroll"));
    expect(b).not.toHaveAttribute("data-scrolling");
  });

  it("stops listening once uninstalled", () => {
    stop();
    const box = document.createElement("div");
    document.body.appendChild(box);
    box.dispatchEvent(new Event("scroll"));
    expect(box).not.toHaveAttribute("data-scrolling");
    stop = installScrollbarReveal();
  });
});
