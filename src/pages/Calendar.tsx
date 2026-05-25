import { useState, useEffect, useMemo } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ChevronLeft, ChevronRight, ChevronDown, Clock, AlertCircle, Calendar as CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
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
import { useProjects, type Task as ProjectTask } from "@/contexts/ProjectContext";
import { useAuth } from "@/contexts/AuthContext";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

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

function CountdownTimer({ targetDate }: { targetDate: Date }) {
  const [timeLeft, setTimeLeft] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 });
  const [isUrgent, setIsUrgent] = useState(false);

  useEffect(() => {
    const updateTimer = () => {
      const now = new Date();
      const diff = targetDate.getTime() - now.getTime();

      if (diff <= 0) {
        setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0 });
        setIsUrgent(true);
        return;
      }

      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);

      setTimeLeft({ days, hours, minutes, seconds });
      setIsUrgent(days === 0 && hours < 24);
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [targetDate]);

  return (
    <div className={cn(
      "glass-card p-5 sm:p-6 border-2",
      isUrgent ? "border-destructive animate-pulse-border" : "border-primary/30"
    )}>
      <div className="flex items-center gap-2 mb-4">
        <Clock className={cn("h-5 w-5", isUrgent ? "text-destructive" : "text-primary")} />
        <h3 className="font-semibold text-foreground">Next Deadline</h3>
      </div>

      <div className="grid grid-cols-4 gap-3 mb-4">
        <div className="text-center">
          <div className={cn(
            "text-3xl font-bold mb-1",
            isUrgent ? "text-destructive" : "text-foreground"
          )}>
            {timeLeft.days}
          </div>
          <div className="text-xs text-muted-foreground uppercase">Days</div>
        </div>
        <div className="text-center">
          <div className={cn(
            "text-3xl font-bold mb-1",
            isUrgent ? "text-destructive" : "text-foreground"
          )}>
            {timeLeft.hours}
          </div>
          <div className="text-xs text-muted-foreground uppercase">Hours</div>
        </div>
        <div className="text-center">
          <div className={cn(
            "text-3xl font-bold mb-1",
            isUrgent ? "text-destructive" : "text-foreground"
          )}>
            {timeLeft.minutes}
          </div>
          <div className="text-xs text-muted-foreground uppercase">Min</div>
        </div>
        <div className="text-center">
          <div className={cn(
            "text-3xl font-bold mb-1",
            isUrgent ? "text-destructive" : "text-foreground"
          )}>
            {timeLeft.seconds}
          </div>
          <div className="text-xs text-muted-foreground uppercase">Sec</div>
        </div>
      </div>

      {isUrgent && (
        <div className="flex items-center gap-2 text-destructive text-sm font-medium">
          <AlertCircle className="h-4 w-4" />
          <span>URGENT: Due in less than 24 hours!</span>
        </div>
      )}
    </div>
  );
}

type ExpandedBranches = {
  [key: string]: boolean;
};

