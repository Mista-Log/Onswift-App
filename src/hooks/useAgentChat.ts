// One Agent conversation: creates it on first send, streams the reply, and exposes the thread.
import { useCallback, useEffect, useReducer, useRef } from "react";
import { secureFetch, secureStream } from "@/api/apiClient";
import { chatReducer, initialChatState, type Rating } from "@/lib/agent/chatReducer";
import { announceFormUpdated } from "@/lib/agent/formEvents";
import { createSseParser, type AgentAction } from "@/lib/agent/sse";

/** What the page tells the Agent about where the user is. The server re-checks it. */
export interface AgentPageContext {
  route?: string;
  project_id?: string;
  form_id?: string;
}

const MAX_CONTENT = 4000; // mirrors the server limit so the user hears about it before sending

export const NETWORK_MESSAGE = "Couldn't reach the Agent. Check your connection and try again.";

/** Turns a failed HTTP response into a sentence a creator can act on. */
export async function messageForFailure(res: Response): Promise<string> {
  let body: { code?: string; detail?: string } = {};
  try {
    body = await res.json();
  } catch {
    // body wasn't JSON; fall through to the status-based wording
  }
  if (body.code === "stream_in_progress") return "A response is already in progress. Wait for it to finish.";
  if (body.code === "server_busy") return "The Agent is busy right now. Try again in a minute.";
  if (body.code === "turn_has_changes") return "You already confirmed a change in this reply, so it can't be redone.";
  if (res.status === 429) return "You're sending messages too quickly. Wait a moment and try again.";
  if (res.status === 403) return "The Agent is only available to verified creator accounts.";
  if (res.status === 503) return "The Agent is unavailable right now. Please try again later.";
  if (res.status === 404) return "That conversation no longer exists. Start a new one.";
  if (res.status === 400 && body.detail) return body.detail;
  return "Something went wrong. Please try again.";
}

