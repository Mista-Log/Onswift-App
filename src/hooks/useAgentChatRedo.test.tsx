import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const secureFetch = vi.fn();
const secureStream = vi.fn();
vi.mock("@/api/apiClient", () => ({
  secureFetch: (...a: unknown[]) => secureFetch(...a),
  secureStream: (...a: unknown[]) => secureStream(...a),
}));

import { useAgentChat } from "./useAgentChat";

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
const frame = (event: object) => `event: x\ndata: ${JSON.stringify(event)}\n\n`;

function sse(chunks: string[]) {
  const enc = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    start(c) {
      chunks.forEach((t) => c.enqueue(enc.encode(t)));
      c.close();
    },
  });
  return new Response(body, { status: 200, headers: { "Content-Type": "text/event-stream" } });
}

const reply = (text: string, id: string) => sse([frame({ type: "text_delta", text }) + frame({ type: "done", message_id: id })]);

/** The server's view of the conversation, used when the screen asks for it back. */
const serverThread = {
  messages: [
    { id: "su", role: "user", content: "make a project", rating: 0 },
    { id: "sa", role: "assistant", content: "Proposed it.", rating: 0 },
  ],
  actions: [],
};

beforeEach(() => {
  secureFetch.mockReset();
  secureStream.mockReset();
  secureFetch.mockImplementation(async (url: string, init?: { method?: string }) => {
    if (url === "/api/v9/conversations/" && init?.method === "POST") return json(201, { id: "conv-1" });
    if (url === "/api/v9/conversations/conv-1/") return json(200, serverThread);
    return json(200, {});
  });
});

async function chatWithOneTurn() {
  secureStream.mockResolvedValueOnce(reply("first answer", "m-1"));
  const hook = renderHook(() => useAgentChat());
  await act(() => hook.result.current.send("What is due?"));
  return hook;
}

describe("retry and edit", () => {
  it("asks the server to replace the newest turn and shows one turn, not two", async () => {
    const { result } = await chatWithOneTurn();
    secureStream.mockResolvedValueOnce(reply("second answer", "m-2"));
    await act(() => result.current.send("What is due?", undefined, { replace: true }));

    expect(JSON.parse(secureStream.mock.calls[1][1].body)).toMatchObject({ content: "What is due?", replace_last: true });
    expect(result.current.messages.map((m) => [m.role, m.content])).toEqual([
      ["user", "What is due?"],
      ["assistant", "second answer"],
    ]);
    expect(result.current.messages[1].id).toBe("m-2");
  });

  it("an ordinary send never asks for a replace", async () => {
    const { result } = await chatWithOneTurn();
    secureStream.mockResolvedValueOnce(reply("x", "m-2"));
    await act(() => result.current.send("another"));
    expect(JSON.parse(secureStream.mock.calls[1][1].body)).not.toHaveProperty("replace_last");
    expect(result.current.messages).toHaveLength(4);
  });

  it("with no conversation yet there is nothing to replace, so it is a normal first message", async () => {
    secureStream.mockResolvedValueOnce(reply("hi", "m-1"));
    const { result } = renderHook(() => useAgentChat());
    await act(() => result.current.send("hello", undefined, { replace: true }));
    expect(JSON.parse(secureStream.mock.calls[0][1].body)).not.toHaveProperty("replace_last");
    expect(result.current.messages).toHaveLength(2);
  });

  it("when the server refuses, the real thread comes back and the reason is shown", async () => {
    const { result } = await chatWithOneTurn();
    secureStream.mockResolvedValueOnce(json(409, { code: "turn_has_changes", detail: "no" }));
    await act(() => result.current.send("make a project", undefined, { replace: true }));

    expect(result.current.streaming).toBe(false);
    // The server's thread, not the one the screen had already cut.
    expect(result.current.messages.map((m) => m.id)).toEqual(["su", "sa"]);
    expect(result.current.messages[1].error).toBe("You already confirmed a change in this reply, so it can't be redone.");
  });

  it("when the network drops before any reply, the old turn is put back", async () => {
    const { result } = await chatWithOneTurn();
    secureStream.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    await act(() => result.current.send("make a project", undefined, { replace: true }));
    expect(result.current.messages.map((m) => m.id)).toEqual(["su", "sa"]);
    expect(result.current.messages[1].error).toMatch(/Couldn't reach the Agent/);
  });
});

describe("rating", () => {
  it("shows the thumbs at once and saves it", async () => {
    const { result } = await chatWithOneTurn();
    await act(() => result.current.rate("m-1", 1));
    expect(result.current.messages[1].rating).toBe(1);
    const call = secureFetch.mock.calls.find((c) => c[0] === "/api/v9/messages/m-1/rating/");
    expect(call?.[1]).toMatchObject({ method: "POST" });
    expect(JSON.parse(call?.[1].body)).toEqual({ rating: 1 });
  });

  it("puts the old thumbs back if saving fails", async () => {
    const { result } = await chatWithOneTurn();
    await act(() => result.current.rate("m-1", -1));
    expect(result.current.messages[1].rating).toBe(-1);

    secureFetch.mockImplementation(async () => json(500, {}));
    await act(() => result.current.rate("m-1", 1));
    expect(result.current.messages[1].rating).toBe(-1);
  });

  it("puts the old thumbs back if the network is down", async () => {
    const { result } = await chatWithOneTurn();
    secureFetch.mockRejectedValue(new TypeError("offline"));
    await act(() => result.current.rate("m-1", 1));
    expect(result.current.messages[1].rating).toBe(0);
  });

  it("does not try to rate a message the server has not saved yet", async () => {
    const { result } = await chatWithOneTurn();
    const before = secureFetch.mock.calls.length;
    await act(() => result.current.rate("local-123-reply", 1));
    expect(secureFetch.mock.calls.length).toBe(before);
  });
});
