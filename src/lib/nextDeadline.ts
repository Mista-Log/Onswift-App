// One rule for "which deadline does the Next Deadline clock count down to", shared by the Talent
// dashboard and the Deadlines page so they always show the same task and the same time.

export interface DeadlineLike {
  name: string;
  /** "YYYY-MM-DD" */
  deadline: string;
  /** "HH:MM:SS"; when missing the task is due at the end of that day. */
  task_time?: string | null;
  status: string;
}

/** The moment a task is due, in the viewer's local time. */
export function deadlineInstant(row: Pick<DeadlineLike, "deadline" | "task_time">): Date {
  const [y, m, d] = row.deadline.split("-").map(Number);
  const [hh = 23, mm = 59, ss = 59] = row.task_time ? row.task_time.split(":").map(Number) : [];
  return new Date(y, m - 1, d, hh, mm, ss);
}

/**
 * The open task due soonest. An overdue task still counts (the clock then shows "Overdue"), so the
 * two clocks never disagree about whether something slipped.
 */
export function pickNextDeadline<T extends DeadlineLike>(rows: T[]): { row: T; at: Date } | undefined {
  let best: { row: T; at: Date } | undefined;
  for (const row of rows) {
    if (row.status === "completed" || !row.deadline) continue;
    const at = deadlineInstant(row);
    if (!best || at.getTime() < best.at.getTime()) best = { row, at };
  }
  return best;
}
