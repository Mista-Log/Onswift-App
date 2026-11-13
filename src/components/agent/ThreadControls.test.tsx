import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ThreadView } from "./ThreadView";
import type { ActionView, ChatMessage } from "@/lib/agent/chatReducer";

const msg = (id: string, role: "user" | "assistant", content: string, extra: Partial<ChatMessage> = {}): ChatMessage => ({
  id, role, content, tools: [], ...extra,
});

const card = (status: ActionView["status"]): ActionView => ({
  id: `act-${status}`, tool: "create_project", summary: "Create the project", arguments: {},
  status, result: null, error: "", expires_at: null,
});

const oneTurn = (extra: Partial<ChatMessage> = {}) => [msg("u1", "user", "What is due?"), msg("a1", "assistant", "Two tasks.", extra)];

function handlers() {
  return { onRetry: vi.fn(), onEdit: vi.fn(), onRate: vi.fn() };
}

describe("thumbs on a reply", () => {
  it("are not there at all unless the page wires them up", () => {
    render(<ThreadView streaming={false} messages={oneTurn()} />);
    expect(screen.queryByRole("button", { name: "Good response" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Try again" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Edit message" })).toBeNull();
  });

  it("rate the reply up or down", async () => {
    const h = handlers();
    render(<ThreadView streaming={false} messages={oneTurn()} {...h} />);
    await userEvent.click(screen.getByRole("button", { name: "Good response" }));
    await userEvent.click(screen.getByRole("button", { name: "Bad response" }));
    expect(h.onRate.mock.calls).toEqual([["a1", 1], ["a1", -1]]);
  });

  it("show what was chosen, and pressing it again clears it", async () => {
    const h = handlers();
    render(<ThreadView streaming={false} messages={oneTurn({ rating: 1 })} {...h} />);
    const up = screen.getByRole("button", { name: "Good response" });
    expect(up).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Bad response" })).toHaveAttribute("aria-pressed", "false");
    await userEvent.click(up);
    expect(h.onRate).toHaveBeenCalledWith("a1", 0);
  });

  it("switching from up to down sends down, not a clear", async () => {
    const h = handlers();
    render(<ThreadView streaming={false} messages={oneTurn({ rating: 1 })} {...h} />);
    await userEvent.click(screen.getByRole("button", { name: "Bad response" }));
    expect(h.onRate).toHaveBeenCalledWith("a1", -1);
  });

  it("wait until the reply has finished", () => {
    render(<ThreadView streaming messages={oneTurn()} {...handlers()} />);
    expect(screen.queryByRole("group", { name: "Reply actions" })).toBeNull();
  });

  it("are not offered on a reply the server has not saved, or one that failed", () => {
    render(<ThreadView streaming={false} messages={[msg("u", "user", "hi"), msg("local-1-reply", "assistant", "partial")]} {...handlers()} />);
    expect(screen.queryByRole("button", { name: "Good response" })).toBeNull();
    expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument(); // a stopped reply can still be retried
  });

  it("only the newest reply can be tried again", () => {
    const messages = [...oneTurn(), msg("u2", "user", "and today?"), msg("a2", "assistant", "One.")];
    render(<ThreadView streaming={false} messages={messages} {...handlers()} />);
    expect(screen.getAllByRole("button", { name: "Good response" })).toHaveLength(2);
    expect(screen.getAllByRole("button", { name: "Try again" })).toHaveLength(1);
  });
});

