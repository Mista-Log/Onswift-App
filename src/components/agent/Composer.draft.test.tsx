import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Composer } from "./Composer";
import { clearDraft } from "@/lib/agent/draft";

const box = () => screen.getByLabelText("Message the Agent") as HTMLTextAreaElement;
const mount = (onSend = vi.fn()) => render(<Composer onSend={onSend} onStop={vi.fn()} streaming={false} />);
const signInAs = (id: string) => localStorage.setItem("onswift_user", JSON.stringify({ id }));

describe("Composer keeps an unsent message", () => {
  beforeEach(() => {
    localStorage.clear();
    clearDraft();
    signInAs("user-1");
  });

  it("is still there after leaving the Agent and coming back", () => {
    const first = mount();
    fireEvent.change(box(), { target: { value: "Plan the launch week:\n1. teaser" } });
    first.unmount(); // opened another section

    mount();
    expect(box().value).toBe("Plan the launch week:\n1. teaser");
  });

  it("is picked up by the other Agent surface (page and side panel share it)", () => {
    mount();
    fireEvent.change(box(), { target: { value: "half a thought" } });
    mount(); // the other surface opens while the first is still on screen
    expect((screen.getAllByLabelText("Message the Agent")[1] as HTMLTextAreaElement).value).toBe("half a thought");
  });

  it("is written to the browser's storage, so it survives a reload", () => {
    mount();
    fireEvent.change(box(), { target: { value: "keep me" } });
    const stored = JSON.parse(localStorage.getItem("onswift_cache_agent-draft")!);
    expect(stored.data).toEqual({ text: "keep me", owner: "user-1" });
  });

  it("still works while moving around the app when the browser refuses storage", () => {
    const setItem = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("QuotaExceededError");
    });
    try {
      const first = mount();
      fireEvent.change(box(), { target: { value: "storage is full" } });
      first.unmount();
      mount();
      expect(box().value).toBe("storage is full");
    } finally {
      setItem.mockRestore();
    }
  });

  it("is cleared once the message is sent", () => {
    const onSend = vi.fn();
    const first = mount(onSend);
    fireEvent.change(box(), { target: { value: "send this" } });
    fireEvent.click(screen.getByLabelText("Send message"));
    expect(onSend).toHaveBeenCalledWith("send this");
    first.unmount();

    mount();
    expect(box().value).toBe("");
    expect(localStorage.getItem("onswift_cache_agent-draft")).toBeNull();
  });

  it("is cleared when the text is deleted by hand", () => {
    const first = mount();
    fireEvent.change(box(), { target: { value: "never mind" } });
    fireEvent.change(box(), { target: { value: "" } });
    first.unmount();
    mount();
    expect(box().value).toBe("");
  });

  it("never shows one account's draft to another account on the same browser", () => {
    const first = mount();
    fireEvent.change(box(), { target: { value: "private plan" } });
    first.unmount();

    signInAs("user-2");
    mount();
    expect(box().value).toBe("");
  });
});
