import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/dashboard/StatusBadge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Switch } from "@/components/ui/switch";

import { ArrowLeft, Plus, Upload, Link as LinkIcon, FileText, X, Calendar as CalendarIcon, Repeat, Clock } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format, addDays, addWeeks, addMonths } from "date-fns";
import { cn } from "@/lib/utils";

import { useAuth } from "@/contexts/AuthContext";
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  TouchSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

const projectData = {
  id: "",
  name: "",
  description: "",
  teamMembers: [],
};

type TaskStatus = "planning" | "in-progress" | "completed";
type RecurrenceType = "daily" | "weekly" | "monthly" | "custom";

type Task = {
  id: string;
  name: string;
  description: string;
  assignee: { id: string; name: string; avatar: string };
  status: TaskStatus;
  deadline: string;
  time: string;
  recurrence?: { type: RecurrenceType; days?: number };
  createdAt: string;
};

const initialTasks: Task[] = [];

interface ProjectSample {
  id: string;
  name: string;
  type: "file" | "link";
  url?: string;
  description?: string;
}

const initialSamples: ProjectSample[] = [
  { id: "1", name: "Reference Design 1", type: "link", url: "https://example.com/ref1", description: "Similar style to what we want" },
  { id: "2", name: "Brand Guidelines.pdf", type: "file", description: "Our brand colors and fonts" },
];

const RECURRENCE_LABELS: Record<RecurrenceType, string> = {
  daily:   "Daily (every 24 hrs)",
  weekly:  "Weekly",
  monthly: "Monthly",
  custom:  "Custom interval",
};

function spawnRecurringTask(task: Task): Task {
  let baseDate: Date;
  try {
    baseDate = new Date(`${task.deadline}T${task.time || "09:00"}`);
    if (isNaN(baseDate.getTime())) baseDate = new Date();
  } catch {
    baseDate = new Date();
  }

  const rec = task.recurrence!;
  let nextDate: Date;
  switch (rec.type) {
    case "daily":   nextDate = addDays(baseDate, 1); break;
    case "weekly":  nextDate = addWeeks(baseDate, 1); break;
    case "monthly": nextDate = addMonths(baseDate, 1); break;
    case "custom":  nextDate = addDays(baseDate, rec.days ?? 1); break;
  }

  return {
    ...task,
    id: `${task.id}-r-${Date.now()}`,
    status: "planning",
    deadline: format(nextDate, "yyyy-MM-dd"),
    createdAt: new Date().toISOString(),
  };
}

