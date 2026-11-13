// State for one Agent conversation on screen. Pure reducer so it can be tested without React.
import type { AgentAction, AgentEvent } from "./sse";

/** A proposed change as shown on screen: the server's record plus two client-only flags. */
export interface ActionView extends AgentAction {
  /** A confirm or reject request is in flight. */
  busy?: boolean;
  /** Why the last attempt did not go through (network error, not found, ...). */
  problem?: string;
}

export interface ToolStep {
  id: string;
  name: string;
  status: "running" | "done" | "failed";
}

/** The creator's thumbs on a reply: 1 helpful, -1 not helpful, 0 not rated. */
export type Rating = -1 | 0 | 1;

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  tools: ToolStep[];
  /** Only on the Agent's replies. */
  rating?: Rating;
  /** Changes the Agent proposed in this reply. Absent when there are none. */
  actions?: ActionView[];
  /** Set on an assistant message that ended in an error instead of an answer. */
  error?: string;
}

export interface ChatState {
  conversationId: string | null;
  messages: ChatMessage[];
  /** True from sending until the stream ends. */
  streaming: boolean;
}

export const initialChatState: ChatState = { conversationId: null, messages: [], streaming: false };

export type ChatAction =
  | {
      type: "load";
      conversationId: string;
      messages: Array<{ id: string; role: "user" | "assistant"; content: string; rating?: Rating }>;
      actions?: AgentAction[];
    }
  | { type: "rated"; id: string; rating: Rating }
  | { type: "action_busy"; id: string }
  | { type: "action_resolved"; action: AgentAction }
  | { type: "action_problem"; id: string; message: string }
  | { type: "reset" }
  | { type: "conversation_created"; conversationId: string }
  /** `replace` redoes the newest turn (retry / edit): it and everything after it is dropped first. */
  | { type: "send"; localId: string; text: string; replace?: boolean }
  | { type: "event"; event: AgentEvent }
  | { type: "failed"; message: string }
  | { type: "stopped" };

/** Everything before the newest user message: the thread as it was before that turn. */
export function withoutLatestTurn(messages: ChatMessage[]): ChatMessage[] {
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role === "user") return messages.slice(0, i);
  }
  return messages;
}

function lastAssistant(state: ChatState): ChatMessage | undefined {
  const last = state.messages[state.messages.length - 1];
  return last && last.role === "assistant" ? last : undefined;
}

function updateLast(state: ChatState, change: (m: ChatMessage) => ChatMessage): ChatState {
  const last = lastAssistant(state);
  if (!last) return state;
  return { ...state, messages: [...state.messages.slice(0, -1), change(last)] };
}

/** Applies `change` to the action with this id wherever it appears in the thread. */
function updateAction(state: ChatState, id: string, change: (a: ActionView) => ActionView): ChatState {
  return {
    ...state,
    messages: state.messages.map((m) =>
      m.actions?.some((a) => a.id === id) ? { ...m, actions: m.actions.map((a) => (a.id === id ? change(a) : a)) } : m,
    ),
  };
}

export function chatReducer(state: ChatState, action: ChatAction): ChatState {
  switch (action.type) {
    case "reset":
      return initialChatState;

    case "load": {
      const messages: ChatMessage[] = action.messages.map((m) => ({ ...m, tools: [] }));
      // The server doesn't say which reply an action came from, so they all show under the latest one.
      const last = messages[messages.length - 1];
      if (action.actions?.length && last && last.role === "assistant") {
        messages[messages.length - 1] = { ...last, actions: action.actions };
      }
      return { conversationId: action.conversationId, streaming: false, messages };
    }

    case "rated":
      return { ...state, messages: state.messages.map((m) => (m.id === action.id ? { ...m, rating: action.rating } : m)) };

    case "action_busy":
      return updateAction(state, action.id, (a) => ({ ...a, busy: true, problem: undefined }));

    case "action_resolved":
      return updateAction(state, action.action.id, () => ({ ...action.action }));

    case "action_problem":
      return updateAction(state, action.id, (a) => ({ ...a, busy: false, problem: action.message }));

    case "conversation_created":
      return { ...state, conversationId: action.conversationId };

    case "send":
      // A second send while one is running is ignored; the server refuses it too.
      if (state.streaming) return state;
      return {
        ...state,
        streaming: true,
        messages: [
          ...(action.replace ? withoutLatestTurn(state.messages) : state.messages),
          { id: action.localId, role: "user", content: action.text, tools: [] },
          { id: `${action.localId}-reply`, role: "assistant", content: "", tools: [] },
        ],
      };

    case "event": {
      const e = action.event;
      switch (e.type) {
        case "text_delta":
          return updateLast(state, (m) => ({ ...m, content: m.content + e.text }));
        case "tool_call":
          return updateLast(state, (m) => ({
            ...m,
            tools: [...m.tools, { id: e.id, name: e.name, status: "running" }],
          }));
        case "tool_result":
          return updateLast(state, (m) => ({
            ...m,
            tools: m.tools.map((t) => (t.id === e.id ? { ...t, status: e.ok ? "done" : "failed" } : t)),
          }));
        case "action_proposed": {
          const { type: _type, ...proposed } = e;
          return updateLast(state, (m) => ({ ...m, actions: [...(m.actions ?? []), proposed] }));
        }
        case "action_superseded": {
          // An older card for the same thing was replaced by the one just proposed.
          const { type: _type, ...replaced } = e;
          return updateAction(state, replaced.id, () => replaced);
        }
        case "done":
          // Adopt the server's id so the message matches what a reload returns.
          return { ...updateLast(state, (m) => ({ ...m, id: e.message_id })), streaming: false };
        case "error":
          return { ...updateLast(state, (m) => ({ ...m, error: e.message })), streaming: false };
      }
      return state;
    }

    case "failed":
      return { ...updateLast(state, (m) => ({ ...m, error: action.message })), streaming: false };

    case "stopped":
      // The user pressed stop: keep whatever arrived, just stop streaming.
      return { ...state, streaming: false };
  }
}
