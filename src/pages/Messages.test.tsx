/**
 * The Messages page used to open the pinned OnSwift AI conversation by itself on load
 * (loading its messages, marking them read and polling it). A chat should only open when
 * the user picks one, or arrives through the /messages?user=<id> deep link.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import Messages from "./Messages";

const secureFetch = vi.fn();

vi.mock("@/api/apiClient", () => ({ secureFetch: (...args: unknown[]) => secureFetch(...args) }));
vi.mock("@/components/layout/MainLayout", () => ({
  MainLayout: ({ children }: { children: unknown }) => (
    <div>{typeof children === "function" ? (children as (p: object) => unknown)({ toggleMobileSidebar: () => {} }) : children}</div>
  ),
}));
vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ user: { id: "me", role: "creator", full_name: "Me" } }),
}));
vi.mock("@/contexts/TeamContext", () => ({
  useTeam: () => ({ teamMembers: [], removeTeamMember: vi.fn() }),
}));
vi.mock("next-themes", () => ({ useTheme: () => ({ resolvedTheme: "light" }) }));
vi.mock("@/hooks/use-mobile", () => ({ useIsMobile: () => false }));
vi.mock("@/components/dashboard/InviteMemberModal", () => ({ InviteMemberModal: () => null }));
vi.mock("@/components/messaging/CreateGroupModal", () => ({ CreateGroupModal: () => null }));

const assistantConv = {
  id: "c1",
  other_user: { id: "bot", name: "OnSwift Ai", avatar: null, company: null, role: "assistant" },
  last_message_content: "Welcome!",
  last_message_time: "2026-09-26T09:00:00Z",
  unread_count: 2,
  updated_at: "2026-09-26T09:00:00Z",
};
const personConv = {
  id: "c2",
  other_user: { id: "u2", name: "Ada Lovelace", avatar: null, company: null, role: "talent" },
  last_message_content: "hi",
  last_message_time: "2026-09-26T08:00:00Z",
  unread_count: 0,
  updated_at: "2026-09-26T08:00:00Z",
};

const ok = (data: unknown) => ({ ok: true, status: 200, json: async () => data });

const calledUrls = () => secureFetch.mock.calls.map((c) => String(c[0]));

beforeEach(() => {
  secureFetch.mockReset();
  secureFetch.mockImplementation(async (url: string) => {
    if (url === "/api/v2/conversations/") return ok([personConv, assistantConv]);
    if (url === "/api/v2/groups/") return ok([]);
    if (url === "/api/v2/conversations/start/") return ok(personConv);
    if (url.endsWith("/messages/")) return ok([]);
    return ok({});
  });
});

const renderPage = (path = "/messages") =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Messages />
    </MemoryRouter>
  );

describe("Messages page", () => {
  it("does not open any chat by itself, including the pinned OnSwift AI chat", async () => {
    renderPage();

    // The list loads, with the assistant pinned first...
    await waitFor(() => expect(screen.getAllByText("OnSwift Ai").length).toBeGreaterThan(0));
    expect(screen.getByText("Select a conversation")).toBeTruthy();

    // ...but nothing was opened: no message fetch, no mark-as-read.
    await new Promise((r) => setTimeout(r, 30));
    expect(calledUrls().some((u) => u.includes("/messages/"))).toBe(false);
  });

  it("opens a chat only when the user picks it", async () => {
    renderPage();
    await waitFor(() => expect(screen.getAllByText("OnSwift Ai").length).toBeGreaterThan(0));

    fireEvent.click(screen.getAllByText("OnSwift Ai")[0]);

    await waitFor(() => expect(calledUrls()).toContain("/api/v2/conversations/c1/messages/"));
  });

  it("still opens the right chat for a /messages?user=<id> deep link", async () => {
    renderPage("/messages?user=u2");

    await waitFor(() => expect(calledUrls()).toContain("/api/v2/conversations/c2/messages/"));
    expect(calledUrls()).not.toContain("/api/v2/conversations/c1/messages/");
  });
});
