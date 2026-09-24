import { useState, useEffect, useMemo } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Bell, ChevronLeft, ChevronRight, Calendar as CalendarIcon, Settings } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  endOfDay,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  addMonths,
  subMonths,
  isToday,
  isBefore,
  addDays,
  differenceInDays,
  differenceInHours,
  differenceInMinutes,
  differenceInSeconds,
} from "date-fns";
import { useNavigate } from "react-router-dom";
import { readCache, writeCache } from "@/lib/cache";
import { useAuth } from "@/contexts/AuthContext";
import { secureFetch } from "@/api/apiClient";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { ReminderDialog } from "@/components/reminders/ReminderDialog";
import { CountdownCircle } from "@/components/deadlines/CountdownCircle";
import { describeReminder, useReminderSettings } from "@/hooks/useReminderSettings";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface Task {
  id: string;
  name: string;
  projectId: string;
  projectName: string;
  dueDate: Date;
  status: "todo" | "in-progress" | "done";
  assignedTo: {
    id: string;
    name: string;
    avatar: string;
  };
}

interface DeadlineRow {
  id: string;
  name: string;
  project_id: string | null;
  project_name: string;
  deadline: string;
  status: string;
  assignee_id: string | null;
  assignee_name: string | null;
  is_personal: boolean;
}