export default function Calendar() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [showCalendar, setShowCalendar] = useState(false);
  const [expandedBranches, setExpandedBranches] = useState<ExpandedBranches>({
    urgent: true,
    due: true,
    completed: true,
  });
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  const navigate = useNavigate();
  const { projects, fetchProjects, fetchProjectTasks } = useProjects();
  const { user } = useAuth();

  // Fetch all tasks from all projects - interval-based (30 seconds)
  useEffect(() => {
    const loadAllTasks = async () => {
      try {
        await fetchProjects();
      } catch (error) {
        console.error("Error fetching projects:", error);
      }
    };

    // Initial fetch
    loadAllTasks();

    // Set up interval-based polling (30 seconds instead of continuous)
    const intervalId = setInterval(loadAllTasks, 30000);

    // Cleanup interval on unmount
    return () => clearInterval(intervalId);
  }, []);

  // Fetch tasks for each project when projects change
  useEffect(() => {
    const loadProjectTasks = async () => {
      setIsLoading(true);
      try {
        const allTasks: Task[] = [];
        
        for (const project of projects) {
          try {
            const projectTasks = await fetchProjectTasks(project.id);
            
            // Transform ProjectTask to Calendar Task
            const transformedTasks = projectTasks
              .filter(task => task.deadline) // Only include tasks with deadlines
              .map((task): Task => ({
                id: task.id,
                name: task.name,
                projectId: project.id,
                projectName: project.name,
                dueDate: new Date(task.deadline!),
                status: task.status === "completed" ? "done" : task.status === "in-progress" ? "in-progress" : "todo",
                assignedTo: {
                  id: task.assignee || "unknown",
                  name: task.assignee_name || "Unassigned",
                  avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${task.assignee_name || "default"}`,
                },
              }));
            
            allTasks.push(...transformedTasks);
          } catch (error) {
            console.error(`Error fetching tasks for project ${project.id}:`, error);
          }
        }
        
        setTasks(allTasks);
      } catch (error) {
        console.error("Error loading project tasks:", error);
      } finally {
        setIsLoading(false);
      }
    };

    if (projects.length > 0) {
      loadProjectTasks();
    } else {
      setIsLoading(false);
    }
  }, [projects, fetchProjectTasks]);

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const calendarStart = startOfWeek(monthStart);
  const calendarEnd = endOfWeek(monthEnd);
  const calendarDays = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

  const getTasksForDate = (date: Date): Task[] => {
    return tasks.filter((task) => isSameDay(task.dueDate, date));
  };

  // Group tasks by status, then by project - memoized to prevent unnecessary recalculation
  const groupedTasks = useMemo(() => {
    const grouped: Record<string, Record<string, Task[]>> = {
      urgent: {},
      due: {},
      completed: {},
    };

    tasks.forEach((task) => {
      const status = getTaskStatus(task);
      const statusKey =
        status === "urgent" || status === "overdue"
          ? "urgent"
          : status === "due"
          ? "due"
          : "completed";

      if (!grouped[statusKey][task.projectName]) {
        grouped[statusKey][task.projectName] = [];
      }
      grouped[statusKey][task.projectName].push(task);
    });

    // Sort projects within each status and sort tasks within each project
    Object.keys(grouped).forEach((statusKey) => {
      Object.keys(grouped[statusKey]).forEach((projectName) => {
        grouped[statusKey][projectName].sort(
          (a, b) => a.dueDate.getTime() - b.dueDate.getTime()
        );
      });
    });

    return grouped;
  }, [tasks]);

  const toggleBranch = (branchKey: string) => {
    setExpandedBranches((prev) => ({
      ...prev,
      [branchKey]: !prev[branchKey],
    }));
  };

  const toggleProjectBranch = (projectKey: string) => {
    setExpandedBranches((prev) => ({
      ...prev,
      [projectKey]: !prev[projectKey],
    }));
  };

  // Get next deadline
  const nextDeadline = tasks
    .filter(task => task.status !== "done" && task.dueDate >= new Date())
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

  // Tree Node Component
  const TreeNode = ({
    label,
    branchKey,
    isExpanded,
    onToggle,
    children,
    icon,
    count,
  }: {
    label: string;
    branchKey: string;
    isExpanded: boolean;
    onToggle: () => void;
    children: React.ReactNode;
    icon?: React.ReactNode;
    count?: number;
  }) => (
    <div className="mb-4">
      <button
        onClick={onToggle}
        className="flex w-full items-center gap-3 rounded-lg p-3 hover:bg-secondary/50 transition-colors"
      >
        {isExpanded ? (
          <ChevronDown className="h-5 w-5 text-primary flex-shrink-0" />
        ) : (
          <ChevronRight className="h-5 w-5 text-muted-foreground flex-shrink-0" />
        )}
        {icon}
        <span className="font-semibold text-foreground flex-1 text-left">{label}</span>
        {count !== undefined && (
          <span className="text-xs px-2 py-1 bg-primary/20 text-primary rounded-full font-medium">
            {count}
          </span>
        )}
      </button>
      {isExpanded && <div className="ml-4 space-y-2">{children}</div>}
    </div>
  );

  // Task Item Component
  const TaskItem = ({ task }: { task: Task }) => {
    const status = getTaskStatus(task);
    const daysLeft = differenceInDays(task.dueDate, new Date());
    return (
      <div
        onClick={() => navigate(`/projects/${task.projectId}`)}
        className={cn(
          "p-3 rounded-lg border-2 cursor-pointer transition-all hover:shadow-lg hover:scale-102 group",
          status === "urgent" || status === "overdue"
            ? "border-destructive bg-destructive/10"
            : "border-border/50 bg-secondary/30"
        )}
      >
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="flex-1">
            <p className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors">
              {task.name}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {daysLeft === 0
                ? "Due today!"
                : daysLeft === 1
                ? "Due tomorrow"
                : daysLeft < 0
                ? `${Math.abs(daysLeft)} days overdue`
                : `Due in ${daysLeft} days`}
            </p>
          </div>
          <Avatar className="h-6 w-6 flex-shrink-0">
            <AvatarImage src={task.assignedTo.avatar} />
            <AvatarFallback className="text-[10px]">
              {task.assignedTo.name.charAt(0)}
            </AvatarFallback>
          </Avatar>
        </div>
      </div>
    );
  };

  return (
    <MainLayout>
      <div className="animate-fade-in space-y-6 sm:space-y-8">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-foreground bg-gradient-to-r from-primary to-primary/50 bg-clip-text text-transparent">
              Project Deadlines
            </h1>
            <p className="mt-1 text-muted-foreground">
              Track deadlines and stay on schedule
            </p>
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
        <div className="grid gap-6 lg:grid-cols-[1fr_350px]">
          {/* Left: Tree View */}
          <div className="space-y-6">
            {/* Next Deadline Countdown */}
            {nextDeadline && <CountdownTimer targetDate={nextDeadline.dueDate} />}

            {/* Task Tree */}
            <div className="glass-card p-6 rounded-lg border border-border/50">
              <h2 className="text-2xl font-bold text-foreground mb-6">Tasks by Priority</h2>

              {/* Urgent Section */}
              <TreeNode
                label="Urgent / Overdue"
                branchKey="urgent"
                isExpanded={expandedBranches.urgent}
                onToggle={() => toggleBranch("urgent")}
                count={
                  Object.values(groupedTasks.urgent).reduce(
                    (sum, tasks) => sum + tasks.length,
                    0
                  ) || 0
                }
                icon={
                  <div className="h-3 w-3 rounded-full bg-destructive shadow-glow" />
                }
              >
                {Object.entries(groupedTasks.urgent).map(
                  ([projectName, tasks]) => (
                    <div key={projectName} className="mb-3">
                      <button
                        onClick={() =>
                          toggleProjectBranch(`urgent-${projectName}`)
                        }
                        className="flex w-full items-center gap-2 p-2 hover:bg-secondary/30 rounded transition-colors"
                      >
                        {expandedBranches[`urgent-${projectName}`] !== false ? (
                          <ChevronDown className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        )}
                        <span className="font-medium text-sm text-foreground">
                          {projectName}
                        </span>
                        <span className="text-xs px-1.5 py-0.5 bg-destructive/20 text-destructive rounded font-medium ml-auto">
                          {tasks.length}
                        </span>
                      </button>
                      {expandedBranches[`urgent-${projectName}`] !== false && (
                        <div className="ml-4 space-y-2 mt-2">
                          {tasks.map((task) => (
                            <TaskItem key={task.id} task={task} />
                          ))}
                        </div>
                      )}
                    </div>
                  )
                )}
              </TreeNode>

              {/* Due Soon Section */}
              <TreeNode
                label="Due Soon"
                branchKey="due"
                isExpanded={expandedBranches.due}
                onToggle={() => toggleBranch("due")}
                count={
                  Object.values(groupedTasks.due).reduce(
                    (sum, tasks) => sum + tasks.length,
                    0
                  ) || 0
                }
                icon={
                  <div className="h-3 w-3 rounded-full bg-warning shadow-glow" />
                }
              >
                {Object.entries(groupedTasks.due).map(([projectName, tasks]) => (
                  <div key={projectName} className="mb-3">
                    <button
                      onClick={() =>
                        toggleProjectBranch(`due-${projectName}`)
                      }
                      className="flex w-full items-center gap-2 p-2 hover:bg-secondary/30 rounded transition-colors"
                    >
                      {expandedBranches[`due-${projectName}`] !== false ? (
                        <ChevronDown className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      )}
                      <span className="font-medium text-sm text-foreground">
                        {projectName}
                      </span>
                      <span className="text-xs px-1.5 py-0.5 bg-warning/20 text-warning rounded font-medium ml-auto">
                        {tasks.length}
                      </span>
                    </button>
                    {expandedBranches[`due-${projectName}`] !== false && (
                      <div className="ml-4 space-y-2 mt-2">
                        {tasks.map((task) => (
                          <TaskItem key={task.id} task={task} />
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </TreeNode>

              {/* Completed Section */}
              <TreeNode
                label="Completed"
                branchKey="completed"
                isExpanded={expandedBranches.completed}
                onToggle={() => toggleBranch("completed")}
                count={
                  Object.values(groupedTasks.completed).reduce(
                    (sum, tasks) => sum + tasks.length,
                    0
                  ) || 0
                }
                icon={
                  <div className="h-3 w-3 rounded-full bg-success shadow-glow" />
                }
              >
                {Object.entries(groupedTasks.completed).map(
                  ([projectName, tasks]) => (
                    <div key={projectName} className="mb-3">
                      <button
                        onClick={() =>
                          toggleProjectBranch(`completed-${projectName}`)
                        }
                        className="flex w-full items-center gap-2 p-2 hover:bg-secondary/30 rounded transition-colors"
                      >
                        {expandedBranches[`completed-${projectName}`] !== false ? (
                          <ChevronDown className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        )}
                        <span className="font-medium text-sm text-foreground">
                          {projectName}
                        </span>
                        <span className="text-xs px-1.5 py-0.5 bg-success/20 text-success rounded font-medium ml-auto">
                          {tasks.length}
                        </span>
                      </button>
                      {expandedBranches[`completed-${projectName}`] !== false && (
                        <div className="ml-4 space-y-2 mt-2">
                          {tasks.map((task) => (
                            <TaskItem key={task.id} task={task} />
                          ))}
                        </div>
                      )}
                    </div>
                  )
                )}
              </TreeNode>
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
                    onClick={() => navigate(`/projects/${task.projectId}`)}
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
