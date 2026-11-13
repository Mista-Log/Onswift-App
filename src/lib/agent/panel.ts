// Small pure helpers for the Agent panel: persisted width/open state and the page context.
import type { AgentPageContext } from "@/hooks/useAgentChat";

export const PANEL_MIN_WIDTH = 320;
export const PANEL_MAX_WIDTH = 640;
export const PANEL_DEFAULT_WIDTH = 400;
export const PANEL_OPEN_KEY = "agent-panel-open";
export const PANEL_WIDTH_KEY = "agent-panel-width";

/** Keeps a dragged width inside the allowed range; junk falls back to the default. */
export function clampWidth(value: unknown): number {
  if (value === null || value === undefined || value === "") return PANEL_DEFAULT_WIDTH;
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return PANEL_DEFAULT_WIDTH;
  return Math.min(PANEL_MAX_WIDTH, Math.max(PANEL_MIN_WIDTH, Math.round(n)));
}

/** Storage can be blocked or hold junk, so every read and write is guarded. */
export function readStoredWidth(): number {
  try {
    const raw = localStorage.getItem(PANEL_WIDTH_KEY);
    return raw === null ? PANEL_DEFAULT_WIDTH : clampWidth(raw);
  } catch {
    return PANEL_DEFAULT_WIDTH;
  }
}

export function readStoredOpen(): boolean {
  try {
    return localStorage.getItem(PANEL_OPEN_KEY) === "true";
  } catch {
    return false;
  }
}

export function writeStored(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // private mode / blocked storage: the panel just won't remember
  }
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * What the Agent is told about the current page. Only the route and, on a project page, the
 * project id. The server re-checks the id against the user's own projects, so this is a hint.
 */
export function contextForPath(pathname: string): AgentPageContext {
  const match = pathname.match(/^\/projects\/([^/]+)/);
  if (match && UUID.test(match[1])) return { route: pathname, project_id: match[1] };
  // A form's own page only (not /forms/new, not its responses): "this form" then means this one.
  const form = pathname.match(/^\/forms\/([^/]+)\/?$/);
  if (form && UUID.test(form[1])) return { route: pathname, form_id: form[1] };
  return { route: pathname };
}
