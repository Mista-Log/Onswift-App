import { describe, expect, it } from "vitest";
import { chatReducer, initialChatState, type ChatAction, type ChatState } from "./chatReducer";
import { createSseParser, type AgentAction } from "./sse";

const run = (actions: ChatAction[], from: ChatState = initialChatState) => actions.reduce(chatReducer, from);
const sent = () => run([{ type: "send", localId: "u1", text: "make a task" }]);

const proposal = (over: Partial<AgentAction> = {}): AgentAction => ({
  id: "a1",
  tool: "create_task",
  summary: 'Add the task "X"',
  arguments: { name: "X" },
  status: "pending",
  result: null,
  error: "",
  expires_at: null,
  ...over,
});

const proposed = (over: Partial<AgentAction> = {}): ChatAction => ({
  type: "event",
  event: { type: "action_proposed", ...proposal(over) },
});

describe("action_proposed", () => {
  it("is parsed from the stream", () => {
    const frame = `data: ${JSON.stringify({ type: "action_proposed", ...proposal() })}\n\n`;
    const events = createSseParser().push(frame);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ type: "action_proposed", id: "a1", status: "pending" });
  });

  it("attaches to the reply that proposed it, without the event type", () => {
    const s = run([proposed()], sent());
    expect(s.messages[0].actions).toBeUndefined();
    expect(s.messages[1].actions).toEqual([proposal()]);
  });

  it("keeps several proposals in order", () => {
    const s = run([proposed({ id: "a1" }), proposed({ id: "a2" })], sent());
    expect(s.messages[1].actions?.map((a) => a.id)).toEqual(["a1", "a2"]);
  });

  it("does not stop the stream", () => {
    expect(run([proposed()], sent()).streaming).toBe(true);
  });
});

describe("action_superseded", () => {
  const superseded = (id: string): ChatAction => ({
    type: "event",
    event: { type: "action_superseded", ...proposal({ id, status: "superseded" }) },
  });

  it("is parsed from the stream", () => {
    const frame = `data: ${JSON.stringify({ type: "action_superseded", ...proposal({ status: "superseded" }) })}\n\n`;
    expect(createSseParser().push(frame)[0]).toMatchObject({ type: "action_superseded", id: "a1", status: "superseded" });
  });

  it("turns the older card into a replaced one and leaves the new one alone", () => {
    const s = run([proposed({ id: "a1" }), proposed({ id: "a2" }), superseded("a1")], sent());
    expect(s.messages[1].actions?.map((a) => [a.id, a.status])).toEqual([["a1", "superseded"], ["a2", "pending"]]);
  });

  it("finds the card in an earlier reply too", () => {
    const first = run([proposed({ id: "a1" }), { type: "event", event: { type: "done", message_id: "m1" } }], sent());
    const s = run([{ type: "send", localId: "u2", text: "again" }, proposed({ id: "a2" }), superseded("a1")], first);
    expect(s.messages[1].actions?.[0].status).toBe("superseded");
    expect(s.messages[3].actions?.[0].status).toBe("pending");
  });

  it("does not stop the stream", () => {
    expect(run([proposed({ id: "a1" }), superseded("a1")], sent()).streaming).toBe(true);
  });
});

describe("resolving an action", () => {
  const withProposal = () => run([proposed()], sent());
  const first = (s: ChatState) => s.messages[1].actions![0];

  it("marks it busy and clears an earlier problem", () => {
    const s = run([{ type: "action_problem", id: "a1", message: "boom" }, { type: "action_busy", id: "a1" }], withProposal());
    expect(first(s).busy).toBe(true);
    expect(first(s).problem).toBeUndefined();
  });

  it("replaces it with the server's answer and clears busy", () => {
    const s = run(
      [
        { type: "action_busy", id: "a1" },
        { type: "action_resolved", action: proposal({ status: "executed", result: { link: "/projects/p" } }) },
      ],
      withProposal(),
    );
    expect(first(s)).toMatchObject({ status: "executed", result: { link: "/projects/p" } });
    expect(first(s).busy).toBeFalsy();
  });

  it("a problem clears busy and keeps it pending so the user can retry", () => {
    const s = run([{ type: "action_busy", id: "a1" }, { type: "action_problem", id: "a1", message: "offline" }], withProposal());
    expect(first(s)).toMatchObject({ status: "pending", busy: false, problem: "offline" });
  });

  it("only touches the action with that id", () => {
    const s = run(
      [proposed({ id: "a2" }), { type: "action_resolved", action: proposal({ id: "a2", status: "rejected" }) }],
      withProposal(),
    );
    expect(s.messages[1].actions?.map((a) => [a.id, a.status])).toEqual([["a1", "pending"], ["a2", "rejected"]]);
  });

  it("ignores an id it has never seen", () => {
    const before = withProposal();
    const resolved = run([{ type: "action_resolved", action: proposal({ id: "zzz", status: "executed" }) }], before);
    const busy = run([{ type: "action_busy", id: "zzz" }], before);
    expect(resolved.messages).toEqual(before.messages);
    expect(busy.messages).toEqual(before.messages);
  });
});

describe("loading a saved conversation", () => {
  const msgs = [
    { id: "m1", role: "user" as const, content: "hi" },
    { id: "m2", role: "assistant" as const, content: "ok" },
  ];

  it("shows its actions under the latest reply", () => {
    const s = chatReducer(initialChatState, { type: "load", conversationId: "c", messages: msgs, actions: [proposal()] });
    expect(s.messages[1].actions).toEqual([proposal()]);
    expect(s.messages[0].actions).toBeUndefined();
  });

  it("adds no actions key when there are none", () => {
    const s = chatReducer(initialChatState, { type: "load", conversationId: "c", messages: msgs, actions: [] });
    expect("actions" in s.messages[1]).toBe(false);
    const t = chatReducer(initialChatState, { type: "load", conversationId: "c", messages: msgs });
    expect("actions" in t.messages[1]).toBe(false);
  });

  it("does not attach them to a user message", () => {
    const s = chatReducer(initialChatState, { type: "load", conversationId: "c", messages: [msgs[0]], actions: [proposal()] });
    expect(s.messages[0].actions).toBeUndefined();
  });
});
