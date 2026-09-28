import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ErrorBoundary } from "./ErrorBoundary";

let explode = true;

function Bomb() {
  if (explode) throw new Error("boom");
  return <p>all good</p>;
}

beforeEach(() => {
  explode = true;
  // React logs caught render errors; keep the test output clean.
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("ErrorBoundary", () => {
  it("renders children normally when nothing throws", () => {
    explode = false;
    render(<ErrorBoundary><Bomb /></ErrorBoundary>);
    expect(screen.getByText("all good")).toBeTruthy();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("shows a friendly fallback instead of blanking the app when a child throws", () => {
    render(<ErrorBoundary><Bomb /></ErrorBoundary>);
    expect(screen.getByRole("alert")).toBeTruthy();
    expect(screen.getByText("Something went wrong on this page")).toBeTruthy();
    expect(screen.getByText("Go to dashboard").getAttribute("href")).toBe("/dashboard");
  });

  it("recovers when the user clicks Try again after the problem is gone", () => {
    render(<ErrorBoundary><Bomb /></ErrorBoundary>);
    expect(screen.getByRole("alert")).toBeTruthy();

    explode = false;
    fireEvent.click(screen.getByText("Try again"));
    expect(screen.getByText("all good")).toBeTruthy();
  });

  it("clears the error automatically when the reset key (route) changes", () => {
    const { rerender } = render(<ErrorBoundary resetKey="/messages"><Bomb /></ErrorBoundary>);
    expect(screen.getByRole("alert")).toBeTruthy();

    explode = false;
    rerender(<ErrorBoundary resetKey="/dashboard"><Bomb /></ErrorBoundary>);
    expect(screen.getByText("all good")).toBeTruthy();
  });
});
