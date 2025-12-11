import { useState, useEffect } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { StatusBadge } from "@/components/dashboard/StatusBadge";
import { ChevronLeft, ChevronRight, Clock, AlertCircle } from "lucide-react";
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

// Mock tasks data
const mockTasks: Task[] = [
  {
    id: "1",
    name: "Design mockups",
    projectId: "1",
    projectName: "Brand Collaboration",
    dueDate: new Date(2024, 11, 15),
    status: "in-progress",
    assignedTo: { id: "1", name: "Alia Vance", avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Alia" },
  },
  {
    id: "2",
    name: "Final video edit",
    projectId: "2",
    projectName: "Content Series",
    dueDate: new Date(2024, 11, 18),
    status: "todo",
    assignedTo: { id: "2", name: "Ben Carter", avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Ben" },
  },
  {
    id: "3",
    name: "Logo concepts",
    projectId: "1",
    projectName: "Brand Collaboration",
    dueDate: new Date(2024, 11, 10),
    status: "done",
    assignedTo: { id: "3", name: "Clara Dane", avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Clara" },
  },
  {
    id: "6",
    name: "Promo video",
    projectId: "3",
    projectName: "Product Launch",
    dueDate: addDays(new Date(), 1),
    status: "in-progress",
    assignedTo: { id: "2", name: "Ben Carter", avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Ben" },
  },
  {
    id: "7",
    name: "URGENT: Brand Guidelines",
    projectId: "1",
    projectName: "Brand Collaboration",
    dueDate: addDays(new Date(), 0),
    status: "in-progress",
    assignedTo: { id: "1", name: "Alia Vance", avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Alia" },
  },
];

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
      "glass-card p-6 border-2",
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

export default function Calendar() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const navigate = useNavigate();

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const calendarStart = startOfWeek(monthStart);
  const calendarEnd = endOfWeek(monthEnd);
  const calendarDays = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

  const getTasksForDate = (date: Date): Task[] => {
    return mockTasks.filter((task) => isSameDay(task.dueDate, date));
  };

  // Get next deadline
  const nextDeadline = mockTasks
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

  return (
    <MainLayout>
      <div className="animate-fade-in space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground bg-gradient-to-r from-primary to-primary/50 bg-clip-text text-transparent">
              Project Calendar
            </h1>
            <p className="mt-1 text-muted-foreground">
              Track deadlines and stay on schedule
            </p>
          </div>

          {/* Legend */}
          <div className="hidden items-center gap-6 md:flex">
            <div className="flex items-center gap-2">
              <div className="h-3 w-3 rounded-full bg-warning shadow-glow" />
              <span className="text-sm text-muted-foreground">Due Date</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-3 w-3 rounded-full bg-success shadow-glow" />
              <span className="text-sm text-muted-foreground">Completed</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-3 w-3 rounded-full bg-destructive animate-pulse shadow-glow" />
              <span className="text-sm text-muted-foreground">Urgent/Overdue</span>
            </div>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
          {/* Calendar */}
          <div className="glass-card p-6">
            {/* Calendar Header */}
            <div className="mb-6 flex items-center justify-between">
              <h2 className="text-2xl font-bold text-foreground">
                {format(currentDate, "MMMM yyyy")}
              </h2>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={handleToday} className="font-semibold">
                  Today
                </Button>
                <Button variant="outline" size="icon" onClick={handlePrevMonth}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="icon" onClick={handleNextMonth}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Weekday Headers */}
            <div className="grid grid-cols-7 gap-2 mb-2">
              {WEEKDAYS.map((day) => (
                <div
                  key={day}
                  className="py-3 text-center text-sm font-bold text-primary uppercase tracking-wider"
                >
                  {day}
                </div>
              ))}
            </div>

            {/* Calendar Grid */}
            <div className="grid grid-cols-7 gap-2">
              {calendarDays.map((day) => {
                const tasksForDay = getTasksForDate(day);
                const isCurrentMonth = isSameMonth(day, currentDate);
                const isCurrentDay = isToday(day);
                const hasEvents = tasksForDay.length > 0;

                // Check if any urgent tasks
                const hasUrgent = tasksForDay.some(task => getTaskStatus(task) === "urgent" || getTaskStatus(task) === "overdue");

                // Group tasks by status
                const statusCounts = tasksForDay.reduce((acc, task) => {
                  const status = getTaskStatus(task);
                  acc[status] = (acc[status] || 0) + 1;
                  return acc;
                }, {} as Record<TaskStatus, number>);

                return (
                  <div
                    key={day.toISOString()}
                    onClick={() => handleDateClick(day)}
                    className={cn(
                      "group relative flex min-h-[100px] flex-col rounded-xl border-2 p-3 transition-all duration-300",
                      isCurrentMonth
                        ? "bg-secondary/50 hover:bg-secondary/70 border-border/50"
                        : "bg-secondary/10 text-muted-foreground/50 border-transparent",
                      isCurrentDay && "border-primary ring-2 ring-primary/30 shadow-glow",
                      hasUrgent && "animate-pulse-border border-destructive",
                      hasEvents && "cursor-pointer hover:shadow-xl hover:scale-105"
                    )}
                  >
                    {/* Date Number */}
                    <span
                      className={cn(
                        "mb-2 flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold transition-all",
                        isCurrentDay && "bg-gradient-to-br from-primary to-primary/70 text-primary-foreground shadow-glow scale-110",
                        !isCurrentDay && isCurrentMonth && "group-hover:bg-primary/20"
                      )}
                    >
                      {format(day, "d")}
                    </span>

                    {/* Task Indicators */}
                    {hasEvents && (
                      <div className="mt-auto flex flex-wrap gap-1">
                        {Object.entries(statusCounts).map(([status, count]) => (
                          <div
                            key={status}
                            className={cn(
                              "flex h-6 min-w-6 items-center justify-center rounded-full px-1.5 text-xs font-bold text-white shadow-lg",
                              getStatusColor(status as TaskStatus)
                            )}
                          >
                            {count > 1 ? count : "•"}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Countdown Timer Sidebar */}
          <div className="space-y-6">
            {nextDeadline && <CountdownTimer targetDate={nextDeadline.dueDate} />}

            {/* Upcoming Deadlines */}
            <div className="glass-card p-6">
              <h3 className="font-semibold text-foreground mb-4">Upcoming Deadlines</h3>
              <div className="space-y-3">
                {mockTasks
                  .filter(task => task.status !== "done")
                  .sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime())
                  .slice(0, 5)
                  .map((task) => {
                    const status = getTaskStatus(task);
                    const daysLeft = differenceInDays(task.dueDate, new Date());
                    return (
                      <div
                        key={task.id}
                        className={cn(
                          "p-3 rounded-lg border-2 cursor-pointer transition-all hover:scale-105",
                          status === "urgent" || status === "overdue"
                            ? "border-destructive bg-destructive/10 animate-pulse-border"
                            : "border-border/50 bg-secondary/30"
                        )}
                        onClick={() => navigate(`/projects/${task.projectId}/tasks/${task.id}`)}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <div className={cn(
                            "h-2 w-2 rounded-full",
                            getStatusColor(status)
                          )} />
                          <p className="text-xs font-medium text-muted-foreground">
                            {task.projectName}
                          </p>
                        </div>
                        <p className="text-sm font-semibold text-foreground mb-2">
                          {task.name}
                        </p>
                        <div className="flex items-center justify-between">
                          <span className={cn(
                            "text-xs font-bold",
                            daysLeft <= 1 ? "text-destructive" : "text-muted-foreground"
                          )}>
                            {daysLeft === 0 ? "Today!" : daysLeft === 1 ? "Tomorrow" : `${daysLeft} days`}
                          </span>
                          <Avatar className="h-5 w-5">
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
            </div>
          </div>
        </div>

        {/* Date Details Dialog */}
        <Dialog open={!!selectedDate} onOpenChange={() => setSelectedDate(null)}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle className="text-2xl">
                {selectedDate && format(selectedDate, "MMMM d, yyyy")}
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-3">
              {selectedDateTasks.map((task) => {
                const status = getTaskStatus(task);
                return (
                  <div
                    key={task.id}
                    className={cn(
                      "glass-card cursor-pointer p-4 transition-all hover:shadow-xl border-2",
                      status === "urgent" || status === "overdue"
                        ? "border-destructive animate-pulse-border"
                        : "border-border/50"
                    )}
                    onClick={() => navigate(`/projects/${task.projectId}/tasks/${task.id}`)}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <p className="text-xs text-muted-foreground font-medium">
                          {task.projectName}
                        </p>
                        <h4 className="mt-1 font-bold text-foreground text-lg">
                          {task.name}
                        </h4>
                      </div>
                      <StatusBadge
                        status={
                          status === "completed"
                            ? "completed"
                            : status === "overdue"
                            ? "overdue"
                            : status === "urgent"
                            ? "urgent"
                            : task.status === "in-progress"
                            ? "in-progress"
                            : "todo"
                        }
                      />
                    </div>

                    <div className="mt-3 flex items-center gap-2">
                      <Avatar className="h-7 w-7">
                        <AvatarImage src={task.assignedTo.avatar} />
                        <AvatarFallback className="text-xs">
                          {task.assignedTo.name.charAt(0)}
                        </AvatarFallback>
                      </Avatar>
                      <span className="text-sm font-medium text-muted-foreground">
                        {task.assignedTo.name}
                      </span>
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
