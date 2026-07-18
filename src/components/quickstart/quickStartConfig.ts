/**
 * quickStartConfig — single source of truth for the creator "Quick Start"
 * checklist shown in the floating QuickStartLauncher.
 *
 * Each item points at an existing feature. `doneFlag` is a localStorage key that,
 * when set to "1", marks the item complete (struck through). The first three
 * flags are already written by the existing first-time milestone celebrations
 * (Projects.tsx, ProjectDetail.tsx, Team.tsx) — the launcher only reads them.
 */
export interface QuickStartItem {
  id: string;
  label: string;
  description: string;
  href: string;
  doneFlag: string;
}

export const QUICK_START_ITEMS: QuickStartItem[] = [
  {
    id: "project",
    label: "Create your first project",
    description: "Spin up a workspace to organise your team's work.",
    href: "/projects",
    doneFlag: "onswift_celebrated_first_project",
  },
  {
    id: "task",
    label: "Add your first task",
    description: "Break the project into trackable pieces of work.",
    href: "/projects",
    doneFlag: "onswift_celebrated_first_task",
  },
  {
    id: "invite",
    label: "Invite a teammate",
    description: "Bring talent onto your team to get work moving.",
    href: "/team",
    doneFlag: "onswift_celebrated_first_invite",
  },
  {
    id: "docs",
    label: "Try out Docs",
    description: "Draft briefs and notes in a live collaborative doc.",
    href: "/docs",
    doneFlag: "onswift_quickstart_docs",
  },
  {
    id: "onboarding",
    label: "Create your first client onboarding form",
    description: "Collect what you need from a client in one link.",
    href: "/onboarding",
    doneFlag: "onswift_quickstart_onboarding",
  },
];

/** localStorage keys for launcher-level state (not tied to a single item). */
export const QUICK_START_KEYS = {
  dismissed: "onswift_quickstart_dismissed",
  rewarded: "onswift_quickstart_rewarded",
  open: "onswift_quickstart_open",
} as const;
