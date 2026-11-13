// The Agent message someone is still writing. Kept outside the input box so it survives opening
// another section, switching between the Agent page and the side panel, and reloading the page.
//
// Two copies: one in memory (survives moving around the app even when the browser refuses storage)
// and one in the browser's storage (survives a reload). The stored copy uses the cache prefix, so
// signing out wipes it; both copies carry the owner's id, so a draft never shows up for another
// account on the same browser.

import { readCache, writeCache, clearCache } from "@/lib/cache";

const KEY = "agent-draft";
const TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

interface Draft {
  text: string;
  owner: string;
}

let memory: Draft | null = null;

function currentOwner(): string {
  try {
    const raw = localStorage.getItem("onswift_user");
    return raw ? String(JSON.parse(raw)?.id ?? "") : "";
  } catch {
    return "";
  }
}

export function loadDraft(): string {
  const owner = currentOwner();
  if (memory && memory.owner === owner) return memory.text;
  const stored = readCache<Draft>(KEY);
  if (stored && stored.owner === owner && typeof stored.text === "string") {
    memory = stored;
    return stored.text;
  }
  return "";
}

export function saveDraft(text: string): void {
  if (!text) {
    clearDraft();
    return;
  }
  memory = { text, owner: currentOwner() };
  writeCache(KEY, memory, TTL_MS);
}

export function clearDraft(): void {
  memory = null;
  try {
    clearCache(KEY);
  } catch {
    // Storage unavailable: the in-memory copy is already gone.
  }
}