describe("Try again", () => {
  it("runs the newest message again", async () => {
    const h = handlers();
    render(<ThreadView streaming={false} messages={oneTurn()} {...h} />);
    await userEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(h.onRetry).toHaveBeenCalledTimes(1);
  });

  it("is offered on a reply that ended in an error", () => {
    render(<ThreadView streaming={false} messages={[msg("u", "user", "hi"), msg("local-9-reply", "assistant", "", { error: "That took too long." })]} {...handlers()} />);
    expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
  });

  it("is disabled, with the reason, once a change in that reply was confirmed", () => {
    render(<ThreadView streaming={false} messages={oneTurn({ actions: [card("executed")] })} {...handlers()} />);
    const retry = screen.getByRole("button", { name: /Try again \(unavailable/ });
    expect(retry).toBeDisabled();
    expect(retry).toHaveAttribute("title", "You already confirmed a change in this reply, so it can't be redone.");
  });

  it("stays available while a card is only waiting for an answer", () => {
    render(<ThreadView streaming={false} messages={oneTurn({ actions: [card("pending")] })} {...handlers()} />);
    expect(screen.getByRole("button", { name: "Try again" })).toBeEnabled();
  });

  it("is not blocked by a change confirmed in an earlier turn", () => {
    const messages = [
      msg("u1", "user", "make a project"),
      msg("a1", "assistant", "Proposed.", { actions: [card("executed")] }),
      msg("u2", "user", "what is due?"),
      msg("a2", "assistant", "Two tasks."),
    ];
    render(<ThreadView streaming={false} messages={messages} {...handlers()} />);
    expect(screen.getByRole("button", { name: "Try again" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Edit message" })).toBeEnabled();
  });

  it("is blocked while a confirm is in flight", () => {
    const busy = { ...card("pending"), busy: true };
    render(<ThreadView streaming={false} messages={oneTurn({ actions: [busy] })} {...handlers()} />);
    expect(screen.getByRole("button", { name: /Try again \(unavailable/ })).toBeDisabled();
  });
});

describe("editing your newest message", () => {
  it("only the newest user message has an edit button", () => {
    const messages = [...oneTurn(), msg("u2", "user", "and today?"), msg("a2", "assistant", "One.")];
    render(<ThreadView streaming={false} messages={messages} {...handlers()} />);
    expect(screen.getAllByRole("button", { name: "Edit message" })).toHaveLength(1);
  });

  it("opens an editor with the current text, and saving sends the new text", async () => {
    const h = handlers();
    render(<ThreadView streaming={false} messages={oneTurn()} {...h} />);
    await userEvent.click(screen.getByRole("button", { name: "Edit message" }));
    const box = screen.getByRole("textbox", { name: "Edit your message" });
    expect(box).toHaveValue("What is due?");
    await userEvent.clear(box);
    await userEvent.type(box, "What is due this week?");
    await userEvent.click(screen.getByRole("button", { name: /Save & send/ }));
    expect(h.onEdit).toHaveBeenCalledWith("What is due this week?");
    expect(screen.queryByRole("textbox", { name: "Edit your message" })).toBeNull();
  });

  it("Enter saves, Shift+Enter adds a line, Escape cancels without sending", async () => {
    const h = handlers();
    render(<ThreadView streaming={false} messages={oneTurn()} {...h} />);
    await userEvent.click(screen.getByRole("button", { name: "Edit message" }));
    const box = screen.getByRole("textbox", { name: "Edit your message" });
    await userEvent.type(box, "{Shift>}{Enter}{/Shift}more");
    expect(box).toHaveValue("What is due?\nmore");
    expect(h.onEdit).not.toHaveBeenCalled();
    await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("textbox", { name: "Edit your message" })).toBeNull();
    expect(screen.getByText("What is due?")).toBeInTheDocument();
    expect(h.onEdit).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole("button", { name: "Edit message" }));
    await userEvent.type(screen.getByRole("textbox", { name: "Edit your message" }), "!{Enter}");
    expect(h.onEdit).toHaveBeenCalledWith("What is due?!");
  });

  it("cannot save an empty message", async () => {
    const h = handlers();
    render(<ThreadView streaming={false} messages={oneTurn()} {...h} />);
    await userEvent.click(screen.getByRole("button", { name: "Edit message" }));
    await userEvent.clear(screen.getByRole("textbox", { name: "Edit your message" }));
    expect(screen.getByRole("button", { name: /Save & send/ })).toBeDisabled();
    await userEvent.keyboard("{Enter}");
    expect(h.onEdit).not.toHaveBeenCalled();
  });

  it("cannot edit while a reply is being written", () => {
    render(<ThreadView streaming messages={oneTurn()} {...handlers()} />);
    expect(screen.queryByRole("button", { name: "Edit message" })).toBeNull();
  });

  it("is disabled, with the reason, once a change in that turn was confirmed", () => {
    render(<ThreadView streaming={false} messages={oneTurn({ actions: [card("executed")] })} {...handlers()} />);
    const edit = screen.getByRole("button", { name: /Edit message \(unavailable/ });
    expect(edit).toBeDisabled();
    const reply = screen.getByRole("group", { name: "Reply actions" });
    expect(within(reply).getByRole("button", { name: /Try again \(unavailable/ })).toBeDisabled();
  });
});
