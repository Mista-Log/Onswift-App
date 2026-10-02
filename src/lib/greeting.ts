// The line at the top of each dashboard: short, a little playful, and tied to the part of the day.
// Picked by day + part of day (not random), so it doesn't flicker when the page re-renders or polls,
// but it changes from one day to the next.

type DayPart = "morning" | "afternoon" | "evening" | "night";

// "{name}" is the first name. Keep every line short: it has to fit on a phone.
const LINES: Record<DayPart, string[]> = {
  morning: ["Rise and Shine, {name}", "Coffee first, {name}?", "Fresh Day, {name}. Let's go", "Good Morning, {name}. Ready?"],
  afternoon: ["Still going strong, {name}", "Midday momentum, {name}", "What's on your mind, {name}?", "Halfway there, {name}"],
  evening: ["Golden hour, {name}", "Finish Strong, {name}", "Winding down, {name}?", "One more push, {name}?"],
  night: ["Welcome, Night Owl!", "Burning the midnight oil, {name}?", "Still up, {name}?", "Night shift, {name}?"],
};

const PART_OFFSET: Record<DayPart, number> = { morning: 0, afternoon: 1, evening: 2, night: 3 };
const MAX_NAME_LENGTH = 16;

export function dayPart(hour: number): DayPart {
  if (hour >= 5 && hour < 12) return "morning";
  if (hour >= 12 && hour < 17) return "afternoon";
  if (hour >= 17 && hour < 21) return "evening";
  return "night";
}

/** Greeting for the viewer's local time. Without a name the name is simply left out. */
export function greeting(fullName?: string | null, now: Date = new Date()): string {
  const first = fullName?.trim().split(/\s+/)[0] ?? "";
  const name = first.length > MAX_NAME_LENGTH ? `${first.slice(0, MAX_NAME_LENGTH - 1)}…` : first;

  const part = dayPart(now.getHours());
  const dayOfYear = Math.floor((now.getTime() - new Date(now.getFullYear(), 0, 0).getTime()) / 86_400_000);
  const pool = LINES[part];
  const line = pool[(dayOfYear + PART_OFFSET[part]) % pool.length];

  return name ? line.replace("{name}", name) : line.replace(", {name}", "");
}
