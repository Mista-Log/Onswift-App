import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowRight,
  BarChart3,
  Bell,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  Circle,
  ClipboardList,
  Clock,
  File,
  FileText,
  FolderKanban,
  LayoutGrid,
  MessageCircle,
  MoreVertical,
  PlayCircle,
  Plus,
  Search,
  Send,
  Settings,
  TrendingDown,
  TrendingUp,
  Users,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Interactive, dummy-data replica of the creator Workspace for the landing hero.
 * Drawn on a fixed 1120×660 canvas and scaled to the container, so it looks identical at every
 * width. Colours are hardcoded to the app's light theme so the landing page theme can't change it.
 */

const W = 1120;
const H = 660;
const PRIMARY = "hsl(250 76% 63%)";

// ─── Dummy data ──────────────────────────────────────────────────────────────

type Stage = "planning" | "in-progress" | "completed";
type View = "workspace" | "projects" | "analytics" | "chats" | "deadlines" | "locked";
type Period = "7d" | "30d" | "90d";
const PERIOD_LABELS: Record<Period, string> = { "7d": "Last 7 days", "30d": "Last 30 days", "90d": "Last 90 days" };

const dayOffset = (days: number) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d;
};
const iso = (days: number) => {
  const d = dayOffset(days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const avatar = (seed: string) => `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(seed)}`;

const TEAM = [
  { id: "t1", name: "Amara Okafor", role: "Brand Designer" },
  { id: "t2", name: "Leo Martins", role: "Product Designer" },
  { id: "t3", name: "Priya Shah", role: "Performance Marketer" },
];

const PROJECTS = [
  { id: "p1", name: "Brand Refresh for Northwind Studio", due: 18, status: "in-progress" as Stage, progress: 64, team: ["t1", "t2"] },
  { id: "p2", name: "Q4 LinkedIn Content Sprint", due: 32, status: "in-progress" as Stage, progress: 38, team: ["t3", "t1"] },
  { id: "p3", name: "Website Redesign – Halcyon Foods", due: 9, status: "in-progress" as Stage, progress: 81, team: ["t2", "t3", "t1"] },
  { id: "p4", name: "Launch Video – Pulse Fitness", due: 45, status: "planning" as Stage, progress: 10, team: ["t3"] },
  { id: "p5", name: "Investor Pitch Deck – Lumen Labs", due: -6, status: "completed" as Stage, progress: 100, team: ["t1", "t2"] },
];

const INITIAL_TASKS = [
  { id: "k1", name: "Review homepage wireframes", project: "Website Redesign", due: 0, status: "in-progress" as Stage },
  { id: "k2", name: "Finalize logo concepts", project: "Brand Refresh", due: 1, status: "in-progress" as Stage },
  { id: "k3", name: "Approve ad creatives", project: "Q4 LinkedIn", due: 2, status: "planning" as Stage },
  { id: "k4", name: "Draft October content calendar", project: "Q4 LinkedIn", due: 3, status: "planning" as Stage },
  { id: "k5", name: "Send invoice to Halcyon Foods", project: "Personal", due: 6, status: "planning" as Stage },
  { id: "k6", name: "Kickoff call with Northwind", project: "Brand Refresh", due: -4, status: "completed" as Stage },
  { id: "k7", name: "Set up client portal for Halcyon", project: "Website Redesign", due: -2, status: "completed" as Stage },
];

const NOTIFICATIONS = [
  { id: "n1", text: "Amara uploaded 3 logo concepts", time: "2m ago" },
  { id: "n2", text: "Halcyon Foods approved the sitemap", time: "1h ago" },
  { id: "n3", text: "Priya completed “Audience research”", time: "3h ago" },
];

const INITIAL_CHATS: Record<string, { from: "me" | "them"; text: string }[]> = {
  t1: [
    { from: "them", text: "Logo concepts are up in Files 🎨" },
    { from: "me", text: "Love option B. Can we try a bolder weight?" },
    { from: "them", text: "On it, sending a revision by noon." },
  ],
  t2: [
    { from: "them", text: "Wireframes for the Halcyon homepage are ready." },
    { from: "me", text: "Great, reviewing them today." },
  ],
  t3: [{ from: "them", text: "Ad set A is outperforming B by 22% so far." }],
};

// Analytics dummy data, one set per period so the toggle visibly changes the numbers.
const ANALYTICS: Record<
  Period,
  {
    stats: { label: string; value: string; delta: number }[];
    chartLabel: string;
    bars: { label: string; done: number; created: number }[];
    workload: { id: string; tasks: number; onTime: number }[];
  }
> = {
  "7d": {
    stats: [
      { label: "Tasks completed", value: "23", delta: 12 },
      { label: "On-time delivery", value: "94%", delta: 3 },
      { label: "Active projects", value: "4", delta: 0 },
      { label: "Avg. turnaround", value: "1.8d", delta: -9 },
    ],
    chartLabel: "Tasks per day",
    bars: [
      { label: "Mon", done: 4, created: 5 },
      { label: "Tue", done: 6, created: 4 },
      { label: "Wed", done: 3, created: 6 },
      { label: "Thu", done: 5, created: 3 },
      { label: "Fri", done: 7, created: 5 },
      { label: "Sat", done: 1, created: 1 },
      { label: "Sun", done: 2, created: 0 },
    ],
    workload: [
      { id: "t1", tasks: 9, onTime: 100 },
      { id: "t2", tasks: 7, onTime: 86 },
      { id: "t3", tasks: 6, onTime: 92 },
    ],
  },
  "30d": {
    stats: [
      { label: "Tasks completed", value: "86", delta: 18 },
      { label: "On-time delivery", value: "91%", delta: 5 },
      { label: "Active projects", value: "4", delta: 33 },
      { label: "Avg. turnaround", value: "2.1d", delta: -14 },
    ],
    chartLabel: "Tasks per week",
    bars: [
      { label: "Wk 1", done: 17, created: 21 },
      { label: "Wk 2", done: 22, created: 19 },
      { label: "Wk 3", done: 19, created: 24 },
      { label: "Wk 4", done: 28, created: 22 },
    ],
    workload: [
      { id: "t1", tasks: 34, onTime: 94 },
      { id: "t2", tasks: 27, onTime: 89 },
      { id: "t3", tasks: 25, onTime: 88 },
    ],
  },
  "90d": {
    stats: [
      { label: "Tasks completed", value: "241", delta: 27 },
      { label: "On-time delivery", value: "89%", delta: 7 },
      { label: "Active projects", value: "4", delta: 100 },
      { label: "Avg. turnaround", value: "2.4d", delta: -21 },
    ],
    chartLabel: "Tasks per month",
    bars: [
      { label: "Month 1", done: 64, created: 72 },
      { label: "Month 2", done: 91, created: 85 },
      { label: "Month 3", done: 86, created: 94 },
    ],
    workload: [
      { id: "t1", tasks: 96, onTime: 92 },
      { id: "t2", tasks: 78, onTime: 87 },
      { id: "t3", tasks: 67, onTime: 86 },
    ],
  },
};

const AUTO_REPLIES =["Got it 👍", "Sounds good, I'll update the task.", "Will do!", "On it."];

const NAV = [
  { key: "workspace", label: "Workspace", icon: LayoutGrid, view: "workspace" as View },
  { key: "projects", label: "Projects", icon: FolderKanban, view: "projects" as View },
  { key: "analytics", label: "Analytics", icon: BarChart3, view: "analytics" as View },
  { key: "teams", label: "Teams", icon: Users, view: "locked" as View },
  { key: "chats", label: "Chats", icon: MessageCircle, view: "chats" as View },
  { key: "portal", label: "Client Portal", icon: ClipboardList, view: "locked" as View },
  { key: "forms", label: "Forms", icon: FileText, view: "locked" as View },
  { key: "files", label: "Files", icon: File, view: "locked" as View },
  { key: "deadlines", label: "Deadlines", icon: Clock, view: "deadlines" as View },
];

const greeting = (name: string) => {
  const h = new Date().getHours();
  if (h < 5) return `Welcome back, ${name}.`;
  if (h < 12) return `Good morning, ${name}!`;
  if (h < 17) return `Good afternoon, ${name}!`;
  if (h < 22) return `Good evening, ${name}!`;
  return `Welcome back, ${name}?`;
};

const dueLabel = (days: number) =>
  days < 0 ? "Overdue" : days === 0 ? "Due Today" : days === 1 ? "Due Tomorrow" : days <= 7 ? `Due in ${days} days` : `Due: ${iso(days)}`;

const memberName = (id: string) => TEAM.find((t) => t.id === id)?.name ?? "";

// ─── Small pieces ────────────────────────────────────────────────────────────

const Card = ({ className, children }: { className?: string; children: React.ReactNode }) => (
  <section
    className={cn("rounded-xl border border-[hsl(220_12%_92%/0.6)] bg-white/80", className)}
    style={{ boxShadow: "0 0 40px hsl(250 76% 63% / 0.08)" }}
  >
    {children}
  </section>
);

// Status circle: purple in progress, yellow planning, green completed. Label lives in the tooltip.
const StatusDot = ({ status }: { status: Stage }) => {
  const { label, cls } = {
    "in-progress": { label: "In Progress", cls: "bg-[hsl(250_76%_63%)]" },
    planning: { label: "Planning", cls: "bg-amber-400" },
    completed: { label: "Completed", cls: "bg-emerald-500" },
  }[status];
  return (
    <span
      role="img"
      aria-label={`Status: ${label}`}
      title={label}
      className={cn("inline-block h-3 w-3 shrink-0 rounded-full shadow-sm ring-1 ring-black/10", cls)}
    />
  );
};

const AvatarStack = ({ ids }: { ids: string[] }) => (
  <div className="flex -space-x-2">
    {ids.map((id) => (
      <img key={id} src={avatar(memberName(id))} alt={memberName(id)} className="h-7 w-7 rounded-full border-2 border-white bg-[hsl(270_10%_95%)]" />
    ))}
  </div>
);

const StageIcon = ({ status }: { status: Stage }) =>
  status === "completed" ? (
    <CheckCircle2 className="h-[18px] w-[18px] text-emerald-500" />
  ) : status === "in-progress" ? (
    <PlayCircle className="h-[18px] w-[18px]" style={{ color: PRIMARY }} />
  ) : (
    <Circle className="h-[18px] w-[18px] text-[hsl(220_12%_60%)]" />
  );

// ─── Main component ──────────────────────────────────────────────────────────

export function DashboardPreview({ userName = "Zeus" }: { userName?: string }) {
  const navigate = useNavigate();
  const wrapRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  const [view, setView] = useState<View>("workspace");
  const [period, setPeriod] = useState<Period>("30d");
  const [hoverBar, setHoverBar] = useState<number | null>(null);
  const [rangeOpen, setRangeOpen] = useState(false);
  const [activeNav, setActiveNav] = useState("workspace");
  const [lockedLabel, setLockedLabel] = useState("");
  const [tasks, setTasks] = useState(INITIAL_TASKS);
  const [taskTab, setTaskTab] = useState<"todo" | "completed">("todo");
  const [highlightProject, setHighlightProject] = useState<string | null>(null);
  const [bellOpen, setBellOpen] = useState(false);
  const [unread, setUnread] = useState(NOTIFICATIONS.length);
  const [query, setQuery] = useState("");
  const [chatWith, setChatWith] = useState("t1");
  const [chats, setChats] = useState(INITIAL_CHATS);
  const [draft, setDraft] = useState("");
  const [typing, setTyping] = useState(false);
  const [nudge, setNudge] = useState<string | null>(null);
  const chatScrollRef = useRef<HTMLDivElement>(null);
  const replyTimer = useRef<ReturnType<typeof setTimeout>>();
  const nudgeTimer = useRef<ReturnType<typeof setTimeout>>();

  // Fit the fixed canvas to whatever width the hero gives us.
  useLayoutEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const update = () => setScale(el.clientWidth / W);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Keep the chat pinned to the newest message (scrolls the chat box only, never the landing page).
  useEffect(() => {
    const el = chatScrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [chats, chatWith, typing, view]);
  useEffect(() => () => { clearTimeout(replyTimer.current); clearTimeout(nudgeTimer.current); }, []);

  const showNudge = (text: string) => {
    setNudge(text);
    clearTimeout(nudgeTimer.current);
    nudgeTimer.current = setTimeout(() => setNudge(null), 3500);
  };

  const go = (navKey: string, next: View, label = "") => {
    setActiveNav(navKey);
    setView(next);
    setLockedLabel(label);
    setBellOpen(false);
    setRangeOpen(false);
    setQuery("");
    setHighlightProject(null);
  };

  const cycleTask = (id: string) =>
    setTasks((prev) =>
      prev.map((t) =>
        t.id === id
          ? { ...t, status: t.status === "planning" ? "in-progress" : t.status === "in-progress" ? "completed" : "planning" }
          : t
      )
    );

  const sendMessage = () => {
    const text = draft.trim();
    if (!text) return;
    const to = chatWith;
    setChats((c) => ({ ...c, [to]: [...c[to], { from: "me", text }] }));
    setDraft("");
    setTyping(true);
    clearTimeout(replyTimer.current);
    replyTimer.current = setTimeout(() => {
      setTyping(false);
      setChats((c) => ({ ...c, [to]: [...c[to], { from: "them", text: AUTO_REPLIES[c[to].length % AUTO_REPLIES.length] }] }));
    }, 1200);
  };

  const openProject = (id: string) => {
    go("projects", "projects");
    setHighlightProject(id);
  };

  const openChat = (id: string) => {
    go("chats", "chats");
    setChatWith(id);
  };

  const todoCount = tasks.filter((t) => t.status !== "completed").length;
  const doneCount = tasks.length - todoCount;
  const visibleTasks = tasks.filter((t) => (taskTab === "todo" ? t.status !== "completed" : t.status === "completed"));
  const activeProjects = PROJECTS.filter((p) => p.status !== "completed").slice(0, 3);
  const deadlineCount = todoCount + activeProjects.length;

  const searchResults = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return null;
    return {
      projects: PROJECTS.filter((p) => p.name.toLowerCase().includes(q)),
      talents: TEAM.filter((t) => t.name.toLowerCase().includes(q) || t.role.toLowerCase().includes(q)),
    };
  }, [query]);

  // ─── Views ─────────────────────────────────────────────────────────────────

  const workspace = (
    <div className="space-y-5">
      <h1 className="text-[22px] font-bold text-[hsl(220_15%_8%)]">{greeting(userName)}</h1>
      <div className="grid grid-cols-3 gap-5">
        <div className="col-span-2 min-w-0 space-y-5">
          <Card className="space-y-4 p-5">
            <div className="flex items-center justify-between">
              <h2 className="text-[15px] font-semibold text-[hsl(220_15%_8%)]">Active Projects</h2>
              <button
                type="button"
                onClick={() => go("projects", "projects")}
                className="rounded-md px-2 py-1 text-[12px] font-medium text-[hsl(220_12%_40%)] transition-colors hover:bg-[hsl(270_10%_95%)] hover:text-[hsl(220_15%_8%)]"
              >
                View All
              </button>
            </div>
            <div className="space-y-2.5">
              {activeProjects.map((p) => (
                <div
                  key={p.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => openProject(p.id)}
                  onKeyDown={(e) => e.key === "Enter" && openProject(p.id)}
                  className="group flex cursor-pointer items-center justify-between gap-3 rounded-xl border border-[hsl(220_12%_92%/0.6)] bg-white/80 px-3.5 py-3 transition-all duration-300 hover:border-[hsl(250_76%_63%/0.4)] hover:shadow-[0_0_40px_hsl(250_76%_63%/0.22)]"
                >
                  <div className="min-w-0">
                    <h3 className="truncate text-[13px] font-semibold text-[hsl(220_15%_8%)]">{p.name}</h3>
                    <p className="mt-0.5 text-[11px] text-[hsl(220_12%_40%)]">Due: {iso(p.due)}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <AvatarStack ids={p.team} />
                    <StatusDot status={p.status} />
                    <MoreVertical className="h-4 w-4 text-[hsl(220_12%_40%)] opacity-0 transition-opacity group-hover:opacity-100" />
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <Card className="p-5">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-[15px] font-semibold text-[hsl(220_15%_8%)]">My Tasks</h2>
              <button
                type="button"
                aria-label="Add a task"
                onClick={() => showNudge("Sign up to add your own tasks")}
                className="flex h-7 w-7 items-center justify-center rounded-lg text-white transition-opacity hover:opacity-90"
                style={{ background: PRIMARY }}
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>
            <div className="mb-3 inline-flex rounded-md bg-[hsl(210_10%_92%)] p-1">
              {(["todo", "completed"] as const).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setTaskTab(tab)}
                  className={cn(
                    "rounded-sm px-2.5 py-1 text-[11px] font-medium transition-all",
                    taskTab === tab ? "text-white shadow-sm" : "text-[hsl(220_12%_40%)] hover:text-[hsl(220_15%_8%)]"
                  )}
                  style={taskTab === tab ? { background: PRIMARY } : undefined}
                >
                  {tab === "todo" ? "To Do" : "Completed"}{" "}
                  <span className="text-[10px]">({tab === "todo" ? todoCount : doneCount})</span>
                </button>
              ))}
            </div>
            <div className="space-y-2">
              {visibleTasks.length === 0 && (
                <p className="py-6 text-center text-[12px] text-[hsl(220_12%_40%)]">
                  {taskTab === "todo" ? "You're all caught up! 🎉" : "No completed tasks yet"}
                </p>
              )}
              {visibleTasks.map((t) => (
                <div
                  key={t.id}
                  className={cn(
                    "flex items-center gap-3 rounded-lg border border-[hsl(220_12%_92%/0.6)] bg-white px-3 py-2.5 transition-all hover:border-[hsl(250_76%_63%/0.4)] hover:shadow-[0_0_20px_hsl(250_76%_63%/0.15)]",
                    t.status === "completed" && "opacity-60"
                  )}
                >
                  <button
                    type="button"
                    title="Click to change stage"
                    aria-label={`Change stage of ${t.name}`}
                    onClick={() => cycleTask(t.id)}
                    className="shrink-0 transition-transform hover:scale-110"
                  >
                    <StageIcon status={t.status} />
                  </button>
                  <div className="min-w-0 flex-1">
                    <p className={cn("truncate text-[12px] font-medium text-[hsl(220_15%_8%)]", t.status === "completed" && "line-through")}>
                      {t.name}
                    </p>
                    <div className="mt-0.5 flex items-center gap-2">
                      <span className="flex items-center gap-1 text-[10px] text-[hsl(220_12%_40%)]">
                        <Clock className="h-2.5 w-2.5" />
                        {t.status === "completed" ? "Done" : dueLabel(t.due)}
                      </span>
                      <span className="rounded-full border border-[hsl(220_12%_88%)] px-1.5 text-[9px] font-medium text-[hsl(220_12%_40%)]">
                        {t.status === "in-progress" ? "In Progress" : t.status === "planning" ? "Planning" : "Completed"}
                      </span>
                    </div>
                  </div>
                  <span className="shrink-0 rounded-full bg-[hsl(270_10%_95%)] px-2 py-0.5 text-[10px] font-medium text-[hsl(220_15%_20%)]">
                    {t.project}
                  </span>
                </div>
              ))}
            </div>
          </Card>
        </div>

        <div>
          <Card className="space-y-4 p-5">
            <div className="flex items-center justify-between">
              <h2 className="text-[15px] font-semibold text-[hsl(220_15%_8%)]">Team</h2>
              <span className="text-[11px] text-[hsl(220_12%_40%)]">{TEAM.length} members</span>
            </div>
            <div className="space-y-0.5">
              {TEAM.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => openChat(m.id)}
                  title={`Message ${m.name}`}
                  className="flex w-full items-center gap-3 rounded-lg p-2 text-left transition-colors hover:bg-[hsl(270_10%_95%/0.7)]"
                >
                  <img src={avatar(m.name)} alt="" className="h-9 w-9 rounded-full border border-[hsl(220_12%_92%)] bg-[hsl(270_10%_95%)]" />
                  <div className="min-w-0">
                    <p className="truncate text-[12px] font-medium text-[hsl(220_15%_8%)]">{m.name}</p>
                    <p className="truncate text-[11px] text-[hsl(220_12%_40%)]">{m.role}</p>
                  </div>
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => showNudge("Sign up to invite your own team")}
              className="flex h-9 w-full items-center justify-center gap-1.5 rounded-lg text-[12px] font-medium text-white transition-all hover:shadow-[0_0_24px_hsl(250_76%_63%/0.5)]"
              style={{ background: PRIMARY }}
            >
              <Plus className="h-3.5 w-3.5" />
              Invite Member
            </button>
          </Card>
        </div>
      </div>
    </div>
  );

  const projectsView = (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-[22px] font-bold text-[hsl(220_15%_8%)]">Projects</h1>
        <button
          type="button"
          onClick={() => showNudge("Sign up to create your first project")}
          className="flex h-8 items-center gap-1.5 rounded-lg px-3 text-[12px] font-medium text-white"
          style={{ background: PRIMARY }}
        >
          <Plus className="h-3.5 w-3.5" /> New Project
        </button>
      </div>
      <div className="grid grid-cols-3 gap-4">
        {PROJECTS.map((p) => (
          <div
            key={p.id}
            className={cn(
              "space-y-3 rounded-xl border bg-white/80 p-4 transition-all duration-300 hover:border-[hsl(250_76%_63%/0.4)] hover:shadow-[0_0_40px_hsl(250_76%_63%/0.22)]",
              highlightProject === p.id
                ? "border-[hsl(250_76%_63%/0.6)] shadow-[0_0_40px_hsl(250_76%_63%/0.3)]"
                : "border-[hsl(220_12%_92%/0.6)] shadow-[0_0_40px_hsl(250_76%_63%/0.08)]"
            )}
          >
            <div className="flex items-start justify-between gap-2">
              <h3 className="text-[13px] font-semibold leading-snug text-[hsl(220_15%_8%)]">{p.name}</h3>
              <StatusDot status={p.status} />
            </div>
            <div>
              <div className="mb-1 flex justify-between text-[10px] text-[hsl(220_12%_40%)]">
                <span>Progress</span>
                <span>{p.progress}%</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-[hsl(210_10%_92%)]">
                <div className="h-full rounded-full" style={{ width: `${p.progress}%`, background: PRIMARY }} />
              </div>
            </div>
            <div className="flex items-center justify-between">
              <AvatarStack ids={p.team} />
              <span className="text-[10px] text-[hsl(220_12%_40%)]">
                {p.status === "completed" ? "Completed:" : "Due:"} {iso(p.due)}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  const chatMember = TEAM.find((t) => t.id === chatWith) ?? TEAM[0];
  const chatsView = (
    <Card className="flex h-[548px] overflow-hidden">
      <div className="w-[230px] shrink-0 border-r border-[hsl(220_12%_92%)] p-3">
        <h2 className="mb-3 px-1 text-[15px] font-semibold text-[hsl(220_15%_8%)]">Chats</h2>
        {TEAM.map((m) => {
          const last = chats[m.id][chats[m.id].length - 1];
          return (
            <button
              key={m.id}
              type="button"
              onClick={() => setChatWith(m.id)}
              className={cn(
                "mb-1 flex w-full items-center gap-2.5 rounded-lg p-2 text-left transition-colors",
                chatWith === m.id ? "bg-[hsl(250_76%_63%/0.1)]" : "hover:bg-[hsl(270_10%_95%)]"
              )}
            >
              <img src={avatar(m.name)} alt="" className="h-8 w-8 rounded-full bg-[hsl(270_10%_95%)]" />
              <div className="min-w-0">
                <p className="truncate text-[12px] font-medium text-[hsl(220_15%_8%)]">{m.name}</p>
                <p className="truncate text-[10px] text-[hsl(220_12%_40%)]">{last.from === "me" ? "You: " : ""}{last.text}</p>
              </div>
            </button>
          );
        })}
      </div>
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-center gap-2.5 border-b border-[hsl(220_12%_92%)] px-4 py-3">
          <img src={avatar(chatMember.name)} alt="" className="h-8 w-8 rounded-full bg-[hsl(270_10%_95%)]" />
          <div>
            <p className="text-[12px] font-semibold text-[hsl(220_15%_8%)]">{chatMember.name}</p>
            <p className="text-[10px] text-emerald-600">Online</p>
          </div>
        </div>
        <div ref={chatScrollRef} className="flex-1 space-y-2 overflow-y-auto px-4 py-3">
          {chats[chatWith].map((m, i) => (
            <div key={i} className={cn("flex", m.from === "me" ? "justify-end" : "justify-start")}>
              <span
                className={cn(
                  "max-w-[70%] rounded-2xl px-3 py-2 text-[12px]",
                  m.from === "me" ? "rounded-br-sm text-white" : "rounded-bl-sm bg-[hsl(270_10%_95%)] text-[hsl(220_15%_8%)]"
                )}
                style={m.from === "me" ? { background: PRIMARY } : undefined}
              >
                {m.text}
              </span>
            </div>
          ))}
          {typing && <p className="text-[10px] italic text-[hsl(220_12%_40%)]">{chatMember.name.split(" ")[0]} is typing…</p>}
        </div>
        <form
          onSubmit={(e) => { e.preventDefault(); sendMessage(); }}
          className="flex items-center gap-2 border-t border-[hsl(220_12%_92%)] p-3"
        >
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Type a message…"
            aria-label="Message"
            className="h-9 flex-1 rounded-full border border-[hsl(220_12%_92%)] bg-[hsl(270_10%_97%)] px-4 text-[12px] text-[hsl(220_15%_8%)] outline-none placeholder:text-[hsl(220_12%_55%)] focus:border-[hsl(250_76%_63%/0.5)]"
          />
          <button type="submit" aria-label="Send" className="flex h-9 w-9 items-center justify-center rounded-full text-white" style={{ background: PRIMARY }}>
            <Send className="h-4 w-4" />
          </button>
        </form>
      </div>
    </Card>
  );

  const deadlineItems = [
    ...tasks.filter((t) => t.status !== "completed").map((t) => ({ id: t.id, title: t.name, sub: t.project, due: t.due, kind: "Task" })),
    ...activeProjects.map((p) => ({ id: p.id, title: p.name, sub: "Project deadline", due: p.due, kind: "Project" })),
  ].sort((a, b) => a.due - b.due);

  const deadlinesView = (
    <div className="space-y-5">
      <h1 className="text-[22px] font-bold text-[hsl(220_15%_8%)]">Deadlines</h1>
      <Card className="divide-y divide-[hsl(220_12%_92%)] p-2">
        {deadlineItems.map((d) => {
          const date = dayOffset(d.due);
          return (
            <div key={d.id} className="flex items-center gap-4 rounded-lg px-3 py-2.5 transition-colors hover:bg-[hsl(270_10%_97%)]">
              <div className="flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-lg bg-[hsl(250_76%_63%/0.1)]">
                <span className="text-[9px] font-semibold uppercase" style={{ color: PRIMARY }}>
                  {date.toLocaleDateString(undefined, { month: "short" })}
                </span>
                <span className="text-[15px] font-bold leading-none text-[hsl(220_15%_8%)]">{date.getDate()}</span>
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[12px] font-medium text-[hsl(220_15%_8%)]">{d.title}</p>
                <p className="text-[10px] text-[hsl(220_12%_40%)]">{d.sub}</p>
              </div>
              <span className={cn("text-[10px] font-medium", d.due <= 1 ? "text-red-500" : "text-[hsl(220_12%_40%)]")}>{dueLabel(d.due)}</span>
              <span className="rounded-full border border-[hsl(220_12%_88%)] px-2 py-0.5 text-[9px] font-medium text-[hsl(220_12%_40%)]">{d.kind}</span>
            </div>
          );
        })}
      </Card>
    </div>
  );

  const a = ANALYTICS[period];
  const barMax = Math.max(...a.bars.flatMap((b) => [b.done, b.created]));
  const workloadMax = Math.max(...a.workload.map((w) => w.tasks));
  const statusMix = (["in-progress", "planning", "completed"] as Stage[]).map((s) => ({
    status: s,
    count: PROJECTS.filter((p) => p.status === s).length,
  }));
  const SLICE_COLORS: Record<Stage, string> = {
    "in-progress": "hsl(250 76% 63%)",
    planning: "rgb(251 191 36)",
    completed: "rgb(16 185 129)",
  };
  let donutAt = 0;
  const donutStops = statusMix
    .filter((m) => m.count > 0)
    .map((m) => {
      const end = donutAt + (m.count / PROJECTS.length) * 360;
      const stop = `${SLICE_COLORS[m.status]} ${donutAt}deg ${end}deg`;
      donutAt = end;
      return stop;
    })
    .join(", ");

  const analyticsView = (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[22px] font-bold text-[hsl(220_15%_8%)]">Analytics</h1>
          <p className="text-[11px] text-[hsl(220_12%_40%)]">How your agency is delivering across projects and team.</p>
        </div>
        {/* Range dropdown: the purple button shows the current range, like the real app */}
        <div className="relative" onClick={(e) => e.stopPropagation()}>
          <button
            type="button"
            onClick={() => setRangeOpen((o) => !o)}
            aria-haspopup="menu"
            aria-expanded={rangeOpen}
            className="flex h-8 items-center gap-1.5 rounded-md px-3 text-[12px] font-medium text-white shadow-sm transition-opacity hover:opacity-90"
            style={{ background: PRIMARY }}
          >
            {PERIOD_LABELS[period]}
            <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", rangeOpen && "rotate-180")} />
          </button>
          {rangeOpen && (
            <div role="menu" className="absolute right-0 top-full z-20 mt-1 w-[150px] overflow-hidden rounded-lg border border-[hsl(220_12%_92%)] bg-white py-1 shadow-xl">
              {(["7d", "30d", "90d"] as Period[]).map((p) => (
                <button
                  key={p}
                  type="button"
                  role="menuitem"
                  onClick={() => { setPeriod(p); setHoverBar(null); setRangeOpen(false); }}
                  className={cn(
                    "block w-full px-3 py-1.5 text-left text-[12px] hover:bg-[hsl(270_10%_95%)]",
                    period === p ? "font-semibold" : "text-[hsl(220_15%_8%)]"
                  )}
                  style={period === p ? { color: PRIMARY } : undefined}
                >
                  {PERIOD_LABELS[p]}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-4 gap-3">
        {a.stats.map((s) => {
          // Turnaround going down is good news, so it gets the green treatment.
          const good = s.label === "Avg. turnaround" ? s.delta < 0 : s.delta >= 0;
          const Trend = s.delta < 0 ? TrendingDown : TrendingUp;
          return (
            <Card key={s.label} className="p-3.5">
              <p className="text-[10px] font-medium text-[hsl(220_12%_40%)]">{s.label}</p>
              <div className="mt-1 flex items-end justify-between">
                <span className="text-[20px] font-bold leading-none text-[hsl(220_15%_8%)]">{s.value}</span>
                {s.delta !== 0 && (
                  <span className={cn("flex items-center gap-0.5 text-[10px] font-semibold", good ? "text-emerald-600" : "text-red-500")}>
                    <Trend className="h-3 w-3" />
                    {Math.abs(s.delta)}%
                  </span>
                )}
              </div>
            </Card>
          );
        })}
      </div>

      <div className="grid grid-cols-3 gap-3">
        {/* Throughput chart */}
        <Card className="col-span-2 p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-[13px] font-semibold text-[hsl(220_15%_8%)]">{a.chartLabel}</h2>
            <div className="flex items-center gap-3 text-[10px] text-[hsl(220_12%_40%)]">
              <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm" style={{ background: PRIMARY }} />Completed</span>
              <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-[hsl(250_60%_85%)]" />Created</span>
            </div>
          </div>
          <div className="flex h-[84px] items-end gap-3 border-b border-[hsl(220_12%_92%)] px-1">
            {a.bars.map((b, i) => (
              <div
                key={b.label}
                className="relative flex h-full flex-1 items-end justify-center gap-1"
                onMouseEnter={() => setHoverBar(i)}
                onMouseLeave={() => setHoverBar(null)}
              >
                {hoverBar === i && (
                  <div className="absolute -top-1 left-1/2 z-10 -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-md bg-[hsl(220_15%_12%)] px-2 py-1 text-[10px] text-white shadow-lg">
                    {b.done} done · {b.created} created
                  </div>
                )}
                <div
                  className="w-full max-w-[22px] rounded-t transition-all duration-500"
                  style={{ height: `${(b.done / barMax) * 100}%`, background: PRIMARY, opacity: hoverBar === null || hoverBar === i ? 1 : 0.45 }}
                />
                <div
                  className="w-full max-w-[22px] rounded-t bg-[hsl(250_60%_85%)] transition-all duration-500"
                  style={{ height: `${(b.created / barMax) * 100}%`, opacity: hoverBar === null || hoverBar === i ? 1 : 0.45 }}
                />
              </div>
            ))}
          </div>
          <div className="mt-1.5 flex gap-3 px-1">
            {a.bars.map((b) => (
              <span key={b.label} className="flex-1 text-center text-[10px] text-[hsl(220_12%_40%)]">{b.label}</span>
            ))}
          </div>
        </Card>

        {/* Project status mix */}
        <Card className="p-4">
          <h2 className="mb-3 text-[13px] font-semibold text-[hsl(220_15%_8%)]">Projects by status</h2>
          <div className="flex items-center gap-4">
            {/* Donut via conic gradient; slice colours match the status circles */}
            <div
              className="relative h-[92px] w-[92px] shrink-0 rounded-full"
              style={{ background: `conic-gradient(${donutStops})` }}
              aria-hidden
            >
              <div className="absolute inset-[18%] flex flex-col items-center justify-center rounded-full bg-white">
                <span className="text-[18px] font-bold leading-none text-[hsl(220_15%_8%)]">{PROJECTS.length}</span>
                <span className="mt-0.5 text-[9px] text-[hsl(220_12%_40%)]">projects</span>
              </div>
            </div>
            <div className="min-w-0 flex-1 space-y-2">
              {statusMix.map((m) => (
                <div key={m.status} className="flex items-center gap-2 text-[11px]">
                  <StatusDot status={m.status} />
                  <span className="flex-1 truncate text-[hsl(220_15%_8%)]">
                    {m.status === "in-progress" ? "In Progress" : m.status === "planning" ? "Planning" : "Completed"}
                  </span>
                  <span className="font-semibold text-[hsl(220_15%_8%)]">{m.count}</span>
                </div>
              ))}
            </div>
          </div>
        </Card>
      </div>

      {/* Team workload */}
      <Card className="p-4">
        <h2 className="mb-2 text-[13px] font-semibold text-[hsl(220_15%_8%)]">Team performance</h2>
        <div className="space-y-1.5">
          {a.workload.map((w) => {
            const m = TEAM.find((t) => t.id === w.id) ?? TEAM[0];
            return (
              <div key={w.id} className="flex items-center gap-3">
                <img src={avatar(m.name)} alt="" className="h-7 w-7 rounded-full bg-[hsl(270_10%_95%)]" />
                <div className="w-[150px] min-w-0">
                  <p className="truncate text-[11px] font-medium text-[hsl(220_15%_8%)]">{m.name}</p>
                  <p className="truncate text-[10px] text-[hsl(220_12%_40%)]">{m.role}</p>
                </div>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-[hsl(210_10%_92%)]">
                  <div className="h-full rounded-full transition-all duration-500" style={{ width: `${(w.tasks / workloadMax) * 100}%`, background: PRIMARY }} />
                </div>
                <span className="w-[64px] text-right text-[11px] font-semibold text-[hsl(220_15%_8%)]">{w.tasks} tasks</span>
                <span className="w-[72px] text-right text-[10px] text-emerald-600">{w.onTime}% on time</span>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );

  // The sign-up toast: shown briefly after account-only actions, and kept in place on Analytics.
  const nudgeToast = (text: string) => (
    <div className="flex items-center gap-3 rounded-full border border-[hsl(220_12%_92%)] bg-white py-1.5 pl-4 pr-1.5 shadow-xl">
      <span className="text-[12px] text-[hsl(220_15%_8%)]">{text}</span>
      <button
        type="button"
        onClick={() => navigate("/get-started")}
        className="flex items-center gap-1 rounded-full px-3 py-1.5 text-[11px] font-semibold text-white"
        style={{ background: PRIMARY }}
      >
        Get Started <ArrowRight className="h-3 w-3" />
      </button>
    </div>
  );

  // Pinned to the base of Analytics, outside the scroll area, so it never covers the content.
  const analyticsNudge = (
    <div className="flex shrink-0 justify-center pb-5 pt-1">
      {nudgeToast("Sign up to see your agency's real numbers")}
    </div>
  );

  const LockedIcon = NAV.find((n) => n.label === lockedLabel)?.icon ?? Settings;
  const lockedView = (
    <div className="flex h-[548px] items-center justify-center">
      <Card className="max-w-sm p-8 text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-[hsl(250_76%_63%/0.12)]">
          <LockedIcon className="h-6 w-6" style={{ color: PRIMARY }} />
        </div>
        <h2 className="mb-1.5 text-[16px] font-semibold text-[hsl(220_15%_8%)]">{lockedLabel} is waiting for you</h2>
        <p className="mb-5 text-[12px] leading-relaxed text-[hsl(220_12%_40%)]">
          Create a free account to explore {lockedLabel.toLowerCase()} with your own projects and team.
        </p>
        <button
          type="button"
          onClick={() => navigate("/get-started")}
          className="inline-flex items-center gap-1.5 rounded-full px-5 py-2 text-[12px] font-semibold text-white transition-all hover:shadow-[0_0_24px_hsl(250_76%_63%/0.5)]"
          style={{ background: PRIMARY }}
        >
          Get Started, It&apos;s Free! <ArrowRight className="h-3.5 w-3.5" />
        </button>
      </Card>
    </div>
  );

  // ─── Shell ─────────────────────────────────────────────────────────────────

  return (
    <div ref={wrapRef} className="relative w-full" style={{ height: H * scale }}>
      <div
        role="region"
        aria-label="Interactive preview of the OnSwift dashboard with sample data"
        className="absolute left-0 top-0 flex overflow-hidden bg-white text-left"
        style={{ width: W, height: H, transform: `scale(${scale})`, transformOrigin: "top left", fontFamily: "'Inter', system-ui, sans-serif" }}
      >
        {/* Sidebar */}
        <aside className="flex w-[180px] shrink-0 flex-col border-r border-[hsl(220_12%_92%)] bg-white px-3 py-5">
          <div className="mb-6 flex items-center gap-2.5 px-2">
            <img src="/onswift-purple-logo.png" alt="" className="h-7 w-7 object-contain" />
            <span className="text-[16px] font-bold text-[hsl(220_15%_8%)]">OnSwift</span>
          </div>
          <nav className="flex flex-1 flex-col gap-1">
            {NAV.map((item) => {
              const active = activeNav === item.key;
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => go(item.key, item.view, item.label)}
                  className={cn(
                    "flex h-9 items-center gap-2.5 rounded-xl px-3 text-[12px] font-medium transition-all duration-300",
                    active ? "text-white shadow-[0_0_24px_hsl(250_76%_63%/0.4)]" : "text-[hsl(220_12%_40%)] hover:bg-[hsl(270_10%_95%)] hover:text-[hsl(220_15%_8%)]"
                  )}
                  style={active ? { background: PRIMARY } : undefined}
                >
                  <item.icon className="h-4 w-4 shrink-0" />
                  {item.label}
                  {item.key === "deadlines" && deadlineCount > 0 && (
                    <span className="ml-auto flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-bold text-white">
                      {deadlineCount}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
          <button
            type="button"
            onClick={() => go("settings", "locked", "Settings")}
            className={cn(
              "flex h-9 items-center gap-2.5 rounded-xl px-3 text-[12px] font-medium transition-all",
              activeNav === "settings" ? "text-white" : "text-[hsl(220_12%_40%)] hover:bg-[hsl(270_10%_95%)] hover:text-[hsl(220_15%_8%)]"
            )}
            style={activeNav === "settings" ? { background: PRIMARY } : undefined}
          >
            <Settings className="h-4 w-4" /> Settings
          </button>
        </aside>

        {/* Main */}
        <div className="relative flex min-w-0 flex-1 flex-col bg-[linear-gradient(160deg,hsl(250_80%_97%)_0%,#fff_45%,hsl(250_60%_98%)_100%)]">
          {/* Top bar */}
          <header className="relative z-20 flex h-[52px] shrink-0 items-center gap-3 border-b border-[hsl(220_12%_92%/0.6)] bg-white/80 px-5 backdrop-blur">
            <button
              type="button"
              aria-label="Back to workspace"
              onClick={() => go("workspace", "workspace")}
              className="flex h-7 w-7 items-center justify-center rounded-md text-[hsl(220_12%_40%)] hover:bg-[hsl(270_10%_95%)]"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <div className="relative w-[320px]">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[hsl(220_12%_50%)]" />
              <input
                value={query}
                onChange={(e) => { setQuery(e.target.value); setBellOpen(false); }}
                placeholder="Search docs, projects, talents..."
                aria-label="Search"
                className="h-8 w-full rounded-full border border-[hsl(220_12%_92%)] bg-[hsl(270_10%_97%)] pl-8 pr-7 text-[12px] text-[hsl(220_15%_8%)] outline-none placeholder:text-[hsl(220_12%_55%)] focus:border-[hsl(250_76%_63%/0.5)]"
              />
              {query && (
                <button type="button" aria-label="Clear search" onClick={() => setQuery("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[hsl(220_12%_50%)]">
                  <X className="h-3 w-3" />
                </button>
              )}
              {searchResults && (
                <div className="absolute left-0 top-full mt-1 w-full overflow-hidden rounded-xl border border-[hsl(220_12%_92%)] bg-white shadow-xl">
                  {searchResults.projects.length + searchResults.talents.length === 0 ? (
                    <p className="px-3 py-2.5 text-[11px] text-[hsl(220_12%_40%)]">No results for “{query}”</p>
                  ) : (
                    <>
                      {searchResults.projects.length > 0 && <p className="px-3 pb-1 pt-2 text-[9px] font-semibold uppercase tracking-wider text-[hsl(220_12%_50%)]">Projects</p>}
                      {searchResults.projects.map((p) => (
                        <button key={p.id} type="button" onClick={() => openProject(p.id)} className="block w-full truncate px-3 py-1.5 text-left text-[12px] text-[hsl(220_15%_8%)] hover:bg-[hsl(270_10%_95%)]">
                          {p.name}
                        </button>
                      ))}
                      {searchResults.talents.length > 0 && <p className="px-3 pb-1 pt-2 text-[9px] font-semibold uppercase tracking-wider text-[hsl(220_12%_50%)]">Talents</p>}
                      {searchResults.talents.map((t) => (
                        <button key={t.id} type="button" onClick={() => openChat(t.id)} className="block w-full truncate px-3 py-1.5 text-left text-[12px] text-[hsl(220_15%_8%)] hover:bg-[hsl(270_10%_95%)]">
                          {t.name} <span className="text-[hsl(220_12%_50%)]">· {t.role}</span>
                        </button>
                      ))}
                    </>
                  )}
                </div>
              )}
            </div>

            <div className="ml-auto flex items-center gap-3">
              <div className="relative">
                <button
                  type="button"
                  aria-label="Notifications"
                  onClick={() => { setBellOpen((o) => !o); setUnread(0); setQuery(""); }}
                  className="relative flex h-8 w-8 items-center justify-center rounded-full hover:bg-[hsl(270_10%_95%)]"
                >
                  <Bell className="h-4 w-4" style={{ color: PRIMARY }} />
                  {unread > 0 && (
                    <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full px-1 text-[9px] font-bold text-white" style={{ background: PRIMARY }}>
                      {unread}
                    </span>
                  )}
                </button>
                {bellOpen && (
                  <div className="absolute right-0 top-full mt-2 w-[260px] overflow-hidden rounded-xl border border-[hsl(220_12%_92%)] bg-white shadow-xl">
                    <p className="border-b border-[hsl(220_12%_92%)] px-3 py-2 text-[12px] font-semibold text-[hsl(220_15%_8%)]">Notifications</p>
                    {NOTIFICATIONS.map((n) => (
                      <div key={n.id} className="flex gap-2.5 px-3 py-2.5 hover:bg-[hsl(270_10%_97%)]">
                        <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: PRIMARY }} />
                        <div>
                          <p className="text-[11px] text-[hsl(220_15%_8%)]">{n.text}</p>
                          <p className="text-[10px] text-[hsl(220_12%_50%)]">{n.time}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[hsl(210_10%_92%)] text-[11px] font-medium text-[hsl(220_15%_8%)]">
                  {userName.slice(0, 2).toUpperCase()}
                </span>
                <span className="text-[12px] font-medium text-[hsl(220_15%_8%)]">{userName}</span>
              </div>
            </div>
          </header>

          {/* Content */}
          <main className="min-h-0 flex-1 overflow-y-auto px-6 py-5 [scrollbar-width:thin]" onClick={() => { setBellOpen(false); setRangeOpen(false); }}>
            {view === "workspace" && workspace}
            {view === "projects" && projectsView}
            {view === "analytics" && analyticsView}
            {view === "chats" && chatsView}
            {view === "deadlines" && deadlinesView}
            {view === "locked" && lockedView}
          </main>
          {view === "analytics" && analyticsNudge}

          {/* Sign-up nudge for actions that need a real account */}
          {nudge && view !== "analytics" && (
            <div className="absolute bottom-5 left-1/2 z-30 -translate-x-1/2">{nudgeToast(nudge)}</div>
          )}
        </div>
      </div>
    </div>
  );
}
