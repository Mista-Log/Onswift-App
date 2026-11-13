import { describe, expect, it } from "vitest";
import { chatReducer, withoutLatestTurn, type ChatMessage, type ChatState } from "./chatReducer";

const msg = (id: string, role: "user" | "assistant", content: string, extra: Partial<ChatMessage> = {}): ChatMessage => ({
  id, role, content, tools: [], ...extra,
});

const thread: ChatState = {
  conversationId: "c1",
  streaming: false,
  messages: [msg("u1", "user", "one"), msg("a1", "assistant", "1"), msg("u2", "user", "two"), msg("a2", "assistant", "2")],
};

describe("withoutLatestTurn", () => {
  it("drops the newest user message and everything after it", () => {
    expect(withoutLatestTurn(thread.messages).map((m) => m.id)).toEqual(["u1", "a1"]);
  });

  it("leaves an empty thread, or one with no user message, alone", () => {
    expect(withoutLatestTurn([])).toEqual([]);
    const onlyReply = [msg("a", "assistant", "hi")];
    expect(withoutLatestTurn(onlyReply)).toEqual(onlyReply);
  });
});

describe("send with replace (retry / edit)", () => {
  it("swaps the newest turn for the new message and an empty reply", () => {
    const next = chatReducer(thread, { type: "send", localId: "L", text: "two, reworded", replace: true });
    expect(next.streaming).toBe(true);
    expect(next.messages.map((m) => [m.id, m.role, m.content])).toEqual([
      ["u1", "user", "one"],
      ["a1", "assistant", "1"],
      ["L", "user", "two, reworded"],
      ["L-reply", "assistant", ""],
    ]);
  });

  it("without replace it still just adds to the thread", () => {
    const next = chatReducer(thread, { type: "send", localId: "L", text: "three" });
    expect(next.messages).toHaveLength(6);
  });

  it("is ignored while a reply is already being written", () => {
    const busy = { ...thread, streaming: true };
    expect(chatReducer(busy, { type: "send", localId: "L", text: "x", replace: true })).toBe(busy);
  });
});

describe("ratings", () => {
  it("rated sets the thumbs on exactly that reply", () => {
    const next = chatReducer(thread, { type: "rated", id: "a1", rating: -1 });
    expect(next.messages.map((m) => m.rating)).toEqual([undefined, -1, undefined, undefined]);
    expect(chatReducer(next, { type: "rated", id: "a1", rating: 0 }).messages[1].rating).toBe(0);
  });

  it("a reopened conversation keeps the ratings the server sent", () => {
    const next = chatReducer(thread, {
      type: "load",
      conversationId: "c1",
      messages: [
        { id: "u", role: "user", content: "hi", rating: 0 },
        { id: "a", role: "assistant", content: "hello", rating: 1 },
      ],
    });
    expect(next.messages.map((m) => m.rating)).toEqual([0, 1]);
  });
});
