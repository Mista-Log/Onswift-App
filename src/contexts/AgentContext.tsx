// Shared Agent state: one conversation and one stream for both the /chat page and the side panel.
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useAgentChat } from "@/hooks/useAgentChat";
import {
  PANEL_OPEN_KEY, PANEL_WIDTH_KEY, clampWidth, contextForPath, readStoredOpen, readStoredWidth, writeStored,
} from "@/lib/agent/panel";

type AgentChat = ReturnType<typeof useAgentChat>;

interface AgentContextValue extends Omit<AgentChat, "send"> {
  /** Creators only. Everyone else gets false and the UI hides the Agent entirely. */
  enabled: boolean;
  /** Sends a message with the current page as context. */
  send: (text: string) => Promise<void>;
  /** Runs the newest message again for a fresh answer. */
  retry: () => Promise<void>;
  /** Replaces the newest message with new text and runs it. */
  editLast: (text: string) => Promise<void>;
  panelOpen: boolean;
  panelWidth: number;
  setPanelOpen: (open: boolean) => void;
  togglePanel: () => void;
  setPanelWidth: (width: number) => void;
}

const AgentContext = createContext<AgentContextValue | null>(null);

export function AgentProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const location = useLocation();
  const chat = useAgentChat();
  const enabled = user?.role === "creator";

  const [panelOpen, setOpenState] = useState(readStoredOpen);
  const [panelWidth, setWidthState] = useState(readStoredWidth);

  const setPanelOpen = useCallback((open: boolean) => {
    setOpenState(open);
    writeStored(PANEL_OPEN_KEY, String(open));
  }, []);
  const togglePanel = useCallback(() => setPanelOpen(!panelOpen), [panelOpen, setPanelOpen]);
  const setPanelWidth = useCallback((width: number) => {
    const clamped = clampWidth(width);
    setWidthState(clamped);
    writeStored(PANEL_WIDTH_KEY, String(clamped));
  }, []);

  // A different person signing in on the same browser must not inherit the previous conversation.
  const userId = user?.id;
  const { reset } = chat;
  useEffect(() => {
    reset();
  }, [userId, reset]);

  const { send: sendRaw } = chat;
  const pathname = location.pathname;
  const send = useCallback((text: string) => sendRaw(text, contextForPath(pathname)), [sendRaw, pathname]);
  const editLast = useCallback(
    (text: string) => sendRaw(text, contextForPath(pathname), { replace: true }),
    [sendRaw, pathname],
  );
  const { messages } = chat;
  const retry = useCallback(async () => {
    const lastUser = [...messages].reverse().find((m) => m.role === "user");
    if (lastUser) await sendRaw(lastUser.content, contextForPath(pathname), { replace: true });
  }, [messages, sendRaw, pathname]);

  const value = useMemo<AgentContextValue>(
    () => ({ ...chat, enabled, send, retry, editLast, panelOpen, panelWidth, setPanelOpen, togglePanel, setPanelWidth }),
    [chat, enabled, send, retry, editLast, panelOpen, panelWidth, setPanelOpen, togglePanel, setPanelWidth],
  );

  return <AgentContext.Provider value={value}>{children}</AgentContext.Provider>;
}

/** For shared chrome (layout, top bar) that must also render where no provider exists, e.g. in tests. */
export function useOptionalAgent(): AgentContextValue | null {
  return useContext(AgentContext);
}

export function useAgent(): AgentContextValue {
  const ctx = useContext(AgentContext);
  if (!ctx) throw new Error("useAgent must be used inside <AgentProvider>");
  return ctx;
}
