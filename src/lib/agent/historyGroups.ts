// Pure helpers for the chat history list: grouping by day and a short "when" label.

export interface ConversationSummary {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

export interface HistoryGroup {
  label: string;
  items: ConversationSummary[];
}

const DAY_MS = 86_400_000;

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

/** Whole calendar days between `date` and `now`, by the user's local clock. 0 = today, 1 = yesterday. */
function daysAgo(date: Date, now: Date): number {
  // Rounded, not floored: a daylight-saving change makes a calendar day 23 or 25 hours long.
  return Math.round((startOfDay(now).getTime() - startOfDay(date).getTime()) / DAY_MS);
}

function groupLabel(days: number): string {
  if (days <= 0) return "Today"; // also covers a clock that is slightly ahead of the server
  if (days === 1) return "Yesterday";
  if (days <= 7) return "Previous 7 days";
  return "Older";
}

const ORDER = ["Today", "Yesterday", "Previous 7 days", "Older"];

/** Newest first, grouped Today / Yesterday / Previous 7 days / Older. Empty groups are left out. */
export function groupByDay(items: ConversationSummary[], now: Date = new Date()): HistoryGroup[] {
  const stamp = (c: ConversationSummary) => {
    const t = new Date(c.updated_at).getTime();
    return Number.isNaN(t) ? 0 : t;
  };
  const sorted = [...items].sort((a, b) => stamp(b) - stamp(a));

  const groups = new Map<string, ConversationSummary[]>();
  for (const item of sorted) {
    const date = new Date(item.updated_at);
    const label = Number.isNaN(date.getTime()) ? "Older" : groupLabel(daysAgo(date, now));
    groups.set(label, [...(groups.get(label) ?? []), item]);
  }
  return ORDER.filter((label) => groups.has(label)).map((label) => ({ label, items: groups.get(label)! }));
}

/** "3:05 PM" for today and yesterday, "Nov 3" for anything older. */
export function whenLabel(iso: string, now: Date = new Date()): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  if (daysAgo(date, now) <= 1) return date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
