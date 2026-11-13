import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const secureFetch = vi.fn();
const secureStream = vi.fn();
vi.mock("@/api/apiClient", () => ({
  secureFetch: (...a: unknown[]) => secureFetch(...a),
  secureStream: (...a: unknown[]) => secureStream(...a),
}));

import { NETWORK_MESSAGE, useAgentChat } from "./useAgentChat";

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

const frame = (event: object) => `event: x\ndata: ${JSON.stringify(event)}\n\n`;

/** A streaming response made of the given text chunks. */
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

beforeEach(() => {
  secureFetch.mockReset();
  secureStream.mockReset();
  secureFetch.mockResolvedValue(json(201, { id: "conv-1" }));
});

describe("useAgentChat", () => {
  it("creates a conversation, streams the reply and finishes", async () => {
    secureStream.mockResolvedValueOnce(
      sse([
        frame({ type: "tool_call", id: "t1", name: "list_deadlines", arguments: {} }),
        frame({ type: "tool_result", id: "t1", name: "list_deadlines", ok: true }),
        frame({ type: "text_delta", text: "Two tasks " }),
        frame({ type: "text_delta", text: "are due." }) + frame({ type: "done", message_id: "m-1" }),
      ]),
    );
    const { result } = renderHook(() => useAgentChat());
    await act(() => result.current.send("What's due?"));

    expect(result.current.conversationId).toBe("conv-1");
    expect(result.current.streaming).toBe(false);
    const reply = result.current.messages[1];
    expect(reply.content).toBe("Two tasks are due.");
    expect(reply.tools).toEqual([{ id: "t1", name: "list_deadlines", status: "done" }]);
    expect(reply.id).toBe("m-1");
  });

  it("reassembles a frame split across network chunks", async () => {
    const whole = frame({ type: "text_delta", text: "split reply" });
    secureStream.mockResolvedValueOnce(
      sse([whole.slice(0, 20), whole.slice(20), frame({ type: "done", message_id: "m" })]),
    );
    const { result } = renderHook(() => useAgentChat());
    await act(() => result.current.send("hi"));
    expect(result.current.messages[1].content).toBe("split reply");
  });

  it("creates the conversation once and reuses it for the next message", async () => {
    secureStream.mockImplementation(async () => sse([frame({ type: "done", message_id: "m" })]));
    const { result } = renderHook(() => useAgentChat());
    await act(() => result.current.send("one"));
    await act(() => result.current.send("two"));
    expect(secureFetch).toHaveBeenCalledTimes(1);
    expect(secureStream.mock.calls[1][0]).toBe("/api/v9/conversations/conv-1/messages/");
  });

  it("sends the page context with the message", async () => {
    secureStream.mockResolvedValueOnce(sse([frame({ type: "done", message_id: "m" })]));
    const { result } = renderHook(() => useAgentChat());
    await act(() => result.current.send("summarize this project", { route: "/projects/p1", project_id: "p1" }));
    const body = JSON.parse((secureStream.mock.calls[0][1] as RequestInit).body as string);
    expect(body).toEqual({ content: "summarize this project", context: { route: "/projects/p1", project_id: "p1" } });
  });

  it("does nothing for blank or over-long text", async () => {
    const { result } = renderHook(() => useAgentChat());
    await act(() => result.current.send("   "));
    await act(() => result.current.send("x".repeat(4001)));
    expect(result.current.messages).toHaveLength(0);
    expect(secureFetch).not.toHaveBeenCalled();
  });

  it.each([
    [429, { code: "stream_in_progress" }, /already in progress/],
    [429, { code: "server_busy" }, /busy/],
    [429, {}, /too quickly/],
    [403, {}, /verified creator/],
    [503, { code: "unavailable" }, /unavailable/],
    [404, {}, /no longer exists/],
  ])("shows a clear message for HTTP %s %j", async (status, body, expected) => {
    secureStream.mockResolvedValueOnce(json(status, body));
    const { result } = renderHook(() => useAgentChat());
    await act(() => result.current.send("hi"));
    expect(result.current.streaming).toBe(false);
    expect(result.current.messages[1].error).toMatch(expected);
  });

  it("shows the server's error event on the reply", async () => {
    secureStream.mockResolvedValueOnce(sse([frame({ type: "error", code: "timeout", message: "That took too long." })]));
    const { result } = renderHook(() => useAgentChat());
    await act(() => result.current.send("hi"));
    expect(result.current.messages[1].error).toBe("That took too long.");
    expect(result.current.streaming).toBe(false);
  });

  it("does not spin forever when the connection closes without done or error", async () => {
    secureStream.mockResolvedValueOnce(sse([frame({ type: "text_delta", text: "half an answ" })]));
    const { result } = renderHook(() => useAgentChat());
    await act(() => result.current.send("hi"));
    expect(result.current.streaming).toBe(false);
    expect(result.current.messages[1].content).toBe("half an answ");
    expect(result.current.messages[1].error).toMatch(/interrupted/);
  });

  it("reports a network failure", async () => {
    secureStream.mockRejectedValueOnce(new TypeError("offline"));
    const { result } = renderHook(() => useAgentChat());
    await act(() => result.current.send("hi"));
    expect(result.current.messages[1].error).toBe(NETWORK_MESSAGE);
    expect(result.current.streaming).toBe(false);
  });

  it("stop aborts the request and keeps what arrived, without showing an error", async () => {
    secureStream.mockImplementation(
      (_url: string, init: RequestInit) =>
        new Promise((_resolve, reject) => {
          init.signal!.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
        }),
    );
    const { result } = renderHook(() => useAgentChat());
    let pending: Promise<void>;
    act(() => {
      pending = result.current.send("hi");
    });
    await waitFor(() => expect(secureStream).toHaveBeenCalled());
    act(() => result.current.stop());
    await act(() => pending);
    expect(result.current.streaming).toBe(false);
    expect(result.current.messages[1].error).toBeUndefined();
  });

  it("aborts an in-flight request when the page unmounts", async () => {
    let signal: AbortSignal | undefined;
    secureStream.mockImplementation((_u: string, init: RequestInit) => {
      signal = init.signal as AbortSignal;
      return new Promise(() => {});
    });
    const { result, unmount } = renderHook(() => useAgentChat());
    act(() => {
      void result.current.send("hi");
    });
    await waitFor(() => expect(signal).toBeDefined());
    unmount();
    expect(signal!.aborted).toBe(true);
  });

  it("load fills the thread from a saved conversation", async () => {
    secureFetch.mockResolvedValueOnce(
      json(200, { id: "c9", messages: [{ id: "a", role: "user", content: "q" }, { id: "b", role: "assistant", content: "ans" }] }),
    );
    const { result } = renderHook(() => useAgentChat());
    let ok = false;
    await act(async () => {
      ok = await result.current.load("c9");
    });
    expect(ok).toBe(true);
    expect(result.current.conversationId).toBe("c9");
    expect(result.current.messages.map((m) => m.content)).toEqual(["q", "ans"]);
  });

  it("load returns false and leaves the thread alone when the conversation is missing", async () => {
    secureFetch.mockResolvedValueOnce(json(404, {}));
    const { result } = renderHook(() => useAgentChat());
    let ok = true;
    await act(async () => {
      ok = await result.current.load("nope");
    });
    expect(ok).toBe(false);
    expect(result.current.messages).toHaveLength(0);
  });
});