export default function ProjectBoard() {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const isTalent = user?.role === "talent";
  const [tasks, setTasks] = useState(initialTasks);
  const [samples, setSamples] = useState<ProjectSample[]>(initialSamples);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSampleDialogOpen, setIsSampleDialogOpen] = useState(false);
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);

  // Task form state
  const [taskName, setTaskName]               = useState("");
  const [taskDescription, setTaskDescription] = useState("");
  const [taskAssignee, setTaskAssignee]       = useState("");
  const [taskDeadline, setTaskDeadline]       = useState<Date | undefined>(undefined);
  const [taskTime, setTaskTime]               = useState("09:00");
  const [taskRecurring, setTaskRecurring]     = useState(false);
  const [taskRecurrence, setTaskRecurrence]   = useState<RecurrenceType>("daily");
  const [taskRecurrenceDays, setTaskRecurrenceDays] = useState(2);

  const [sampleFormData, setSampleFormData] = useState({
    name: "",
    type: "file" as "file" | "link",
    url: "",
    description: "",
  });

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 2 } }),
    useSensor(TouchSensor,   { activationConstraint: { delay: 180, tolerance: 6 } })
  );

  const resetTaskForm = () => {
    setTaskName(""); setTaskDescription(""); setTaskAssignee("");
    setTaskDeadline(undefined); setTaskTime("09:00");
    setTaskRecurring(false); setTaskRecurrence("daily"); setTaskRecurrenceDays(2);
  };

  const updateTaskStatus = (taskId: string, newStatus: TaskStatus) => {
    setTasks(prev => {
      const updated = prev.map(t => t.id === taskId ? { ...t, status: newStatus } : t);
      if (newStatus === "completed") {
        const done = prev.find(t => t.id === taskId);
        if (done?.recurrence) {
          toast.success("Task completed — next occurrence scheduled!");
          return [...updated, spawnRecurringTask(done)];
        }
      }
      toast.success("Task status updated!");
      return updated;
    });
  };

  const handleCreateTask = () => {
    if (!taskName.trim()) { toast.error("Task name is required"); return; }

    const newTask: Task = {
      id: Date.now().toString(),
      name: taskName.trim(),
      description: taskDescription.trim(),
      assignee: { id: taskAssignee, name: taskAssignee || "Unassigned", avatar: "" },
      status: "planning",
      deadline: taskDeadline ? format(taskDeadline, "yyyy-MM-dd") : "",
      time: taskTime,
      ...(taskRecurring && {
        recurrence: {
          type: taskRecurrence,
          ...(taskRecurrence === "custom" && { days: taskRecurrenceDays }),
        },
      }),
      createdAt: new Date().toISOString(),
    };

    setTasks(prev => [...prev, newTask]);
    toast.success("Task created successfully!");
    resetTaskForm();
    setIsDialogOpen(false);
  };

  const handleAddSample = () => {
    if (!sampleFormData.name.trim()) { toast.error("Please provide a name for the sample"); return; }
    if (sampleFormData.type === "link" && !sampleFormData.url.trim()) { toast.error("Please provide a URL for the link"); return; }
    setSamples([...samples, {
      id: Date.now().toString(),
      name: sampleFormData.name,
      type: sampleFormData.type,
      url: sampleFormData.url || undefined,
      description: sampleFormData.description || undefined,
    }]);
    toast.success("Sample added successfully!");
    setSampleFormData({ name: "", type: "file", url: "", description: "" });
    setIsSampleDialogOpen(false);
  };

  const handleDeleteSample = (sampleId: string) => {
    setSamples(samples.filter(s => s.id !== sampleId));
    toast.success("Sample removed");
  };

  const statusColumns: { key: TaskStatus; title: string; helper: string }[] = [
    { key: "planning",    title: "Planning",    helper: "Ready to start" },
    { key: "in-progress", title: "In Progress", helper: "Currently active" },
    { key: "completed",   title: "Completed",   helper: "Finished tasks" },
  ];

  const isStatusColumn = (v: string): v is TaskStatus => statusColumns.some(c => c.key === v);

  const handleDragStart = (e: DragStartEvent) => setActiveTaskId(e.active.id as string);
  const handleDragEnd   = (e: DragEndEvent) => {
    const s = e.over?.data.current?.status as TaskStatus | undefined;
    if (activeTaskId && s && isStatusColumn(s)) updateTaskStatus(activeTaskId, s);
    setActiveTaskId(null);
  };
  const handleDragCancel = () => setActiveTaskId(null);

  const TaskCardContent = ({ task }: { task: Task }) => (
    <>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <p className="font-medium text-foreground truncate">{task.name}</p>
            {task.recurrence && (
              <span title={`Repeats ${RECURRENCE_LABELS[task.recurrence.type]}`} className="shrink-0">
                <Repeat className="h-3 w-3 text-purple-500" />
              </span>
            )}
          </div>
          {task.description && <p className="text-sm text-muted-foreground truncate">{task.description}</p>}
        </div>
        <StatusBadge status={task.status} />
      </div>
      <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
        <div className="flex items-center gap-2">
          <Avatar className="h-6 w-6">
            <AvatarImage src={task.assignee.avatar} alt={task.assignee.name} />
            <AvatarFallback className="bg-primary/20 text-primary text-[10px]">{task.assignee.name.charAt(0)}</AvatarFallback>
          </Avatar>
          <span>{task.assignee.name}</span>
        </div>
        {task.deadline && (
          <span className="flex items-center gap-1">
            <CalendarIcon className="h-3 w-3" />
            {task.deadline}
            {task.time && (
              <span className="flex items-center gap-0.5 ml-1">
                <Clock className="h-3 w-3" />{task.time}
              </span>
            )}
          </span>
        )}
      </div>
    </>
  );

  const DraggableTaskCard = ({ task }: { task: Task }) => {
    const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: task.id });
    return (
      <div
        ref={setNodeRef} {...attributes} {...listeners}
        onPointerDown={(e) => e.preventDefault()}
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => { if (!isDragging) navigate(`/projects/${projectId}/tasks/${task.id}`); }}
        className={
          "relative rounded-xl border border-border/50 bg-secondary/20 p-4 shadow-sm transition-all hover:bg-secondary/30 " +
          "touch-none select-none cursor-grab active:cursor-grabbing ring-1 ring-primary/20 " +
          "shadow-[0_0_14px_rgba(59,130,246,0.18)] hover:shadow-[0_0_20px_rgba(59,130,246,0.3)] " +
          (isDragging ? "shadow-[0_0_28px_rgba(59,130,246,0.45)]" : "animate-pulse")
        }
        style={{ transform: CSS.Transform.toString(transform), transition: isDragging ? "none" : "transform 160ms ease", opacity: isDragging ? 0.6 : 1, touchAction: "none" }}
      >
        <TaskCardContent task={task} />
      </div>
    );
  };

  const DragOverlayCard = ({ task }: { task: Task }) => (
    <div className="rounded-xl border border-border/50 bg-secondary/30 p-4 shadow-md ring-1 ring-primary/30 shadow-[0_0_28px_rgba(59,130,246,0.45)]" style={{ zIndex: 50 }}>
      <TaskCardContent task={task} />
    </div>
  );

  const activeTask = activeTaskId ? tasks.find(t => t.id === activeTaskId) : null;

  const TaskColumn = ({ column, columnTasks }: { column: typeof statusColumns[0]; columnTasks: Task[] }) => {
    const { setNodeRef, isOver } = useDroppable({ id: column.key, data: { status: column.key } });
    return (
      <div
        ref={setNodeRef}
        className="flex flex-col rounded-2xl border border-border/50 bg-secondary/10 p-5 min-h-[280px] transition-colors"
        style={{ outline: isOver ? "2px solid hsl(var(--primary))" : "none", outlineOffset: "2px" }}
      >
        <div className="mb-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-foreground">{column.title}</h3>
            <span className="text-xs text-muted-foreground">{columnTasks.length}</span>
          </div>
          <p className="text-xs text-muted-foreground mt-1">{column.helper}</p>
        </div>
        <div className="flex flex-1 flex-col gap-3">
          {columnTasks.length === 0 ? (
            <div className="flex flex-1 items-center justify-center rounded-lg border border-dashed border-border/50 text-xs text-muted-foreground">
              Drop tasks here
            </div>
          ) : (
            columnTasks.map(t => <DraggableTaskCard key={t.id} task={t} />)
          )}
        </div>
      </div>
    );
  };

  return (
    <MainLayout>
      <div className="animate-fade-in space-y-6 sm:space-y-8">

        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
          <Button variant="ghost" size="icon" onClick={() => navigate("/projects")} className="mt-1">
            <ArrowLeft className="h-5 w-5" />
          </Button>

          <div className="flex-1">
            <h1 className="text-2xl sm:text-3xl font-bold text-foreground leading-tight">{projectData.name}</h1>
            <p className="mt-1 text-muted-foreground">{projectData.description}</p>
            <div className="mt-4 flex items-center gap-3">
              <span className="text-sm text-muted-foreground">Team:</span>
              <div className="flex -space-x-2">
                {projectData.teamMembers.map((member) => (
                  <Avatar key={member.id} className="h-8 w-8 border-2 border-card">
                    <AvatarImage src={member.avatar} alt={member.name} />
                    <AvatarFallback className="bg-primary/20 text-primary text-xs">{member.name.charAt(0)}</AvatarFallback>
                  </Avatar>
                ))}
              </div>
            </div>
          </div>

          {/* ── Create Task Dialog ── */}
          <Dialog open={isDialogOpen} onOpenChange={(v) => { setIsDialogOpen(v); if (!v) resetTaskForm(); }}>
            <DialogTrigger asChild>
              <Button className="gap-2 w-full sm:w-auto">
                <Plus className="h-4 w-4" />
                Create Task
              </Button>
            </DialogTrigger>
            <DialogContent className="glass-card border-border/50 sm:max-w-lg max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Create New Task</DialogTitle>
                <DialogDescription>Add a new task to this project.</DialogDescription>
              </DialogHeader>

              <div className="space-y-5 py-4">

                {/* Name */}
                <div className="space-y-2">
                  <Label htmlFor="taskName">Task Name</Label>
                  <Input
                    id="taskName"
                    placeholder="Enter task name"
                    value={taskName}
                    onChange={(e) => setTaskName(e.target.value)}
                  />
                </div>

                {/* Description */}
                <div className="space-y-2">
                  <Label htmlFor="taskDescription">Description</Label>
                  <Textarea
                    id="taskDescription"
                    placeholder="Describe the task"
                    value={taskDescription}
                    onChange={(e) => setTaskDescription(e.target.value)}
                  />
                </div>

                {/* Assignee */}
                <div className="space-y-2">
                  <Label htmlFor="assignee">Assign To</Label>
                  <Select value={taskAssignee} onValueChange={setTaskAssignee}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select team member" />
                    </SelectTrigger>
                    <SelectContent>
                      {projectData.teamMembers.map((member) => (
                        <SelectItem key={member.id} value={member.id}>{member.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Deadline + Time */}
                <div className="space-y-2">
                  <Label>Deadline</Label>
                  <div className="flex gap-2">
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn("flex-1 justify-start text-left font-normal", !taskDeadline && "text-muted-foreground")}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4 shrink-0" />
                          {taskDeadline ? format(taskDeadline, "PPP") : "Pick a date"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={taskDeadline}
                          onSelect={setTaskDeadline}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>

                    <div className="relative">
                      <Clock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                      <Input
                        type="time"
                        value={taskTime}
                        onChange={(e) => setTaskTime(e.target.value)}
                        className="pl-9 w-32"
                      />
                    </div>
                  </div>
                </div>

                {/* Recurring */}
                <div className="rounded-lg border border-border/50 bg-secondary/10 p-4 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Repeat className="h-4 w-4 text-purple-500" />
                      <div>
                        <p className="text-sm font-medium text-foreground">Recurring task</p>
                        <p className="text-xs text-muted-foreground">Auto-respawns when completed</p>
                      </div>
                    </div>
                    <Switch
                      checked={taskRecurring}
                      onCheckedChange={setTaskRecurring}
                      className="data-[state=checked]:bg-purple-600"
                    />
                  </div>

                  {taskRecurring && (
                    <div className="space-y-3 pt-1 border-t border-border/40">
                      <div className="space-y-2">
                        <Label className="text-xs text-muted-foreground uppercase tracking-wide">Repeat every</Label>
                        <Select
                          value={taskRecurrence}
                          onValueChange={(v) => setTaskRecurrence(v as RecurrenceType)}
                        >
                          <SelectTrigger className="hover:border-purple-400 hover:text-purple-700 transition-colors">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {(Object.entries(RECURRENCE_LABELS) as [RecurrenceType, string][]).map(([key, label]) => (
                              <SelectItem key={key} value={key}>{label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      {taskRecurrence === "custom" && (
                        <div className="flex items-center gap-2">
                          <Label className="text-sm whitespace-nowrap">Every</Label>
                          <Input
                            type="number"
                            min={1}
                            max={365}
                            value={taskRecurrenceDays}
                            onChange={(e) => setTaskRecurrenceDays(Math.max(1, parseInt(e.target.value) || 1))}
                            className="w-20"
                          />
                          <span className="text-sm text-muted-foreground">days</span>
                        </div>
                      )}

                      <p className="text-xs text-purple-600 bg-purple-50 dark:bg-purple-950/30 dark:text-purple-400 rounded-md px-3 py-2">
                        When completed, the next occurrence drops back into Planning automatically at {taskTime} on the next {taskRecurrence === "custom" ? `${taskRecurrenceDays}-day` : taskRecurrence} interval.
                      </p>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <Button variant="outline" onClick={() => { setIsDialogOpen(false); resetTaskForm(); }}>Cancel</Button>
                <Button onClick={handleCreateTask}>Create Task</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Project Samples - Creator Only */}
        {!isTalent && (
          <div className="glass-card p-5 sm:p-6 md:p-7">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-semibold text-foreground">Project Samples & References</h2>
                <p className="text-sm text-muted-foreground">Add reference materials for your team to follow</p>
              </div>
              <Dialog open={isSampleDialogOpen} onOpenChange={setIsSampleDialogOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" className="gap-2"><Plus className="h-4 w-4" />Add Sample</Button>
                </DialogTrigger>
                <DialogContent className="glass-card border-border/50 sm:max-w-md">
                  <DialogHeader>
                    <DialogTitle>Add Project Sample</DialogTitle>
                    <DialogDescription>Add a reference file or link for your team to follow</DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label htmlFor="sampleName">Sample Name</Label>
                      <Input id="sampleName" placeholder="e.g., Reference Design" value={sampleFormData.name} onChange={(e) => setSampleFormData({ ...sampleFormData, name: e.target.value })} />
                    </div>
                    <div className="space-y-2">
                      <Label>Type</Label>
                      <Select value={sampleFormData.type} onValueChange={(v: "file" | "link") => setSampleFormData({ ...sampleFormData, type: v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="file">File Upload</SelectItem>
                          <SelectItem value="link">Link/URL</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    {sampleFormData.type === "link" && (
                      <div className="space-y-2">
                        <Label htmlFor="sampleUrl">URL</Label>
                        <Input id="sampleUrl" placeholder="https://..." value={sampleFormData.url} onChange={(e) => setSampleFormData({ ...sampleFormData, url: e.target.value })} />
                      </div>
                    )}
                    <div className="space-y-2">
                      <Label htmlFor="sampleDescription">Description (Optional)</Label>
                      <Textarea id="sampleDescription" placeholder="Why is this sample important?" value={sampleFormData.description} onChange={(e) => setSampleFormData({ ...sampleFormData, description: e.target.value })} />
                    </div>
                  </div>
                  <div className="flex justify-end gap-3">
                    <Button variant="outline" onClick={() => setIsSampleDialogOpen(false)}>Cancel</Button>
                    <Button onClick={handleAddSample}>Add Sample</Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {samples.map((sample) => (
                <div key={sample.id} className="rounded-lg border border-border/50 bg-secondary/30 p-4 hover:bg-secondary/50 transition-colors">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      {sample.type === "link" ? <LinkIcon className="h-4 w-4 text-primary" /> : <FileText className="h-4 w-4 text-primary" />}
                      <p className="font-medium text-foreground">{sample.name}</p>
                    </div>
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleDeleteSample(sample.id)}><X className="h-4 w-4" /></Button>
                  </div>
                  {sample.description && <p className="text-sm text-muted-foreground mb-2">{sample.description}</p>}
                  {sample.url && (
                    <a href={sample.url} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline truncate block">{sample.url}</a>
                  )}
                </div>
              ))}
              {samples.length === 0 && (
                <div className="col-span-full text-center py-8 text-muted-foreground">
                  <Upload className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>No samples added yet</p>
                  <p className="text-sm">Add reference materials to help guide your team</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Task Board */}
        <div className="glass-card p-5 sm:p-6 md:p-7">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-foreground">Tasks</h2>
              <p className="text-sm text-muted-foreground">Drag and drop tasks between stages. On mobile, hold to drag.</p>
            </div>
          </div>
          <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd} onDragCancel={handleDragCancel}>
            <div className="grid gap-5 md:grid-cols-3">
              {statusColumns.map((column) => (
                <TaskColumn key={column.key} column={column} columnTasks={tasks.filter(t => t.status === column.key)} />
              ))}
            </div>
            <DragOverlay>{activeTask ? <DragOverlayCard task={activeTask} /> : null}</DragOverlay>
          </DndContext>
        </div>

      </div>
    </MainLayout>
  );
}
