/**
 * Profile links are typed in by people and shown to others, so only ever render real web links:
 * "https://x.com/a" and "x.com/a" are fine, "javascript:alert(1)" and friends are not.
 */
export function safeHref(raw?: string | null): string | null {
  const value = (raw ?? "").trim();
  if (!value) return null;
  if (/^https?:\/\//i.test(value)) return value;
  // A bare domain like "behance.net/name" gets https. Anything else (javascript:, data:, mailto: ...) is dropped.
  if (/^[^\s/:]+\.[a-z]{2,}(:\d+)?(\/\S*)?$/i.test(value)) return `https://${value}`;
  return null;
}

/** "https://www.behance.net/name" -> "behance.net/name" */
export function linkLabel(raw: string): string {
  const value = raw.trim().replace(/^https?:\/\//i, "").replace(/^www\./i, "").replace(/\/$/, "");
  return value.length > 40 ? `${value.slice(0, 39)}…` : value;
}
