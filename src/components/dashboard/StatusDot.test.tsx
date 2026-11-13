import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { StatusDot } from "./StatusDot";

describe("StatusDot", () => {
  afterEach(() => document.documentElement.classList.remove("dark"));

  it.each([
    ["planning", "Planning", "bg-red-500"],
    ["in-progress", "In Progress", "bg-[hsl(250_76%_63%)]"],
    ["completed", "Completed", "bg-emerald-500"],
  ])("shows %s as a coloured circle with its name for assistive tech and the tooltip", (status, label, color) => {
    render(<StatusDot status={status} />);
    const dot = screen.getByRole("img", { name: `Status: ${label}` });
    expect(dot).toHaveClass(color, "rounded-full");
    expect(dot).toHaveAttribute("title", label);
    expect(dot).toBeEmptyDOMElement(); // colour only, the text lives in the label
  });

  it("is a circle of a reasonable size", () => {
    render(<StatusDot status="planning" />);
    expect(screen.getByRole("img")).toHaveClass("h-3.5", "w-3.5", "rounded-full");
  });

  it.each(["planning", "in-progress", "completed"])("keeps the same colour in dark mode for %s", (status) => {
    const { unmount } = render(<StatusDot status={status} />);
    const light = screen.getByRole("img").className.split(" ").filter((c) => c.startsWith("bg-"));
    unmount();

    document.documentElement.classList.add("dark");
    render(<StatusDot status={status} />);
    const dark = screen.getByRole("img").className.split(" ").filter((c) => c.startsWith("bg-"));

    expect(dark).toEqual(light);
    expect(screen.getByRole("img").className).not.toMatch(/dark:bg-/); // no dark-mode colour override
  });

  it("uses the brand purple itself, not the theme token that changes with the theme", () => {
    render(<StatusDot status="in-progress" />);
    expect(screen.getByRole("img").className).not.toContain("bg-primary");
  });

  it("shows an unrecognised status as a grey dot labelled with that status", () => {
    render(<StatusDot status="on_hold" />);
    const dot = screen.getByRole("img", { name: "Status: on_hold" });
    expect(dot).toHaveClass("bg-gray-400");
  });

  it("copes with an empty status", () => {
    render(<StatusDot status="" />);
    expect(screen.getByRole("img", { name: "Status: Unknown" })).toBeInTheDocument();
  });
});
