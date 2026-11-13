import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { BoardSkeleton, CardGridSkeleton, ListSkeleton } from "./skeletons";
import { AppShellSkeleton } from "@/components/layout/AppShellSkeleton";

describe("loading skeletons", () => {
  it("announce themselves once, with their own label", () => {
    render(<ListSkeleton label="Loading your forms" />);
    expect(screen.getAllByRole("status")).toHaveLength(1);
    expect(screen.getByRole("status", { name: "Loading your forms" })).toHaveAttribute("aria-busy", "true");
  });

  it("draw the number of placeholders asked for", () => {
    const { container } = render(<CardGridSkeleton count={4} />);
    expect(container.querySelectorAll(".glass-card")).toHaveLength(4);
  });

  it("draw three board columns", () => {
    const { container } = render(<BoardSkeleton />);
    expect(container.querySelectorAll(".rounded-2xl")).toHaveLength(3);
    expect(screen.getByRole("status", { name: "Loading tasks" })).toBeInTheDocument();
  });

  it("hide the grey boxes from screen readers and stop pulsing for reduced motion", () => {
    const { container } = render(<ListSkeleton count={1} />);
    expect(container.querySelector(".glass-card")).toHaveAttribute("aria-hidden", "true");
    expect(container.querySelector(".animate-pulse")).toHaveClass("motion-reduce:animate-none");
  });

  it("shows the app frame, not a bare spinner, while signing in", () => {
    const { container } = render(<AppShellSkeleton />);
    expect(screen.getByRole("status", { name: "Loading the app" })).toBeInTheDocument();
    expect(container.querySelector(".animate-spin")).toBeNull();
    expect(container.querySelectorAll(".animate-pulse").length).toBeGreaterThan(8);
  });
});
