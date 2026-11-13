import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { NewChatButton } from "./NewChatButton";

describe("NewChatButton", () => {
  it("is named 'New chat' for assistive tech, even though it shows only an icon until hovered", () => {
    render(<NewChatButton onClick={() => {}} />);
    expect(screen.getByRole("button", { name: "New chat" })).toBeInTheDocument();
  });

  it("uses the compose (square-pen) icon, not a plus", () => {
    render(<NewChatButton onClick={() => {}} />);
    const icon = screen.getByRole("button", { name: "New chat" }).querySelector("svg");
    expect(icon).toHaveClass("lucide-square-pen");
    expect(icon).not.toHaveClass("lucide-plus");
  });

  it("starts a new chat when clicked", async () => {
    const onClick = vi.fn();
    render(<NewChatButton onClick={onClick} />);
    await userEvent.click(screen.getByRole("button", { name: "New chat" }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("is a purple rounded square with white text", () => {
    render(<NewChatButton onClick={() => {}} />);
    const button = screen.getByRole("button", { name: "New chat" });
    expect(button).toHaveClass("bg-primary", "text-primary-foreground", "rounded-lg");
    expect(button.getAttribute("type")).toBe("button");
  });

  it("hides the label until hover or keyboard focus, then widens to reveal it", () => {
    render(<NewChatButton onClick={() => {}} />);
    const label = screen.getByText("New chat");
    expect(label).toHaveClass("max-w-0", "opacity-0");
    expect(label).toHaveClass("group-hover:max-w-[5rem]", "group-hover:opacity-100");
    expect(label).toHaveClass("group-focus-visible:max-w-[5rem]", "group-focus-visible:opacity-100");
    expect(screen.getByRole("button", { name: "New chat" })).toHaveClass("group");
  });

  it("animates smoothly, and not at all for people who ask for reduced motion", () => {
    render(<NewChatButton onClick={() => {}} />);
    const label = screen.getByText("New chat");
    expect(label).toHaveClass("transition-all", "duration-200");
    expect(label).toHaveClass("motion-reduce:transition-none");
  });
});
