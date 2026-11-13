import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

let mockUser: { id: string; role: string; full_name: string } | null;
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ user: mockUser }) }));

const chat = {
  conversationId: null as string | null,
  messages: [] as unknown[],
  streaming: false,
  send: vi.fn(),
  stop: vi.fn(),
  reset: vi.fn(),
  load: vi.fn(),
};
vi.mock("@/hooks/useAgentChat", () => ({ useAgentChat: () => chat }));

import { AgentPanel } from "./AgentPanel";
import { AgentProvider, useAgent } from "@/contexts/AgentContext";
import Chat from "@/pages/Chat";
import { PANEL_MAX_WIDTH, PANEL_OPEN_KEY, PANEL_WIDTH_KEY } from "@/lib/agent/panel";

const creator = { id: "u1", role: "creator", full_name: "Ada Lovelace" };

function PanelHarness() {
  const agent = useAgent();
  return (
    <>
      <button onClick={agent.togglePanel}>toggle</button>
      <span data-testid="enabled">{String(agent.enabled)}</span>
      <AgentPanel />
    </>
  );
}

const renderAt = (path = "/projects", ui = <PanelHarness />) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <AgentProvider>
        <Routes>
          <Route path="/chat" element={<div>chat page</div>} />
          <Route path="*" element={ui} />
        </Routes>
      </AgentProvider>
    </MemoryRouter>,
  );

beforeEach(() => {
  mockUser = creator;
  localStorage.clear();
  Object.values(chat).forEach((v) => typeof v === "function" && (v as ReturnType<typeof vi.fn>).mockClear());
  chat.messages = [];
  chat.streaming = false;
});
afterEach(() => localStorage.clear());

describe("AgentProvider and AgentPanel", () => {
  it("is enabled for creators only", () => {
    mockUser = { id: "u2", role: "talent", full_name: "T" };
    renderAt();
    expect(screen.getByTestId("enabled")).toHaveTextContent("false");
  });

  it("renders nothing for a non-creator even if the stored state says open", () => {
    mockUser = { id: "u2", role: "client", full_name: "C" };
    localStorage.setItem(PANEL_OPEN_KEY, "true");
    renderAt();
    expect(screen.queryByRole("complementary", { name: "Agent" })).not.toBeInTheDocument();
  });

  it("is closed by default and opens from the toggle", async () => {
    renderAt();
    expect(screen.queryByRole("complementary", { name: "Agent" })).not.toBeInTheDocument();
    await userEvent.click(screen.getByText("toggle"));
    expect(screen.getByRole("complementary", { name: "Agent" })).toBeInTheDocument();
  });

  it("remembers open state across a reload", async () => {
    const first = renderAt();
    await userEvent.click(screen.getByText("toggle"));
    expect(localStorage.getItem(PANEL_OPEN_KEY)).toBe("true");
    first.unmount();
    renderAt();
    expect(screen.getByRole("complementary", { name: "Agent" })).toBeInTheDocument();
  });

  it("closes from the X button and remembers that", async () => {
    localStorage.setItem(PANEL_OPEN_KEY, "true");
    renderAt();
    await userEvent.click(screen.getByRole("button", { name: /close agent/i }));
    expect(screen.queryByRole("complementary", { name: "Agent" })).not.toBeInTheDocument();
    expect(localStorage.getItem(PANEL_OPEN_KEY)).toBe("false");
  });

  it("resizes with the arrow keys and persists, never past the limits", async () => {
    localStorage.setItem(PANEL_OPEN_KEY, "true");
    renderAt();
    const handle = screen.getByRole("separator", { name: /resize agent panel/i });
    const before = Number(handle.getAttribute("aria-valuenow"));
    handle.focus();
    await userEvent.keyboard("{ArrowLeft}");
    expect(Number(handle.getAttribute("aria-valuenow"))).toBeGreaterThan(before);
    expect(localStorage.getItem(PANEL_WIDTH_KEY)).toBe(handle.getAttribute("aria-valuenow"));
    for (let i = 0; i < 40; i++) await userEvent.keyboard("{ArrowLeft}");
    expect(Number(handle.getAttribute("aria-valuenow"))).toBe(PANEL_MAX_WIDTH);
  });

  it("expand closes the panel and goes to /chat", async () => {
    localStorage.setItem(PANEL_OPEN_KEY, "true");
    renderAt();
    await userEvent.click(screen.getByRole("button", { name: /open full page/i }));
    expect(screen.getByText("chat page")).toBeInTheDocument();
    expect(localStorage.getItem(PANEL_OPEN_KEY)).toBe("false");
  });

  it("sends a suggestion with the current page as context", async () => {
    localStorage.setItem(PANEL_OPEN_KEY, "true");
    const id = "3f2b8c1e-5a4d-4e6f-9a1b-2c3d4e5f6a7b";
    renderAt(`/projects/${id}`);
    await userEvent.click(screen.getByRole("button", { name: "Any overdue tasks?" }));
    expect(chat.send).toHaveBeenCalledWith("Any overdue tasks?", { route: `/projects/${id}`, project_id: id });
  });

  it("hides the suggestion chips on a phone, where the panel is a full-screen sheet", () => {
    localStorage.setItem(PANEL_OPEN_KEY, "true");
    renderAt();
    expect(screen.getByRole("group", { name: "Suggestions" })).toHaveClass("hidden", "md:flex");
  });

  it("offers chat history in its header", () => {
    localStorage.setItem(PANEL_OPEN_KEY, "true");
    renderAt();
    expect(screen.getByRole("button", { name: "Chat history" })).toBeInTheDocument();
  });

  it("starts fresh when a different user signs in", () => {
    const view = renderAt();
    chat.reset.mockClear();
    mockUser = { id: "u9", role: "creator", full_name: "Other" };
    view.rerender(
      <MemoryRouter initialEntries={["/projects"]}>
        <AgentProvider>
          <PanelHarness />
        </AgentProvider>
      </MemoryRouter>,
    );
    expect(chat.reset).toHaveBeenCalled();
  });
});

describe("Chat page guard", () => {
  it("sends non-creators back to the dashboard", () => {
    mockUser = { id: "u2", role: "talent", full_name: "T" };
    render(
      <MemoryRouter initialEntries={["/chat"]}>
        <AgentProvider>
          <Routes>
            <Route path="/chat" element={<Chat />} />
            <Route path="/dashboard" element={<div>dashboard page</div>} />
          </Routes>
        </AgentProvider>
      </MemoryRouter>,
    );
    expect(screen.getByText("dashboard page")).toBeInTheDocument();
  });
});
