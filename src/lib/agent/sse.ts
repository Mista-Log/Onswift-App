// Parser for the Agent's server-sent events. Pure: it takes text chunks as they arrive and
// returns complete events, keeping any half-received frame for the next chunk.

/** A change the Agent proposed. Nothing happens until the user confirms it. Mirrors the server's describe(). */
export interface AgentAction {
  id: string;
  tool: string;
  summary: string;
  arguments: Record<string, unknown>;
  status: "pending" | "confirmed" | "rejected" | "executed" | "failed" | "expired" | "superseded";
  /** What the change will do, in words, for tools whose arguments only carry ids (e.g. update_form). */
  preview?: PreviewItem[] | null;
  result: { id?: string; link?: string; name?: string } | null;
  error: string;
  expires_at: string | null;
}

export interface PreviewItem {
  change: string;
  label: string;
  type?: string;
  detail?: string;
}

export type AgentEvent =
  | ({ type: "action_proposed" } & AgentAction)
  | ({ type: "action_superseded" } & AgentAction)
  | { type: "text_delta"; text: string }
  | { type: "tool_call"; id: string; name: string; arguments: Record<string, unknown> }
  | { type: "tool_result"; id: string; name: string; ok: boolean }
  | { type: "done"; message_id: string }
  | { type: "error"; code: string; message: string };

const KNOWN = new Set(["text_delta", "tool_call", "tool_result", "action_proposed", "action_superseded", "done", "error"]);

export interface SseParser {
  /** Feed the next chunk of text; returns every event that is now complete. */
  push(chunk: string): AgentEvent[];
}

export function createSseParser(): SseParser {
  let buffer = "";

  return {
    push(chunk) {
      // Frames end with a blank line. Normalise CRLF so either style works.
      buffer += chunk.replace(/\r\n/g, "\n");
      const frames = buffer.split("\n\n");
      buffer = frames.pop() ?? ""; // the last piece is incomplete (or empty)

      const events: AgentEvent[] = [];
      for (const frame of frames) {
        const dataLines = frame
          .split("\n")
          .filter((line) => line.startsWith("data:"))
          .map((line) => line.slice(5).trimStart());
        if (dataLines.length === 0) continue; // comment / keep-alive frame
        try {
          const parsed = JSON.parse(dataLines.join("\n"));
          // Unknown or malformed events are dropped, never thrown: a newer server must not
          // break an older client.
          if (parsed && typeof parsed.type === "string" && KNOWN.has(parsed.type)) {
            events.push(parsed as AgentEvent);
          }
        } catch {
          // ignore a frame that isn't valid JSON
        }
      }
      return events;
    },
  };
}
