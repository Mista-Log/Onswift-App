import { describe, expect, it } from "vitest";
import { chatReducer, initialChatState, type ChatAction, type ChatState } from "./chatReducer";

const run = (actions: ChatAction[], from: ChatState = initialChatState) => actions.reduce(chatReducer, from);
const sent = (text = "hello") => run([{ type: "send", localId: "u1", text }]);

describe("chatReducer", () => {
  it("send adds the user message and an empty assistant reply and starts streaming", () => {
    const s = sent();
    expect(s.streaming).toBe(true);
    expect(s.messages.map((m) => [m.role, m.content])).toEqual([["user", "hello"], ["assistant", ""]]);
  });

  it("ignores a second send while a reply is streaming", () => {
    const s = chatReducer(sent(), { type: "send", localId: "u2", text: "again" });
    expect(s.messages).toHaveLength(2);
  });

  it("appends text deltas to the assistant reply only", () => {
    const s = run([
      { type: "event", event: { type: "text_delta", text: "Hel" } },
      { type: "event", event: { type: "text_delta", text: "lo" } },
    ], sent("question"));
    expect(s.messages[0].content).toBe("question");
    expect(s.messages[1].content).toBe("Hello");
  });

  it("tracks a tool from running to done, matched by id", () => {
    const s = run([
      { type: "event", event: { type: "tool_call", id: "t1", name: "list_projects", arguments: {} } },
      { type: "event", event: { type: "tool_call", id: "t2", name: "list_tasks", arguments: {} } },
      { type: "event", event: { type: "tool_result", id: "t1", name: "list_projects", ok: true } },
    ], sent());
    expect(s.messages[1].tools.map((t) => [t.id, t.status])).toEqual([["t1", "done"], ["t2", "running"]]);
  });

  it("marks a tool failed when the result is not ok", () => {
    const s = run([
      { type: "event", event: { type: "tool_call", id: "t1", name: "get_project", arguments: {} } },
      { type: "event", event: { type: "tool_result", id: "t1", name: "get_project", ok: false } },
    ], sent());
    expect(s.messages[1].tools[0].status).toBe("failed");
  });

  it("done stops streaming and adopts the server message id", () => {
    const s = run([{ type: "event", event: { type: "done", message_id: "srv-9" } }], sent());
    expect(s.streaming).toBe(false);
    expect(s.messages[1].id).toBe("srv-9");
  });

  it("an error event stops streaming and shows the message on the reply, keeping partial text", () => {
    const s = run([
      { type: "event", event: { type: "text_delta", text: "partial" } },
      { type: "event", event: { type: "error", code: "timeout", message: "That took too long." } },
    ], sent());
    expect(s.streaming).toBe(false);
    expect(s.messages[1].content).toBe("partial");
    expect(s.messages[1].error).toBe("That took too long.");
  });

  it("failed (network or HTTP error) stops streaming with the given message", () => {
    const s = run([{ type: "failed", message: "A response is already in progress." }], sent());
    expect(s.streaming).toBe(false);
    expect(s.messages[1].error).toBe("A response is already in progress.");
  });

  it("stopped keeps what arrived and allows sending again", () => {
    const s = run([
      { type: "event", event: { type: "text_delta", text: "so far" } },
      { type: "stopped" },
    ], sent());
    expect(s.streaming).toBe(false);
    expect(s.messages[1].content).toBe("so far");
    expect(chatReducer(s, { type: "send", localId: "u2", text: "next" }).messages).toHaveLength(4);
  });

  it("load replaces the thread with saved messages and is not streaming", () => {
    const s = run([{ type: "load", conversationId: "c1", messages: [{ id: "a", role: "user", content: "q" }, { id: "b", role: "assistant", content: "ans" }] }], sent());
    expect(s.conversationId).toBe("c1");
    expect(s.streaming).toBe(false);
    expect(s.messages.map((m) => m.content)).toEqual(["q", "ans"]);
  });

  it("reset clears everything", () => {
    expect(run([{ type: "reset" }], sent())).toEqual(initialChatState);
  });

  it("events with no assistant reply to attach to change nothing", () => {
    const s = chatReducer(initialChatState, { type: "event", event: { type: "text_delta", text: "x" } });
    expect(s).toEqual(initialChatState);
  });
});
