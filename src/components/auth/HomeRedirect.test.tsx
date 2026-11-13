import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

let mockUser: { role: string } | null;
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ user: mockUser }) }));

import { HomeRedirect, homePathFor } from "./HomeRedirect";

const renderHome = () =>
  render(
    <MemoryRouter initialEntries={["/home"]}>
      <Routes>
        <Route path="/home" element={<HomeRedirect />} />
        <Route path="/chat" element={<div>agent page</div>} />
        <Route path="/dashboard" element={<div>dashboard page</div>} />
      </Routes>
    </MemoryRouter>,
  );

beforeEach(() => {
  mockUser = null;
});

describe("homePathFor", () => {
  it("sends creators to the Agent", () => expect(homePathFor("creator")).toBe("/chat"));
  it.each([["talent"], ["client"], [undefined], ["something-new"]])("keeps %s on the dashboard", (role) => {
    expect(homePathFor(role as string | undefined)).toBe("/dashboard");
  });
});

describe("HomeRedirect", () => {
  it("lands a creator on /chat", () => {
    mockUser = { role: "creator" };
    renderHome();
    expect(screen.getByText("agent page")).toBeInTheDocument();
  });

  it("lands talent on the dashboard", () => {
    mockUser = { role: "talent" };
    renderHome();
    expect(screen.getByText("dashboard page")).toBeInTheDocument();
  });

  it("lands a client on the dashboard", () => {
    mockUser = { role: "client" };
    renderHome();
    expect(screen.getByText("dashboard page")).toBeInTheDocument();
  });

  it("renders nothing while the user is not loaded, rather than guessing a page", () => {
    renderHome();
    expect(screen.queryByText("agent page")).not.toBeInTheDocument();
    expect(screen.queryByText("dashboard page")).not.toBeInTheDocument();
  });
});
