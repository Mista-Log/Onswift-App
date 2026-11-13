import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const agent = { conversationId: null as string | null, load: vi.fn() };
const secureFetch = vi.fn();
const mobile = { value: false };

vi.mock("@/contexts/AgentContext", () => ({ useAgent: () => agent }));
vi.mock("@/api/apiClient", () => ({ secureFetch: (...a: unknown[]) => secureFetch(...a) }));
vi.mock("@/hooks/use-mobile", () => ({ useIsMobile: () => mobile.value }));

import { HistoryMenu } from "./HistoryMenu";

// Radix positions its popover with a ResizeObserver, which jsdom does not have.
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
};

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

const hoursAgo = (h: number) => new Date(Date.now() - h * 3_600_000).toISOString();
// Noon yesterday by the calendar, so the test gives the same answer at any time of day.
const yesterdayNoon = () => {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  d.setHours(12, 0, 0, 0);
  return d.toISOString();
};
const row = (id: string, title: string, updated = hoursAgo(0)) => ({ id, title, created_at: updated, updated_at: updated });

const openMenu = async () => userEvent.click(screen.getByRole("button", { name: "Chat history" }));

beforeEach(() => {
  secureFetch.mockReset();
  agent.load.mockReset();
  agent.conversationId = null;
  mobile.value = false;
});

describe("HistoryMenu", () => {
  it("does not fetch anything until it is opened", () => {
    render(<HistoryMenu />);
    expect(screen.getByRole("button", { name: "Chat history" })).toBeInTheDocument();
    expect(secureFetch).not.toHaveBeenCalled();
  });

  it("lists past chats, grouped by day, when opened", async () => {
    secureFetch.mockResolvedValue(json(200, [row("a", "Plan the Rebrand"), row("b", "Weekly review", yesterdayNoon())]));
    render(<HistoryMenu />);
    await openMenu();
    expect(await screen.findByText("Plan the Rebrand")).toBeInTheDocument();
    expect(screen.getByText("Weekly review")).toBeInTheDocument();
    expect(secureFetch).toHaveBeenCalledWith("/api/v9/conversations/");
    expect(screen.getByRole("region", { name: "Today" })).toContainElement(screen.getByText("Plan the Rebrand"));
    expect(screen.getByRole("region", { name: "Yesterday" })).toContainElement(screen.getByText("Weekly review"));
  });

  it("asks again every time it is opened, so a chat started a moment ago is there", async () => {
    secureFetch.mockResolvedValue(json(200, [row("a", "First")]));
    render(<HistoryMenu />);
    await openMenu();
    await screen.findByText("First");
    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByText("First")).not.toBeInTheDocument());
    await openMenu();
    await screen.findByText("First");
    expect(secureFetch).toHaveBeenCalledTimes(2);
  });

  it("says so when there are no past chats", async () => {
    secureFetch.mockResolvedValue(json(200, []));
    render(<HistoryMenu />);
    await openMenu();
    expect(await screen.findByText("No past chats yet.")).toBeInTheDocument();
  });

  it("shows a loading state while the list is on its way", async () => {
    secureFetch.mockReturnValue(new Promise(() => {}));
    render(<HistoryMenu />);
    await openMenu();
    expect(await screen.findByRole("status", { name: "Loading chats" })).toBeInTheDocument();
    expect(screen.queryByText("No past chats yet.")).not.toBeInTheDocument();
  });

  it("shows an error with a way to try again", async () => {
    secureFetch.mockResolvedValueOnce(json(500, {})).mockResolvedValueOnce(json(200, [row("a", "Back again")]));
    render(<HistoryMenu />);
    await openMenu();
    expect(await screen.findByText("Couldn't load your chats.")).toBeInTheDocument();
    expect(screen.queryByText("No past chats yet.")).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByText("Back again")).toBeInTheDocument();
  });

  it("falls back to 'Untitled chat' for a blank title", async () => {
    secureFetch.mockResolvedValue(json(200, [row("a", "   ")]));
    render(<HistoryMenu />);
    await openMenu();
    expect(await screen.findByText("Untitled chat")).toBeInTheDocument();
  });

  it("reopens the chosen chat and closes", async () => {
    secureFetch.mockResolvedValue(json(200, [row("a", "Plan the Rebrand")]));
    agent.load.mockResolvedValue(true);
    render(<HistoryMenu />);
    await openMenu();
    await userEvent.click(await screen.findByText("Plan the Rebrand"));
    expect(agent.load).toHaveBeenCalledWith("a");
    await waitFor(() => expect(screen.queryByText("Plan the Rebrand")).not.toBeInTheDocument());
  });

  it("stays open and says so when the chat cannot be opened", async () => {
    secureFetch.mockResolvedValue(json(200, [row("a", "Plan the Rebrand")]));
    agent.load.mockResolvedValue(false);
    render(<HistoryMenu />);
    await openMenu();
    await userEvent.click(await screen.findByText("Plan the Rebrand"));
    expect(await screen.findByRole("alert")).toHaveTextContent("Couldn't open that chat");
    expect(screen.getByText("Plan the Rebrand")).toBeInTheDocument();
  });

  it("marks the chat that is open, and choosing it again just closes the menu", async () => {
    agent.conversationId = "a";
    secureFetch.mockResolvedValue(json(200, [row("a", "Plan the Rebrand"), row("b", "Other")]));
    render(<HistoryMenu />);
    await openMenu();
    const current = (await screen.findByText("Plan the Rebrand")).closest("button")!;
    expect(current).toHaveAttribute("aria-current", "true");
    expect(screen.getByText("Other").closest("button")).not.toHaveAttribute("aria-current");
    await userEvent.click(current);
    expect(agent.load).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.queryByText("Other")).not.toBeInTheDocument());
  });

  it("opens as a side sheet on a phone", async () => {
    mobile.value = true;
    secureFetch.mockResolvedValue(json(200, [row("a", "Plan the Rebrand")]));
    render(<HistoryMenu />);
    await openMenu();
    const dialog = await screen.findByRole("dialog");
    expect(dialog).toHaveTextContent("Chat history");
    expect(dialog).toHaveClass("w-[85vw]"); // the sheet; the desktop popover is w-80
    expect(await screen.findByText("Plan the Rebrand")).toBeInTheDocument();
  });
});
