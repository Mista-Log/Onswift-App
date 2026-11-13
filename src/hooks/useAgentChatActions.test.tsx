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
const frame = (event: object) => `data: ${JSON.stringify(event)}\n\n`;

function sse(chunks: string[]) {
  const enc = new TextEncoder();
  return new Response(
    new ReadableStream<Uint8Array>({
      start(c) {
        chunks.forEach((t) => c.enqueue(enc.encode(t)));
        c.close();
      },
    }),
    { status: 200, headers: { "Content-Type": "text/event-stream" } },
  );
}

const action = (over: object = {}) => ({
  id: "a1", tool: "create_project", summary: 'Create the project "X"', arguments: { name: "X" },
  status: "pending", result: null, error: "", expires_at: null, ...over,
});

/** A hook that has already received one proposal, with fetch answering conversation creation. */
async function withProposal() {
  secureFetch.mockResolvedValue(json(201, { id: "conv-1" }));
  secureStream.mockResolvedValueOnce(
    sse([frame({ type: "action_proposed", ...action() }), frame({ type: "done", message_id: "m" })]),
  );
  const hook = renderHook(() => useAgentChat());
  await act(() => hook.result.current.send("make a project"));
  secureFetch.mockReset();
  return hook;
}

const card = (hook: Awaited<ReturnType<typeof withProposal>>) => hook.result.current.messages[1].actions![0];

beforeEach(() => {
  secureFetch.mockReset();
  secureStream.mockReset();
});

describe("resolveAction", () => {
  it("a proposal from the stream shows up as a pending card", async () => {
    const hook = await withProposal();
    expect(card(hook)).toMatchObject({ id: "a1", status: "pending" });
  });

  it("confirm posts to the confirm endpoint and shows the executed result", async () => {
    const hook = await withProposal();
    secureFetch.mockResolvedValueOnce(json(200, action({ status: "executed", result: { link: "/projects/p1" } })));
    await act(() => hook.result.current.resolveAction("a1", "confirm"));
    expect(secureFetch).toHaveBeenCalledWith("/api/v9/actions/a1/confirm/", expect.objectContaining({ method: "POST" }));
    expect(card(hook)).toMatchObject({ status: "executed", result: { link: "/projects/p1" } });
    expect(card(hook).busy).toBeFalsy();
  });

  it("reject posts to the reject endpoint", async () => {
    const hook = await withProposal();
    secureFetch.mockResolvedValueOnce(json(200, action({ status: "rejected" })));
    await act(() => hook.result.current.resolveAction("a1", "reject"));
    expect(secureFetch).toHaveBeenCalledWith("/api/v9/actions/a1/reject/", expect.objectContaining({ method: "POST" }));
    expect(card(hook).status).toBe("rejected");
  });

  it("shows the server's state for an expired answer, not a generic error", async () => {
    const hook = await withProposal();
    secureFetch.mockResolvedValueOnce(json(410, action({ status: "expired" })));
    await act(() => hook.result.current.resolveAction("a1", "confirm"));
    expect(card(hook).status).toBe("expired");
  });

  it("shows the server's reason for a failed answer", async () => {
    const hook = await withProposal();
    secureFetch.mockResolvedValueOnce(json(422, action({ status: "failed", error: "Project not found." })));
    await act(() => hook.result.current.resolveAction("a1", "confirm"));
    expect(card(hook)).toMatchObject({ status: "failed", error: "Project not found." });
  });

  it("a 404 leaves it pending with an explanation", async () => {
    const hook = await withProposal();
    secureFetch.mockResolvedValueOnce(json(404, { detail: "Not found." }));
    await act(() => hook.result.current.resolveAction("a1", "confirm"));
    expect(card(hook)).toMatchObject({ status: "pending", busy: false, problem: "This change no longer exists." });
  });

  it("a network failure leaves it pending so the user can try again", async () => {
    const hook = await withProposal();
    secureFetch.mockRejectedValueOnce(new Error("offline"));
    await act(() => hook.result.current.resolveAction("a1", "confirm"));
    expect(card(hook)).toMatchObject({ status: "pending", busy: false, problem: NETWORK_MESSAGE });
  });

  it("ignores an answer about a different action", async () => {
    const hook = await withProposal();
    secureFetch.mockResolvedValueOnce(json(200, action({ id: "someone-else", status: "executed" })));
    await act(() => hook.result.current.resolveAction("a1", "confirm"));
    expect(card(hook).status).toBe("pending");
    expect(card(hook).problem).toBeTruthy();
  });

  it("a saved conversation brings its actions back on load", async () => {
    secureFetch.mockResolvedValueOnce(
      json(200, {
        messages: [{ id: "m1", role: "user", content: "hi" }, { id: "m2", role: "assistant", content: "ok" }],
        actions: [action()],
      }),
    );
    const { result } = renderHook(() => useAgentChat());
    await act(() => result.current.load("conv-9"));
    expect(result.current.messages[1].actions).toEqual([action()]);
  });
});