export function useAgentChat() {
  const [state, dispatch] = useReducer(chatReducer, initialChatState);
  const abortRef = useRef<AbortController | null>(null);
  const conversationRef = useRef<string | null>(null);
  conversationRef.current = state.conversationId;
  const streamingRef = useRef(false);
  streamingRef.current = state.streaming;
  const stateRef = useRef(state);
  stateRef.current = state;
  // Counts open/reset requests, so a slow "open this chat" that was overtaken cannot overwrite the newer one.
  const openSeq = useRef(0);

  // Leaving the page cancels the upstream call, which frees the user's stream slot on the server.
  useEffect(() => () => abortRef.current?.abort(), []);

  /** Puts the thread back as the server has it, after a retry/edit that screen had already cut. */
  const restoreThread = useCallback(async (conversationId: string) => {
    try {
      const res = await secureFetch(`/api/v9/conversations/${conversationId}/`);
      if (!res.ok) return;
      const data = await res.json();
      dispatch({ type: "load", conversationId, messages: data.messages, actions: data.actions });
    } catch {
      // Offline as well: the error message below is all the user gets.
    }
  }, []);

  /** `replace` redoes the newest turn (retry, or edit with new text) instead of adding one. */
  const send = useCallback(async (text: string, context?: AgentPageContext, options?: { replace?: boolean }) => {
    const content = text.trim();
    if (!content || content.length > MAX_CONTENT) return;
    const replace = options?.replace === true && !!conversationRef.current;
    dispatch({ type: "send", localId: `local-${Date.now()}`, text: content, replace });

    const controller = new AbortController();
    abortRef.current = controller;
    try {
      let conversationId = conversationRef.current;
      if (!conversationId) {
        const created = await secureFetch("/api/v9/conversations/", { method: "POST", body: "{}", signal: controller.signal });
        if (!created.ok) {
          dispatch({ type: "failed", message: await messageForFailure(created) });
          return;
        }
        conversationId = (await created.json()).id as string;
        conversationRef.current = conversationId;
        dispatch({ type: "conversation_created", conversationId });
      }

      const res = await secureStream(`/api/v9/conversations/${conversationId}/messages/`, {
        method: "POST",
        body: JSON.stringify({ content, context, ...(replace ? { replace_last: true } : {}) }),
        signal: controller.signal,
      });
      if (!res.ok || !res.body) {
        const message = await messageForFailure(res);
        // The server refused, so it kept the old turn: show it again instead of the cut one.
        if (replace) await restoreThread(conversationId);
        dispatch({ type: "failed", message });
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      const parser = createSseParser();
      let finished = false;
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        for (const event of parser.push(decoder.decode(value, { stream: true }))) {
          dispatch({ type: "event", event });
          if (event.type === "done" || event.type === "error") finished = true;
        }
      }
      // The connection closed without a done/error event: don't leave the UI spinning.
      if (!finished) dispatch({ type: "failed", message: "The connection was interrupted. Please try again." });
    } catch {
      if (controller.signal.aborted) dispatch({ type: "stopped" });
      else {
        // Never reached the server (or lost it before any reply): put the old turn back.
        if (replace && conversationRef.current) await restoreThread(conversationRef.current);
        dispatch({ type: "failed", message: NETWORK_MESSAGE });
      }
    } finally {
      if (abortRef.current === controller) abortRef.current = null;
    }
  }, [restoreThread]);

  const stop = useCallback(() => abortRef.current?.abort(), []);
  const reset = useCallback(() => {
    openSeq.current += 1;
    abortRef.current?.abort();
    dispatch({ type: "reset" });
  }, []);

  /** Opens a saved conversation (from the history list, or "expand" from the panel). */
  const load = useCallback(async (conversationId: string) => {
    const mine = ++openSeq.current;
    try {
      const res = await secureFetch(`/api/v9/conversations/${conversationId}/`);
      if (!res.ok) return false;
      const data = await res.json();
      if (mine !== openSeq.current) return false; // the user opened another chat, or started a new one, meanwhile
      // Only now stop a running reply: if the chat could not be opened, the current one is left alone.
      // Without this, the old stream's late events would land in the chat that was just opened.
      abortRef.current?.abort();
      dispatch({ type: "load", conversationId, messages: data.messages, actions: data.actions });
      return true;
    } catch {
      return false;
    }
  }, []);

  /** Confirms or rejects a proposed change. The server decides what happened; the card shows its answer. */
  const resolveAction = useCallback(async (id: string, verb: "confirm" | "reject") => {
    // The cards are disabled while the Agent is writing; this keeps a stray call from getting through anyway.
    if (streamingRef.current) return;
    dispatch({ type: "action_busy", id });
    try {
      const res = await secureFetch(`/api/v9/actions/${id}/${verb}/`, { method: "POST", body: "{}" });
      let body: Partial<AgentAction> | null = null;
      try {
        body = await res.json();
      } catch {
        // no JSON body
      }
      // 200, 409, 410, 422 and 500 all carry the action's real state (executed, expired, failed...).
      if (body && body.id === id && typeof body.status === "string") {
        dispatch({ type: "action_resolved", action: body as AgentAction });
        if (body.tool === "update_form" && body.status === "executed" && body.result?.id) announceFormUpdated(body.result.id);
        return;
      }
      const message =
        res.status === 404
          ? "This change no longer exists."
          : res.status === 403
            ? "The Agent is only available to verified creator accounts."
            : "Something went wrong. Please try again.";
      dispatch({ type: "action_problem", id, message });
    } catch {
      dispatch({ type: "action_problem", id, message: NETWORK_MESSAGE });
    }
  }, []);

  /** Thumbs up / down on one of the Agent's replies (0 clears it). Shows at once; undone if the save fails. */
  const rate = useCallback(async (id: string, rating: Rating) => {
    if (id.startsWith("local-")) return; // not saved yet, so there is nothing to rate
    const previous = stateRef.current.messages.find((m) => m.id === id)?.rating ?? 0;
    dispatch({ type: "rated", id, rating });
    try {
      const res = await secureFetch(`/api/v9/messages/${id}/rating/`, { method: "POST", body: JSON.stringify({ rating }) });
      if (!res.ok) dispatch({ type: "rated", id, rating: previous });
    } catch {
      dispatch({ type: "rated", id, rating: previous });
    }
  }, []);

  return { ...state, send, stop, reset, load, resolveAction, rate };
}