function toTask(row: DeadlineRow): Task {
  const [y, m, d] = row.deadline.split("-").map(Number);
  const assignee = row.assignee_name || "Unassigned";
  return {
    id: row.is_personal ? `personal-${row.id}` : row.id,
    name: row.name,
    projectId: row.project_id ?? "",
    projectName: row.project_name,
    dueDate: new Date(y, m - 1, d),
    status: row.status === "completed" ? "done" : row.status === "in-progress" ? "in-progress" : "todo",
    assignedTo: {
      id: row.assignee_id || "unknown",
      name: assignee,
      avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(assignee)}`,
    },
  };
}

type TaskStatus = "completed" | "overdue" | "urgent" | "due";

function getTaskStatus(task: Task): TaskStatus {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (task.status === "done") return "completed";
  if (isBefore(task.dueDate, today)) return "overdue";
  if (isBefore(task.dueDate, addDays(today, 2))) return "urgent";
  return "due";
}

function getStatusColor(status: TaskStatus): string {
  switch (status) {
    case "completed": return "bg-success";
    case "overdue": return "bg-destructive animate-pulse";
    case "urgent": return "bg-destructive animate-pulse";
    case "due": return "bg-warning";
    default: return "bg-muted";
  }
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const STATUS_LABEL: Record<TaskStatus, string> = {
  completed: "Completed",
  overdue: "Overdue",
  urgent: "Due soon",
  due: "Upcoming",
};

const STATUS_BADGE: Record<TaskStatus, string> = {
  completed: "bg-success/15 text-success",
  overdue: "bg-destructive/15 text-destructive",
  urgent: "bg-destructive/15 text-destructive",
  due: "bg-warning/15 text-warning",
};

type StatusFilter = "all" | TaskStatus;

const FILTER_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "overdue", label: STATUS_LABEL.overdue },
  { value: "urgent", label: STATUS_LABEL.urgent },
  { value: "due", label: STATUS_LABEL.due },
  { value: "completed", label: STATUS_LABEL.completed },
];

function DeadlineRow({ task, onOpen }: { task: Task; onOpen: (projectId: string) => void }) {
  const status = getTaskStatus(task);
  const daysLeft = differenceInDays(task.dueDate, new Date());
  const relative =
    status === "completed"
      ? ""
      : daysLeft < 0
      ? `${Math.abs(daysLeft)}d overdue`
      : daysLeft === 0
      ? "Due today"
      : daysLeft === 1
      ? "Due tomorrow"
      : `In ${daysLeft} days`;

  return (
    <TableRow
      onClick={() => onOpen(task.projectId)}
      className={cn("cursor-pointer", (status === "overdue" || status === "urgent") && "bg-destructive/5")}
    >
      <TableCell className="max-w-[12rem] font-medium text-foreground">
        <span className="block truncate" title={task.projectName}>{task.projectName}</span>
      </TableCell>
      <TableCell className="max-w-[18rem]">
        <span className="block truncate" title={task.name}>{task.name}</span>
      </TableCell>
      <TableCell className="whitespace-nowrap">
        <div>{format(task.dueDate, "MMM d, yyyy")}</div>
        {relative && <div className="text-xs text-muted-foreground">{relative}</div>}
      </TableCell>
      <TableCell>
        <span className={cn("inline-block whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium", STATUS_BADGE[status])}>
          {STATUS_LABEL[status]}
        </span>
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-2 min-w-0">
          <Avatar className="h-6 w-6 flex-shrink-0">
            <AvatarImage src={task.assignedTo.avatar} />
            <AvatarFallback className="text-[10px]">{task.assignedTo.name.charAt(0)}</AvatarFallback>
          </Avatar>
          <span className="truncate max-w-[9rem]">{task.assignedTo.name}</span>
        </div>
      </TableCell>
    </TableRow>
  );
}

export default function Calendar() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [showCalendar, setShowCalendar] = useState(false);
  // Cached rows render instantly on repeat visits; the fetch below refreshes them silently.
  const [rows, setRows] = useState<DeadlineRow[]>(() => readCache<DeadlineRow[]>("deadlines") ?? []);
  const [isLoading, setIsLoading] = useState(() => readCache<DeadlineRow[]>("deadlines") === null);
  const tasks = useMemo(() => rows.map(toTask), [rows]);
  const [loadError, setLoadError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  const navigate = useNavigate();
  const { user } = useAuth();
  const { settings: reminder, save: saveReminder } = useReminderSettings();
  const [reminderOpen, setReminderOpen] = useState(false);

  const toggleReminder = async (checked: boolean) => {
    if (checked) {
      setReminderOpen(true);
      return;
    }
    if (!(await saveReminder({ reminder_enabled: false }))) {
      toast.error("Couldn't turn off reminders. Please try again.");
    }
  };

  // One request for every deadline (project + personal), refreshed silently every 30s
  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const res = await secureFetch("/api/v2/deadlines/");
        if (cancelled) return;
        if (!res.ok) {
          setLoadError(true);
          return;
        }
        const data: DeadlineRow[] = await res.json();
        if (cancelled) return;
        setRows(data);
        setLoadError(false);
        writeCache("deadlines", data);
      } catch (error) {
        console.error("Error fetching deadlines:", error);
        if (!cancelled) setLoadError(true);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    load();
    const intervalId = setInterval(() => {
      if (!document.hidden) load();
    }, 30000);

    return () => {
      cancelled = true;
      clearInterval(intervalId);
    };
  }, [reloadKey]);

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const calendarStart = startOfWeek(monthStart);
  const calendarEnd = endOfWeek(monthEnd);
  const calendarDays = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

  const getTasksForDate = (date: Date): Task[] => {
    return tasks.filter((task) => isSameDay(task.dueDate, date));
  };

  // Open tasks first by due date (overdue naturally on top), completed last
  const sortedTasks = useMemo(() => {
    const isDone = (t: Task) => (t.status === "done" ? 1 : 0);
    return [...tasks].sort(
      (a, b) => isDone(a) - isDone(b) || a.dueDate.getTime() - b.dueDate.getTime()
    );
  }, [tasks]);

  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const statusCounts = useMemo(() => {
    const counts: Record<StatusFilter, number> = { all: sortedTasks.length, overdue: 0, urgent: 0, due: 0, completed: 0 };
    sortedTasks.forEach((t) => { counts[getTaskStatus(t)] += 1; });
    return counts;
  }, [sortedTasks]);
  const visibleTasks = useMemo(
    () => (statusFilter === "all" ? sortedTasks : sortedTasks.filter((t) => getTaskStatus(t) === statusFilter)),
    [sortedTasks, statusFilter]
  );

  // Get next deadline
  const nextDeadline = tasks
    .filter(task => task.status !== "done" && endOfDay(task.dueDate) >= new Date())
    .sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime())[0];

  const handlePrevMonth = () => setCurrentDate(subMonths(currentDate, 1));
  const handleNextMonth = () => setCurrentDate(addMonths(currentDate, 1));
  const handleToday = () => setCurrentDate(new Date());

  const handleDateClick = (date: Date) => {
    const tasks = getTasksForDate(date);
    if (tasks.length > 0) {
      setSelectedDate(date);
    }
  };

  const selectedDateTasks = selectedDate ? getTasksForDate(selectedDate) : [];

  return (
    <MainLayout>
      <div className="animate-fade-in space-y-6 sm:space-y-8">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-foreground leading-tight ">
              Project Deadlines
            </h1>
            <p className="mt-1 text-muted-foreground">
              Track deadlines and stay on schedule
            </p>

            <div className="mt-3 flex items-center gap-3 rounded-xl border border-border/60 bg-card/60 px-3 py-2 w-fit max-w-full">
              <Bell className="h-4 w-4 text-primary flex-shrink-0" />
              <label htmlFor="reminder-toggle" className="text-sm font-medium text-foreground cursor-pointer">
                Enable reminder
              </label>
              <Switch
                id="reminder-toggle"
                checked={!!reminder?.reminder_enabled}
                disabled={!reminder}
                onCheckedChange={toggleReminder}
              />
              {reminder?.reminder_enabled && (
                <button
                  type="button"
                  className="flex-shrink-0 rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  title={`${describeReminder(reminder)} · Edit`}
                  aria-label={`Reminder settings. ${describeReminder(reminder)}`}
                  onClick={() => setReminderOpen(true)}
                >
                  <Settings className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>

          <div className="relative shrink-0">
            <Button
              variant={showCalendar ? "default" : "outline"}
              size="sm"
              onClick={() => setShowCalendar(!showCalendar)}
              className="font-semibold gap-2"
            >
              <CalendarIcon className="h-4 w-4" />
              <span className="hidden sm:inline">
                {showCalendar ? "Hide" : "Show"} Calendar
              </span>
            </Button>

            {/* Mobile: calendar drops down under the button */}
            {showCalendar && (
              <>
                {/* Backdrop */}
                <div
                  className="fixed inset-0 z-40 bg-background/60 backdrop-blur-sm lg:hidden"
                  onClick={() => setShowCalendar(false)}
                />
                <div className="absolute right-0 top-full mt-2 z-50 w-72 lg:hidden rounded-xl border border-border/50 bg-card shadow-xl p-4">
                <div className="mb-4 flex items-center justify-between">
                  <h3 className="font-bold text-foreground">
                    {format(currentDate, "MMM yyyy")}
                  </h3>
                  <div className="flex items-center gap-1">
                    <Button variant="outline" size="icon" className="h-8 w-8" onClick={handlePrevMonth}>
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Button variant="outline" size="icon" className="h-8 w-8" onClick={handleNextMonth}>
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <div className="grid grid-cols-7 gap-1 mb-2">
                  {WEEKDAYS.map((day) => (
                    <div key={day} className="text-center text-xs font-bold text-primary uppercase">
                      {day.charAt(0)}
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-7 gap-1">
                  {calendarDays.map((day) => {
                    const tasksForDay = getTasksForDate(day);
                    const isCurrentMonth = isSameMonth(day, currentDate);
                    const isCurrentDay = isToday(day);
                    const hasEvents = tasksForDay.length > 0;
                    const hasOverdueOrUrgent = tasksForDay.some(
                      (t) => getTaskStatus(t) === "overdue" || getTaskStatus(t) === "urgent"
                    );
                    const hasDue = tasksForDay.some((t) => getTaskStatus(t) === "due");
                    const hasCompleted = tasksForDay.some((t) => getTaskStatus(t) === "completed");
                    return (
                      <button
                        key={day.toISOString()}
                        onClick={() => handleDateClick(day)}
                        className={cn(
                          "relative aspect-square rounded-md flex flex-col items-center justify-center gap-px text-xs font-semibold transition-all border",
                          isCurrentMonth
                            ? "bg-secondary/50 border-border/50 hover:bg-secondary/70"
                            : "bg-secondary/10 text-muted-foreground/50 border-transparent",
                          isCurrentDay && "border-primary ring-2 ring-primary/30 shadow-glow",
                          hasOverdueOrUrgent && "animate-pulse-border border-destructive",
                          hasEvents && "hover:shadow-lg cursor-pointer"
                        )}
                      >
                        <span className={cn(isCurrentDay && "text-primary font-bold")}>
                          {format(day, "d")}
                        </span>
                        {hasEvents && (
                          <div className="flex items-center gap-0.5">
                            {hasOverdueOrUrgent && <div className="h-1 w-1 rounded-full bg-destructive" />}
                            {hasDue && <div className="h-1 w-1 rounded-full bg-warning" />}
                            {hasCompleted && <div className="h-1 w-1 rounded-full bg-success" />}
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
              </>
            )}
          </div>
        </div>

        {/* Main Content Grid */}
        <div className={cn("grid gap-6", showCalendar && "lg:grid-cols-[1fr_350px]")}>
          {/* Left: Deadlines */}
          <div className="min-w-0 space-y-6">
            {/* Next Deadline Countdown */}
            {nextDeadline && <CountdownCircle target={endOfDay(nextDeadline.dueDate)} />}

            {/* Deadlines Table */}
            <div className="glass-card p-4 sm:p-6 rounded-lg border border-border/50">
              <div className="mb-4 flex items-center justify-between gap-3">
                <h2 className="text-xl sm:text-2xl font-bold text-foreground">All Deadlines</h2>
                <span className="text-xs px-2 py-1 bg-primary/20 text-primary rounded-full font-medium">
                  {visibleTasks.length}
                </span>
              </div>

              {sortedTasks.length > 0 && (
                <div className="scrollbar-transparent -mx-1 mb-4 flex gap-2 overflow-x-auto px-1 pb-1" role="group" aria-label="Filter by status">
                  {FILTER_OPTIONS.map((option) => {
                    const active = statusFilter === option.value;
                    return (
                      <button
                        key={option.value}
                        type="button"
                        aria-pressed={active}
                        onClick={() => setStatusFilter(option.value)}
                        className={cn(
                          "flex flex-shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-3 py-1.5 text-sm font-medium transition-colors",
                          active
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-border text-muted-foreground hover:border-primary/40 hover:text-foreground"
                        )}
                      >
                        {option.label}
                        <span className={cn("text-xs", active ? "text-primary-foreground/80" : "text-muted-foreground")}>
                          {statusCounts[option.value]}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}

              {isLoading ? (
                <p className="py-10 text-center text-sm text-muted-foreground">Loading deadlines…</p>
              ) : loadError && rows.length === 0 ? (
                <p className="py-10 text-center text-sm text-muted-foreground">
                  Couldn't load your deadlines.{" "}
                  <button
                    type="button"
                    className="font-medium text-primary hover:underline"
                    onClick={() => { setIsLoading(true); setLoadError(false); setReloadKey((k) => k + 1); }}
                  >
                    Try again
                  </button>
                </p>
              ) : sortedTasks.length === 0 ? (
                <p className="py-10 text-center text-sm text-muted-foreground">
                  No deadlines yet. Tasks with a due date will show up here.
                </p>
              ) : visibleTasks.length === 0 ? (
                <p className="py-10 text-center text-sm text-muted-foreground">
                  No {FILTER_OPTIONS.find((o) => o.value === statusFilter)?.label.toLowerCase()} deadlines.{" "}
                  <button type="button" className="font-medium text-primary hover:underline" onClick={() => setStatusFilter("all")}>
                    Show all
                  </button>
                </p>
              ) : (
                <Table className="min-w-[640px]" containerClassName="scrollbar-transparent">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Project</TableHead>
                      <TableHead>Task</TableHead>
                      <TableHead>Due date</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Assignee</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {visibleTasks.map((task) => (
                      <DeadlineRow
                        key={task.id}
                        task={task}
                        onOpen={(projectId) => navigate(projectId ? `/projects/${projectId}` : "/dashboard")}
                      />
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>
          </div>

          {/* Right: Optional Calendar Panel */}
          {showCalendar && (
            <div className="hidden lg:block space-y-6 h-fit sticky top-6">
              {/* Calendar */}
              <div className="glass-card p-4 rounded-lg border border-border/50">
                {/* Calendar Header */}
                <div className="mb-4 flex items-center justify-between">
                  <h3 className="font-bold text-foreground">
                    {format(currentDate, "MMM yyyy")}
                  </h3>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8"
                      onClick={handlePrevMonth}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8"
                      onClick={handleNextMonth}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                {/* Weekday Headers */}
                <div className="grid grid-cols-7 gap-1 mb-2">
                  {WEEKDAYS.map((day) => (
                    <div
                      key={day}
                      className="text-center text-xs font-bold text-primary uppercase"
                    >
                      {day.charAt(0)}
                    </div>
                  ))}
                </div>

                {/* Calendar Grid */}
                <div className="grid grid-cols-7 gap-1">
                  {calendarDays.map((day) => {
                    const tasksForDay = getTasksForDate(day);
                    const isCurrentMonth = isSameMonth(day, currentDate);
                    const isCurrentDay = isToday(day);
                    const hasEvents = tasksForDay.length > 0;
                    const hasOverdueOrUrgent = tasksForDay.some(
                      (t) => getTaskStatus(t) === "overdue" || getTaskStatus(t) === "urgent"
                    );
                    const hasDue = tasksForDay.some((t) => getTaskStatus(t) === "due");
                    const hasCompleted = tasksForDay.some((t) => getTaskStatus(t) === "completed");

                    return (
                      <button
                        key={day.toISOString()}
                        onClick={() => handleDateClick(day)}
                        className={cn(
                          "relative aspect-square rounded-md flex flex-col items-center justify-center gap-px text-xs font-semibold transition-all border",
                          isCurrentMonth
                            ? "bg-secondary/50 border-border/50 hover:bg-secondary/70"
                            : "bg-secondary/10 text-muted-foreground/50 border-transparent",
                          isCurrentDay && "border-primary ring-2 ring-primary/30 shadow-glow",
                          hasOverdueOrUrgent && "animate-pulse-border border-destructive",
                          hasEvents && "hover:shadow-lg cursor-pointer"
                        )}
                      >
                        <span className={cn(isCurrentDay && "text-primary font-bold")}>
                          {format(day, "d")}
                        </span>
                        {hasEvents && (
                          <div className="flex items-center gap-0.5">
                            {hasOverdueOrUrgent && (
                              <div className="h-1 w-1 rounded-full bg-destructive" />
                            )}
                            {hasDue && (
                              <div className="h-1 w-1 rounded-full bg-warning" />
                            )}
                            {hasCompleted && (
                              <div className="h-1 w-1 rounded-full bg-success" />
                            )}
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>

        <ReminderDialog
          open={reminderOpen}
          onOpenChange={setReminderOpen}
          settings={reminder}
          onSave={saveReminder}
        />

        {/* Date Details Dialog */}
        <Dialog open={!!selectedDate} onOpenChange={() => setSelectedDate(null)}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle className="text-2xl">
                {selectedDate && format(selectedDate, "MMMM d, yyyy")}
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-2">
              {selectedDateTasks.map((task) => {
                const status = getTaskStatus(task);
                const daysLeft = differenceInDays(task.dueDate, new Date());

                const dotColor =
                  status === "overdue" || status === "urgent"
                    ? "bg-destructive"
                    : status === "due"
                    ? "bg-warning"
                    : "bg-success";

                const stripeColor =
                  status === "overdue" || status === "urgent"
                    ? "border-l-destructive bg-destructive/5"
                    : status === "due"
                    ? "border-l-warning bg-warning/5"
                    : "border-l-success bg-success/5";

                const dueLine =
                  status === "completed"
                    ? "Completed"
                    : daysLeft < 0
                    ? `${Math.abs(daysLeft)}d overdue`
                    : daysLeft === 0
                    ? "Due today"
                    : daysLeft === 1
                    ? "Due tomorrow"
                    : `Due in ${daysLeft}d`;

                return (
                  <div
                    key={task.id}
                    onClick={() => navigate(task.projectId ? `/projects/${task.projectId}` : "/dashboard")}
                    className={cn(
                      "cursor-pointer rounded-lg border border-border/30 border-l-4 p-3 transition-all hover:shadow-md",
                      stripeColor,
                      (status === "overdue" || status === "urgent") && "animate-pulse-border"
                    )}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <div className={cn("h-2 w-2 rounded-full shrink-0", dotColor,
                        (status === "overdue" || status === "urgent") && "animate-pulse"
                      )} />
                      <p className="text-xs text-muted-foreground font-medium truncate">
                        {task.projectName}
                      </p>
                    </div>
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-semibold text-foreground text-sm leading-snug truncate">
                          {task.name}
                        </p>
                        <p className={cn(
                          "text-xs mt-0.5 font-medium",
                          status === "overdue" ? "text-destructive"
                          : status === "urgent"  ? "text-destructive"
                          : status === "due"     ? "text-warning"
                          : "text-success"
                        )}>
                          {dueLine}
                        </p>
                      </div>
                      <Avatar className="h-6 w-6 shrink-0">
                        <AvatarImage src={task.assignedTo.avatar} />
                        <AvatarFallback className="text-[10px]">
                          {task.assignedTo.name.charAt(0)}
                        </AvatarFallback>
                      </Avatar>
                    </div>
                  </div>
                );
              })}
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <style>{`
        @keyframes pulse-border {
          0%, 100% {
            border-color: hsl(var(--destructive));
            box-shadow: 0 0 20px hsla(var(--destructive), 0.5);
          }
          50% {
            border-color: hsl(var(--destructive) / 0.5);
            box-shadow: 0 0 30px hsla(var(--destructive), 0.8);
          }
        }

        .animate-pulse-border {
          animation: pulse-border 2s ease-in-out infinite;
        }
      `}</style>

    </MainLayout>
  );
}
