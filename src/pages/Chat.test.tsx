import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import Chat from "./Chat";

const agent = {
  enabled: true,
  messages: [] as unknown[],
  streaming: false,
  reset: vi.fn(),
  send: vi.fn(),
  stop: vi.fn(),
  resolveAction: vi.fn(),
};

vi.mock("@/contexts/AgentContext", () => ({ useAgent: () => agent }));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ user: { full_name: "Ada Lovelace" } }) }));
vi.mock("@/components/layout/MainLayout", () => ({ MainLayout: ({ children }: { children: React.ReactNode }) => <div>{children}</div> }));
vi.mock("@/components/agent/AskHome", () => ({ AskHome: () => <div>home</div> }));
vi.mock("@/components/agent/Composer", () => ({ Composer: () => <div>composer</div> }));
vi.mock("@/components/agent/ThreadView", () => ({ ThreadView: () => <div data-testid="thread">thread</div> }));
vi.mock("@/components/agent/HistoryMenu", () => ({ HistoryMenu: () => <button type="button" aria-label="Chat history" /> }));

const page = () => (
  <MemoryRouter>
    <Chat />
  </MemoryRouter>
);

describe("Chat page New chat button", () => {
  beforeEach(() => {
    agent.messages = [];
  });

  it("is not shown on the empty home screen", () => {
    render(page());
    expect(screen.queryByRole("button", { name: "New chat" })).not.toBeInTheDocument();
  });

  it("sits outside the message column once a conversation has started", () => {
    agent.messages = [{ id: "m1" }];
    render(page());
    const button = screen.getByRole("button", { name: "New chat" });
    const column = screen.getByTestId("thread").closest(".max-w-2xl");
    expect(column).not.toBeNull();
    expect(column).not.toContainElement(button);
  });

  it("is pinned to the page corner so it cannot push against the messages", () => {
    agent.messages = [{ id: "m1" }];
    render(page());
    const corner = screen.getByTestId("chat-corner");
    expect(corner).toHaveClass("absolute", "right-4", "top-4");
    expect(corner).toContainElement(screen.getByRole("button", { name: "New chat" }));
  });

  it("offers chat history on the home screen too, so an old chat can be reopened before typing anything", () => {
    render(page());
    expect(screen.getByTestId("chat-corner")).toContainElement(screen.getByRole("button", { name: "Chat history" }));
  });

  it("keeps history outside the message column once a conversation has started", () => {
    agent.messages = [{ id: "m1" }];
    render(page());
    expect(screen.getByTestId("thread").closest(".max-w-2xl")).not.toContainElement(
      screen.getByRole("button", { name: "Chat history" }),
    );
  });
});