/** A stream the test controls: it stays open until close() is called. */
function openStream() {
  const enc = new TextEncoder();
  let controller!: ReadableStreamDefaultController<Uint8Array>;
  const response = new Response(
    new ReadableStream<Uint8Array>({ start: (c) => { controller = c; } }),
    { status: 200, headers: { "Content-Type": "text/event-stream" } },
  );
  return { response, push: (f: string) => controller.enqueue(enc.encode(f)), close: () => controller.close() };
}

/** A hook in the middle of a reply that has already proposed a change. */
async function midReply() {
  const stream = openStream();
  secureFetch.mockResolvedValue(json(201, { id: "conv-1" }));
  secureStream.mockResolvedValueOnce(stream.response);
  const hook = renderHook(() => useAgentChat());
  let sending: Promise<void> = Promise.resolve();
  act(() => {
    sending = hook.result.current.send("make a project");
  });
  await waitFor(() => expect(secureStream).toHaveBeenCalled());
  await act(async () => {
    stream.push(frame({ type: "action_proposed", ...action() }));
  });
  await waitFor(() => expect(hook.result.current.messages[1]?.actions).toHaveLength(1));
  secureFetch.mockReset();
  return { hook, stream, finish: () => sending };
}

const sentSignal = () => (secureStream.mock.calls[0][1] as { signal: AbortSignal }).signal;

describe("resolveAction while the reply is still streaming", () => {
  it("ignores confirm and reject until the reply has finished, then works", async () => {
    const { hook, stream, finish } = await midReply();
    expect(hook.result.current.streaming).toBe(true);

    await act(() => hook.result.current.resolveAction("a1", "confirm"));
    await act(() => hook.result.current.resolveAction("a1", "reject"));
    expect(secureFetch).not.toHaveBeenCalled();
    expect(hook.result.current.messages[1].actions![0].busy).toBeFalsy();

    secureFetch.mockResolvedValueOnce(json(200, action({ status: "executed" })));
    await act(async () => {
      stream.push(frame({ type: "done", message_id: "m" }));
      stream.close();
      await finish();
    });
    expect(hook.result.current.streaming).toBe(false);
    await act(() => hook.result.current.resolveAction("a1", "confirm"));
    expect(secureFetch).toHaveBeenCalledWith("/api/v9/actions/a1/confirm/", expect.objectContaining({ method: "POST" }));
  });
});

describe("load (reopening a past chat)", () => {
  const chat = (id: string) => json(200, { id, messages: [{ id: `${id}-m`, role: "user", content: `from ${id}` }], actions: [] });

  it("stops a reply that is still running once the other chat has arrived", async () => {
    const { hook } = await midReply();
    secureFetch.mockResolvedValueOnce(chat("conv-9"));
    let opened = false;
    await act(async () => {
      opened = await hook.result.current.load("conv-9");
    });
    expect(opened).toBe(true);
    expect(sentSignal().aborted).toBe(true);
    expect(hook.result.current.conversationId).toBe("conv-9");
    expect(hook.result.current.messages.map((m) => m.content)).toEqual(["from conv-9"]);
  });

  it("leaves the running reply alone when the chat cannot be opened", async () => {
    const { hook } = await midReply();
    secureFetch.mockResolvedValueOnce(json(404, { detail: "Not found." }));
    let opened = true;
    await act(async () => {
      opened = await hook.result.current.load("gone");
    });
    expect(opened).toBe(false);
    expect(sentSignal().aborted).toBe(false);
    expect(hook.result.current.streaming).toBe(true);
    expect(hook.result.current.conversationId).toBe("conv-1");
  });

  it("reports false instead of throwing when the network fails", async () => {
    const hook = renderHook(() => useAgentChat());
    secureFetch.mockRejectedValueOnce(new Error("offline"));
    let opened = true;
    await act(async () => {
      opened = await hook.result.current.load("conv-9");
    });
    expect(opened).toBe(false);
  });

  it("an older open that finishes late does not overwrite the newer one", async () => {
    const hook = renderHook(() => useAgentChat());
    let releaseFirst!: (r: Response) => void;
    secureFetch
      .mockReturnValueOnce(new Promise<Response>((resolve) => { releaseFirst = resolve; }))
      .mockResolvedValueOnce(chat("second"));
    let first!: Promise<boolean>;
    act(() => {
      first = hook.result.current.load("first");
    });
    await act(async () => {
      await hook.result.current.load("second");
    });
    await act(async () => {
      releaseFirst(chat("first"));
      expect(await first).toBe(false);
    });
    expect(hook.result.current.conversationId).toBe("second");
  });

  it("starting a new chat while one is still opening wins", async () => {
    const hook = renderHook(() => useAgentChat());
    let release!: (r: Response) => void;
    secureFetch.mockReturnValueOnce(new Promise<Response>((resolve) => { release = resolve; }));
    let opening!: Promise<boolean>;
    act(() => {
      opening = hook.result.current.load("slow");
    });
    act(() => hook.result.current.reset());
    await act(async () => {
      release(chat("slow"));
      expect(await opening).toBe(false);
    });
    expect(hook.result.current.conversationId).toBeNull();
    expect(hook.result.current.messages).toEqual([]);
  });
});
