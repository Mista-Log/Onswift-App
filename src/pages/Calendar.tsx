import { useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { StatusBadge } from "@/components/dashboard/StatusBadge";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
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
    id: "4",
    name: "Thumbnail designs",
    projectId: "2",
    projectName: "Content Series",
    dueDate: new Date(2024, 11, 8),
    status: "todo",
    assignedTo: { id: "1", name: "Alia Vance", avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Alia" },
  },
  {
    id: "5",
    name: "Social media assets",
    projectId: "3",
    projectName: "Product Launch",
    dueDate: new Date(2024, 11, 20),
    status: "in-progress",
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
    case "overdue": return "bg-destructive";
    case "urgent": return "bg-destructive";
    case "due": return "bg-warning";
    default: return "bg-muted";
  }
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

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
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Project Calendar</h1>
            <p className="mt-1 text-muted-foreground">
              View all project deadlines and task due dates
            </p>
          </div>

          {/* Legend */}
          <div className="hidden items-center gap-6 md:flex">
            <div className="flex items-center gap-2">
              <div className="h-3 w-3 rounded-full bg-warning" />
              <span className="text-sm text-muted-foreground">Due Date</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-3 w-3 rounded-full bg-success" />
              <span className="text-sm text-muted-foreground">Completed</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-3 w-3 rounded-full bg-destructive" />
              <span className="text-sm text-muted-foreground">Overdue/Urgent</span>
            </div>
          </div>
        </div>

        {/* Calendar */}
        <div className="glass-card p-6">
          {/* Calendar Header */}
          <div className="mb-6 flex items-center justify-between">
            <h2 className="text-xl font-semibold text-foreground">
              {format(currentDate, "MMMM yyyy")}
            </h2>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={handleToday}>
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
          <div className="grid grid-cols-7 gap-1 mb-1">
            {WEEKDAYS.map((day) => (
              <div
                key={day}
                className="py-2 text-center text-sm font-medium text-muted-foreground"
              >
                {day}
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
                    "group relative flex min-h-[100px] flex-col rounded-lg border border-transparent p-2 transition-all duration-200",
                    isCurrentMonth
                      ? "bg-secondary/30 hover:bg-secondary/50"
                      : "bg-secondary/10 text-muted-foreground/50",
                    isCurrentDay && "border-primary ring-1 ring-primary/50",
                    hasEvents && "cursor-pointer hover:shadow-glow"
                  )}
                >
                  {/* Date Number */}
                  <span
                    className={cn(
                      "mb-1 flex h-7 w-7 items-center justify-center rounded-full text-sm font-medium",
                      isCurrentDay && "bg-primary text-primary-foreground"
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
                            "flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-xs font-medium text-white",
                            getStatusColor(status as TaskStatus)
                          )}
                        >
                          {count > 1 ? count : ""}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Mobile Legend */}
          <div className="mt-6 flex flex-wrap items-center justify-center gap-4 md:hidden">
            <div className="flex items-center gap-2">
              <div className="h-3 w-3 rounded-full bg-warning" />
              <span className="text-sm text-muted-foreground">Due</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-3 w-3 rounded-full bg-success" />
              <span className="text-sm text-muted-foreground">Done</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-3 w-3 rounded-full bg-destructive" />
              <span className="text-sm text-muted-foreground">Overdue</span>
            </div>
          </div>
        </div>

        {/* Date Details Dialog */}
        <Dialog open={!!selectedDate} onOpenChange={() => setSelectedDate(null)}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>
                {selectedDate && format(selectedDate, "MMMM d, yyyy")}
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-3">
              {selectedDateTasks.map((task) => {
                const status = getTaskStatus(task);
                return (
                  <div
                    key={task.id}
                    className="glass-card cursor-pointer p-4 transition-all hover:shadow-glow"
                    onClick={() => navigate(`/projects/${task.projectId}/tasks/${task.id}`)}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <p className="text-xs text-muted-foreground">
                          {task.projectName}
                        </p>
                        <h4 className="mt-0.5 font-medium text-foreground">
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
                      <Avatar className="h-6 w-6">
                        <AvatarImage src={task.assignedTo.avatar} />
                        <AvatarFallback className="text-xs">
                          {task.assignedTo.name.charAt(0)}
                        </AvatarFallback>
                      </Avatar>
                      <span className="text-sm text-muted-foreground">
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
    </MainLayout>
  );
}
