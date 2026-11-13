import { describe, expect, it } from "vitest";
import { createSseParser } from "./sse";

const frame = (event: object) => `event: x\ndata: ${JSON.stringify(event)}\n\n`;

describe("createSseParser", () => {
  it("parses one complete frame", () => {
    const p = createSseParser();
    expect(p.push(frame({ type: "text_delta", text: "Hi" }))).toEqual([{ type: "text_delta", text: "Hi" }]);
  });

  it("parses several frames delivered in one chunk, in order", () => {
    const p = createSseParser();
    const out = p.push(frame({ type: "text_delta", text: "a" }) + frame({ type: "done", message_id: "m1" }));
    expect(out.map((e) => e.type)).toEqual(["text_delta", "done"]);
  });

  it("holds a frame split across chunks until it is complete", () => {
    const p = createSseParser();
    const whole = frame({ type: "text_delta", text: "split" });
    const cut = Math.floor(whole.length / 2);
    expect(p.push(whole.slice(0, cut))).toEqual([]);
    expect(p.push(whole.slice(cut))).toEqual([{ type: "text_delta", text: "split" }]);
  });

  it("copes with a chunk boundary between the two newlines that end a frame", () => {
    const p = createSseParser();
    const whole = frame({ type: "done", message_id: "m" });
    expect(p.push(whole.slice(0, -1))).toEqual([]);
    expect(p.push(whole.slice(-1))).toEqual([{ type: "done", message_id: "m" }]);
  });

  it("accepts CRLF line endings", () => {
    const p = createSseParser();
    const crlf = frame({ type: "text_delta", text: "x" }).replace(/\n/g, "\r\n");
    expect(p.push(crlf)).toEqual([{ type: "text_delta", text: "x" }]);
  });

  it("skips malformed JSON without throwing and keeps later frames", () => {
    const p = createSseParser();
    const out = p.push("data: {not json\n\n" + frame({ type: "done", message_id: "m" }));
    expect(out).toEqual([{ type: "done", message_id: "m" }]);
  });

  it("drops event types it does not know", () => {
    const p = createSseParser();
    expect(p.push(frame({ type: "from_the_future", x: 1 }))).toEqual([]);
  });

  it("ignores keep-alive comment frames", () => {
    const p = createSseParser();
    expect(p.push(": keep-alive\n\n")).toEqual([]);
  });

  it("keeps text that contains newlines and unicode intact", () => {
    const p = createSseParser();
    const text = "line one\nline two ✓";
    expect(p.push(frame({ type: "text_delta", text }))).toEqual([{ type: "text_delta", text }]);
  });
});
