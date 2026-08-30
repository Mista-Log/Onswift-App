import { useState, useEffect, useRef } from "react";
import { Switch } from "@/components/ui/switch";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { CelebrationModal } from "@/components/CelebrationModal";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/dashboard/StatusBadge";
import { Pencil} from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  ArrowLeft,
  Calendar as CalendarIcon,
  Users,
  Plus,
  UserPlus,
  ListPlus,
  MoreVertical,
  CheckCircle2,
  Circle,
  Clock,
  Repeat,
  Trash2,
  Edit,
  Loader2,
  ArrowUpDown,
  MessageCircle,
  ChevronDown,
  ChevronUp,
  Send,
  Paperclip,
  X,
  File as FileIcon,
  Upload,
} from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { secureFetch, isNetworkError } from "@/api/apiClient";
import { ClientInviteModal } from "@/components/project/ClientInviteModal";
import { ClientChatModal } from "@/components/project/ClientChatModal";
import { ClientInvitesTable } from "@/components/project/ClientInvitesTable";
import { TaskDetailModal } from "@/components/project/TaskDetailModal";
import type { TaskDetail } from "@/hooks/useTaskDetail";
import { useProjects, type Task } from "@/contexts/ProjectContext";
import { useTeam } from "@/contexts/TeamContext";
import { cn } from "@/lib/utils";
import { format, parseISO } from "date-fns";
import { DateTimePicker } from "@/components/ui/date-time-picker";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { DeliverablesPanel } from "@/components/team/DeliverablesPanel";

export default function ProjectDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuth();
  const { projects, fetchProjectTasks, addTask, updateTask, deleteTask, deleteProject, updateProject } = useProjects();
  const { teamMembers } = useTeam();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isTaskDialogOpen, setIsTaskDialogOpen] = useState(false);
  const [isRenameDialogOpen, setIsRenameDialogOpen] = useState(false);
  const [renameValue, setRenameValue] = useState("");
  const [isRenaming, setIsRenaming] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [editFormData, setEditFormData] = useState({
    name: "",
    description: "",
    assignees: [] as string[],
    status: "planning" as "planning" | "in-progress" | "completed",
    deadline: "",
  });
  const [taskFormData, setTaskFormData] = useState({
    name: "",
    description: "",
    assignees: [] as string[],
    status: "planning" as "planning" | "in-progress" | "completed",
    deadline: "",
    task_time: "09:00",
    recurrence_type: null as "daily" | "weekly" | "monthly" | "custom" | null,
    recurrence_days: 2,
  });
  const [taskRecurring, setTaskRecurring] = useState(false);
  const [sortMethod, setSortMethod] = useState<"deadline-asc" | "deadline-desc" | "alphabetical-asc" | "alphabetical-desc">("deadline-asc");
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [refreshInvitesTrigger, setRefreshInvitesTrigger] = useState(0);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [isTaskDetailOpen, setIsTaskDetailOpen] = useState(false);
  const [showTaskCelebration, setShowTaskCelebration] = useState(false);
  const [showProjectDoneCelebration, setShowProjectDoneCelebration] = useState(false);
  const [showTalentProjectDone, setShowTalentProjectDone] = useState(false);
  const [dragTaskId, setDragTaskId] = useState<string | null>(null);
  const [dragOverCol, setDragOverCol] = useState<"planning" | "in-progress" | "completed" | null>(null);
  const [activeTab, setActiveTab] = useState<"board" | "deliverables">("board");
  const [deliverablePrefill, setDeliverablePrefill] = useState<string | undefined>(undefined);
  const [uploadAttachmentSignal, setUploadAttachmentSignal] = useState(0);

  // Client chat now lives in a modal (ClientChatModal) instead of an inline card.
  const [isClientChatOpen, setIsClientChatOpen] = useState(false);

  // Deep link: /projects/:id?task=<taskId> opens that task's detail (e.g. from a notification).
  useEffect(() => {
    const taskParam = searchParams.get("task");
    if (!taskParam) return;
    setSelectedTaskId(taskParam);
    setIsTaskDetailOpen(true);
    // Strip the param so closing the modal doesn't re-open it on back/refresh.
    setSearchParams(
      (prev) => {
        prev.delete("task");
        return prev;
      },
      { replace: true },
    );
  }, [searchParams, setSearchParams]);

  const project = projects.find((p) => p.id === id);
  const isCreator = user?.role === "creator";
  const canTalentCreateTasks = !isCreator && !!project?.allow_talent_task_creation;

  useEffect(() => {
    loadTasks();
  }, [id]);

  // Celebrate a talent the first time they open a project that's been concluded.
  useEffect(() => {
    if (isCreator || !project) return;
    if (project.status !== "completed") return;
    if (localStorage.getItem("onswift_talent_project_done")) return;
    localStorage.setItem("onswift_talent_project_done", "1");
    setShowTalentProjectDone(true);
  }, [project, isCreator]);

  const loadTasks = async () => {
    if (!id) return;
    setIsLoading(true);
    try {
      const data = await fetchProjectTasks(id);
      setTasks(data);
    } finally {
      setIsLoading(false);
    }
  };

  const sortTasks = (tasksToSort: Task[]): Task[] => {
    const sortedTasks = [...tasksToSort];

    switch (sortMethod) {
      case "deadline-asc":
        return sortedTasks.sort((a, b) => {
          if (!a.deadline) return 1;
          if (!b.deadline) return -1;
          return new Date(a.deadline).getTime() - new Date(b.deadline).getTime();
        });
      case "deadline-desc":
        return sortedTasks.sort((a, b) => {
          if (!a.deadline) return 1;
          if (!b.deadline) return -1;
          return new Date(b.deadline).getTime() - new Date(a.deadline).getTime();
        });
      case "alphabetical-asc":
        return sortedTasks.sort((a, b) => a.name.localeCompare(b.name));
      case "alphabetical-desc":
        return sortedTasks.sort((a, b) => b.name.localeCompare(a.name));
      default:
        return sortedTasks;
    }
  };

  const handleCreateTask = async () => {
    if (!id || !taskFormData.name) {
      toast.error("Please enter a task name");
      return;
    }

    const isFirstTask = tasks.length === 0;

    try {
      await addTask(id, {
        name: taskFormData.name,
        description: taskFormData.description,
        assignees: taskFormData.assignees,
        status: taskFormData.status,
        deadline: taskFormData.deadline || null,
        task_time: taskFormData.task_time || null,
        recurrence_type: taskRecurring ? taskFormData.recurrence_type : null,
        recurrence_days: taskRecurring && taskFormData.recurrence_type === "custom" ? taskFormData.recurrence_days : null,
      });

      toast.success("Task created successfully!");
      setTaskFormData({
        name: "",
        description: "",
        assignees: [],
        status: "planning",
        deadline: "",
        task_time: "09:00",
        recurrence_type: null,
        recurrence_days: 2,
      });
      setTaskRecurring(false);
      setIsTaskDialogOpen(false);
      await loadTasks();

      if (isFirstTask && !localStorage.getItem("onswift_celebrated_first_task")) {
        localStorage.setItem("onswift_celebrated_first_task", "1");
        setShowTaskCelebration(true);
      }
    } catch (error) {
      if (isNetworkError(error)) {
        toast.warning("Slow connection, your task may have been created. Refreshing...");
        setTimeout(loadTasks, 2000);
      } else {
        toast.error("Failed to create task");
      }
    }
  };

  const handleUpdateTask = async (taskId: string, updates: Partial<Task>) => {
    if (!isCreator) {
      toast.info(
        "Task stages are managed by your project creator. To show progress on a task, submit a deliverable.",
        { duration: 4000 }
      );
      return;
    }
    try {
      await updateTask(taskId, updates);
      toast.success("Task updated successfully!");
      await loadTasks();
    } catch (error) {
      if (isNetworkError(error)) {
        toast.warning("Slow connection, your change may have been saved. Refreshing...");
        setTimeout(loadTasks, 2000);
      } else {
        toast.error("Failed to update task");
      }
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    try {
      await deleteTask(taskId);
      toast.success("Task deleted successfully!");
      await loadTasks();
    } catch (error) {
      if (isNetworkError(error)) {
        toast.warning("Slow connection, checking status...");
        setTimeout(loadTasks, 2000);
      } else {
        toast.error("Failed to delete task");
      }
    }
  };

  const handleOpenEditTask = (task: Task) => {
    setEditingTask(task);
    setEditFormData({
      name: task.name,
      description: task.description || "",
      assignees: task.assignees ?? [],
      status: task.status,
      deadline: task.deadline || "",
    });
  };

  const handleOpenTaskDetail = (taskId: string) => {
    setSelectedTaskId(taskId);
    setIsTaskDetailOpen(true);
  };

  const handleTaskDetailUpdated = (updated: TaskDetail) => {
    setTasks((prev) =>
      prev.map((t) =>
        t.id === updated.id
          ? { ...t, name: updated.name, description: updated.description, status: updated.status, deadline: updated.deadline, assignees: updated.assignees, assignee_names: updated.assignee_names }
          : t
      )
    );
  };

  const handleSaveEditTask = async () => {
    if (!editingTask || !editFormData.name.trim()) {
      toast.error("Task name is required");
      return;
    }
    try {
      await updateTask(editingTask.id, {
        name: editFormData.name.trim(),
        description: editFormData.description,
        assignees: editFormData.assignees,
        status: editFormData.status,
        deadline: editFormData.deadline || null,
      });
      toast.success("Task updated!");
      setEditingTask(null);
      await loadTasks();
    } catch (error) {
      if (isNetworkError(error)) {
        toast.warning("Slow connection, your change may have been saved. Refreshing...");
        setTimeout(loadTasks, 2000);
      } else {
        toast.error("Failed to update task");
      }
    }
  };

  const handleToggleTalentTaskCreation = async (checked: boolean) => {
    if (!id) return;
    try {
      await updateProject(id, { allow_talent_task_creation: checked });
      toast.success(
        checked
          ? "Team members can now add their own tasks."
          : "Task creation is creator-only again."
      );
    } catch (error) {
      toast.error("Failed to update setting");
    }
  };

  const handleDeleteProject = async () => {
    if (!id) return;
    if (!confirm("Are you sure you want to delete this project? This action cannot be undone.")) {
      return;
    }

    try {
      await deleteProject(id);
      toast.success("Project deleted successfully!");
      navigate("/projects");
    } catch (error) {
      toast.error("Failed to delete project");
    }
  };

  const handleDrop = (e: React.DragEvent, targetStatus: "planning" | "in-progress" | "completed") => {
    e.preventDefault();
    if (dragTaskId) {
      const task = tasks.find((t) => t.id === dragTaskId);
      if (task && task.status !== targetStatus) {
        handleUpdateTask(dragTaskId, { status: targetStatus });
      }
    }
    setDragTaskId(null);
    setDragOverCol(null);
  };

  const handleRenameProject = async () => {
    if (!id) return;
    const nextName = renameValue.trim();
    if (!nextName) {
      toast.error("Project name cannot be empty");
      return;
    }

    try {
      setIsRenaming(true);
      await updateProject(id, { name: nextName });
      toast.success("Project renamed successfully!");
      setIsRenameDialogOpen(false);
    } catch (error) {
      toast.error("Failed to rename project");
    } finally {
      setIsRenaming(false);
    }
  };

  if (!project) {
    return (
      <MainLayout>
        <div className="flex flex-col items-center justify-center min-h-[400px]">
          <p className="text-muted-foreground">Project not found</p>
          <Button className="mt-4" onClick={() => navigate("/projects")}>
            Back to Projects
          </Button>
        </div>
      </MainLayout>
    );
  }

  const progress = project.task_count === 0 ? 0 : (project.completed_tasks / project.task_count) * 100;

  const planningTasks = sortTasks(tasks.filter((t) => t.status === "planning"));
  const inProgressTasks = sortTasks(tasks.filter((t) => t.status === "in-progress"));
  const completedTasks = sortTasks(tasks.filter((t) => t.status === "completed"));

  // Available team members for assignment (if creator)
  const availableAssignees = isCreator ? [
    { id: user.id, name: user.full_name },
    ...teamMembers.map((m) => ({ id: m.user_id, name: m.name }))
  ] : [];

  return (
    <MainLayout>
      <div className="animate-fade-in space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate("/projects")}
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-3xl font-bold text-foreground">
                {project.name}
              </h1>
              <p className="mt-1 text-muted-foreground">
                {project.description}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {id && user?.role !== "talent" && project?.has_clients && (
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={() => setIsClientChatOpen(true)}
              >
                <MessageCircle className="h-4 w-4" />
                <span className="hidden sm:inline">Client Chat</span>
              </Button>
            )}
          {isCreator && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon">
                  <MoreVertical className="h-5 w-5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  onClick={() => {
                    setRenameValue(project.name);
                    setIsRenameDialogOpen(true);
                  }}
                >
                  <Edit className="mr-2 h-4 w-4" />
                  Rename Project
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onSelect={(e) => e.preventDefault()}
                  className="flex items-center justify-between gap-3"
                >
                  <span className="flex items-center">
                    <ListPlus className="mr-2 h-4 w-4" />
                    Team can add tasks
                  </span>
                  <Switch
                    checked={!!project.allow_talent_task_creation}
                    onCheckedChange={handleToggleTalentTaskCreation}
                  />
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={handleDeleteProject}
                  className="text-destructive focus:text-destructive"
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete Project
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          </div>
        </div>

        <Dialog open={isRenameDialogOpen} onOpenChange={setIsRenameDialogOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Rename Project</DialogTitle>
              <DialogDescription>
                Update the project name to fix mistakes or improve clarity.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-2">
              <Label htmlFor="project-rename">Project Name</Label>
              <Input
                id="project-rename"
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleRenameProject();
                  }
                }}
                placeholder="Enter project name"
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsRenameDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleRenameProject} disabled={isRenaming || !renameValue.trim()}>
                {isRenaming ? "Saving..." : "Save"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Edit Task Dialog */}
        <Dialog open={!!editingTask} onOpenChange={(open) => { if (!open) setEditingTask(null); }}>
          <DialogContent className="glass-card border-border/50 sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Edit Task</DialogTitle>
              <DialogDescription>Update the task details below</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="edit-task-name">Task Name</Label>
                <Input
                  id="edit-task-name"
                  placeholder="Enter task name"
                  value={editFormData.name}
                  onChange={(e) => setEditFormData((prev) => ({ ...prev, name: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-task-description">Description</Label>
                <Textarea
                  id="edit-task-description"
                  placeholder="Describe the task"
                  value={editFormData.description}
                  onChange={(e) => setEditFormData((prev) => ({ ...prev, description: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Assign To</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-start font-normal">
                      {editFormData.assignees.length === 0
                        ? <span className="text-muted-foreground">Unassigned</span>
                        : availableAssignees.filter(m => editFormData.assignees.includes(m.id)).map(m => m.id === user?.id ? "Self" : m.name).join(", ")
                      }
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-64 p-2" align="start">
                    <div className="space-y-1">
                      {availableAssignees.map((member) => {
                        const checked = editFormData.assignees.includes(member.id);
                        return (
                          <button
                            key={member.id}
                            type="button"
                            onClick={() => setEditFormData(prev => ({
                              ...prev,
                              assignees: checked
                                ? prev.assignees.filter(id => id !== member.id)
                                : [...prev.assignees, member.id],
                            }))}
                            className="flex items-center gap-2 w-full px-2 py-1.5 rounded hover:bg-muted text-sm text-left"
                          >
                            <div className={cn("h-4 w-4 rounded border flex items-center justify-center flex-shrink-0", checked ? "bg-primary border-primary" : "border-border")}>
                              {checked && <svg className="h-2.5 w-2.5 text-primary-foreground" viewBox="0 0 12 12" fill="none"><path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                            </div>
                            {member.id === user?.id ? "Self" : member.name}
                          </button>
                        );
                      })}
                    </div>
                  </PopoverContent>
                </Popover>
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select
                  value={editFormData.status}
                  onValueChange={(value: "planning" | "in-progress" | "completed") =>
                    setEditFormData((prev) => ({ ...prev, status: value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="planning">Planning</SelectItem>
                    <SelectItem value="in-progress">In Progress</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Deadline</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !editFormData.deadline && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {editFormData.deadline ? format(new Date(editFormData.deadline), "PPP") : "Pick a deadline"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={editFormData.deadline ? new Date(editFormData.deadline) : undefined}
                      onSelect={(date) =>
                        setEditFormData((prev) => ({
                          ...prev,
                          deadline: date ? format(date, "yyyy-MM-dd") : "",
                        }))
                      }
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setEditingTask(null)}>Cancel</Button>
              <Button onClick={handleSaveEditTask} disabled={!editFormData.name.trim()}>
                Save Changes
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Project Info */}
        <div className="glass-card p-6 rounded-lg border border-border/50">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <p className="text-sm text-muted-foreground mb-1">Status</p>
              <StatusBadge status={project.status} />
            </div>
            <div>
              <p className="text-sm text-muted-foreground mb-1">Due Date</p>
              <p className="text-sm font-medium">{project.due_date || "—"}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground mb-1">Progress</p>
              <div className="space-y-1">
                <div className="flex justify-between text-sm">
                  <span>{Math.round(progress)}%</span>
                  <span>{project.completed_tasks}/{project.task_count}</span>
                </div>
                <div className="h-2 bg-secondary rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary transition-all"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Board / Attachments tabs */}
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "board" | "deliverables")}>
          <div className="flex items-center gap-2">
            <TabsList>
              <TabsTrigger value="board" className="text-muted-foreground data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm">Board</TabsTrigger>
              <TabsTrigger value="deliverables" className="text-muted-foreground data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm">Attachments</TabsTrigger>
            </TabsList>
            {activeTab === "deliverables" && (
              <Button
                size="icon"
                variant="outline"
                className="md:hidden h-8 w-8 shrink-0"
                onClick={() => setUploadAttachmentSignal(Date.now())}
                aria-label="Upload attachment"
              >
                <Paperclip className="h-4 w-4" />
              </Button>
            )}
          </div>

          <TabsContent value="board" className="mt-6 space-y-6">

        {/* Tasks Section */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h2 className="text-2xl font-bold">Tasks</h2>
            <Select value={sortMethod} onValueChange={(value: any) => setSortMethod(value)}>
              <SelectTrigger className="w-48">
                <ArrowUpDown className="h-4 w-4 mr-2" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="deadline-asc">Soonest deadline</SelectItem>
                <SelectItem value="deadline-desc">Latest deadline</SelectItem>
                <SelectItem value="alphabetical-asc">Name (A-Z)</SelectItem>
                <SelectItem value="alphabetical-desc">Name (Z-A)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {(isCreator || canTalentCreateTasks) && (
            <div className="flex gap-3">
              {isCreator && (
                <Button
                  variant="outline"
                  className="gap-2 px-2 sm:px-4"
                  onClick={() => setIsInviteModalOpen(true)}
                >
                  <UserPlus className="h-4 w-4 shrink-0" />
                  <span className="hidden sm:inline">New Client</span>
                </Button>
              )}
              <Dialog open={isTaskDialogOpen} onOpenChange={setIsTaskDialogOpen}>
                <DialogTrigger asChild>
                  <Button className="gap-2 px-2 sm:px-4">
                    <Plus className="h-4 w-4 shrink-0" />
                    <span className="hidden sm:inline">New Task</span>
                  </Button>
                </DialogTrigger>
              <DialogContent className="glass-card border-border/50 sm:max-w-lg max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Create New Task</DialogTitle>
                  <DialogDescription>Add a new task to this project</DialogDescription>
                </DialogHeader>
                <div className="space-y-5 py-4">

                  {/* Name */}
                  <div className="space-y-2">
                    <Label htmlFor="task-name">Task Name</Label>
                    <Input
                      id="task-name"
                      placeholder="Enter task name"
                      value={taskFormData.name}
                      onChange={(e) => setTaskFormData((prev) => ({ ...prev, name: e.target.value }))}
                    />
                  </div>

                  {/* Description */}
                  <div className="space-y-2">
                    <Label htmlFor="task-description">Description</Label>
                    <Textarea
                      id="task-description"
                      placeholder="Describe the task"
                      value={taskFormData.description}
                      onChange={(e) => setTaskFormData((prev) => ({ ...prev, description: e.target.value }))}
                    />
                  </div>

                  {/* Assignees */}
                  {isCreator ? (
                  <div className="space-y-2">
                    <Label>Assign To</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className="w-full justify-start font-normal">
                          {taskFormData.assignees.length === 0
                            ? <span className="text-muted-foreground">Unassigned</span>
                            : availableAssignees.filter(m => taskFormData.assignees.includes(m.id)).map(m => m.id === user?.id ? "Self" : m.name).join(", ")
                          }
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-64 p-2" align="start">
                        <div className="space-y-1">
                          {availableAssignees.map((member) => {
                            const checked = taskFormData.assignees.includes(member.id);
                            return (
                              <button
                                key={member.id}
                                type="button"
                                onClick={() => setTaskFormData(prev => ({
                                  ...prev,
                                  assignees: checked
                                    ? prev.assignees.filter(id => id !== member.id)
                                    : [...prev.assignees, member.id],
                                }))}
                                className="flex items-center gap-2 w-full px-2 py-1.5 rounded hover:bg-muted text-sm text-left"
                              >
                                <div className={cn("h-4 w-4 rounded border flex items-center justify-center flex-shrink-0", checked ? "bg-primary border-primary" : "border-border")}>
                                  {checked && <svg className="h-2.5 w-2.5 text-primary-foreground" viewBox="0 0 12 12" fill="none"><path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                                </div>
                                {member.id === user?.id ? "Self" : member.name}
                              </button>
                            );
                          })}
                        </div>
                      </PopoverContent>
                    </Popover>
                  </div>
                  ) : (
                  <p className="text-xs text-muted-foreground">This task will be assigned to you.</p>
                  )}

                  {/* Deadline + Time */}
                  <div className="space-y-2">
                    <Label>Deadline</Label>
                    <DateTimePicker
                      date={taskFormData.deadline ? new Date(taskFormData.deadline) : undefined}
                      time={taskFormData.task_time}
                      onDateChange={(d) => setTaskFormData((prev) => ({ ...prev, deadline: d ? format(d, "yyyy-MM-dd") : "" }))}
                      onTimeChange={(t) => setTaskFormData((prev) => ({ ...prev, task_time: t }))}
                      className="w-full"
                    />
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
                        onCheckedChange={(v) => {
                          setTaskRecurring(v);
                          if (v && !taskFormData.recurrence_type) {
                            setTaskFormData((prev) => ({ ...prev, recurrence_type: "daily" }));
                          }
                        }}
                        className="data-[state=checked]:bg-purple-600"
                      />
                    </div>

                    {taskRecurring && (
                      <div className="space-y-3 pt-1 border-t border-border/40">
                        <div className="space-y-2">
                          <Label className="text-xs text-muted-foreground uppercase tracking-wide">Repeat every</Label>
                          <Select
                            value={taskFormData.recurrence_type ?? "daily"}
                            onValueChange={(v) => setTaskFormData((prev) => ({ ...prev, recurrence_type: v as "daily" | "weekly" | "monthly" | "custom" }))}
                          >
                            <SelectTrigger className="hover:border-purple-400 hover:text-purple-700 transition-colors">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="daily">Daily (every 24 hrs)</SelectItem>
                              <SelectItem value="weekly">Weekly</SelectItem>
                              <SelectItem value="monthly">Monthly</SelectItem>
                              <SelectItem value="custom">Custom interval</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        {taskFormData.recurrence_type === "custom" && (
                          <div className="flex items-center gap-2">
                            <Label className="text-sm whitespace-nowrap">Every</Label>
                            <Input
                              type="number"
                              min={1}
                              max={365}
                              value={taskFormData.recurrence_days}
                              onChange={(e) => setTaskFormData((prev) => ({ ...prev, recurrence_days: Math.max(1, parseInt(e.target.value) || 1) }))}
                              className="w-20"
                            />
                            <span className="text-sm text-muted-foreground">days</span>
                          </div>
                        )}

                        <p className="text-xs text-purple-600 bg-purple-50 dark:bg-purple-950/30 dark:text-purple-400 rounded-md px-3 py-2">
                          When completed, the next occurrence drops back into Planning automatically at {taskFormData.task_time}.
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex justify-end gap-3 pt-2">
                  <Button variant="outline" onClick={() => setIsTaskDialogOpen(false)}>Cancel</Button>
                  <Button onClick={handleCreateTask}>Create Task</Button>
                </div>
              </DialogContent>
            </Dialog>
            </div>
          )}
        </div>

        {/* Tasks Board */}
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

              {/* Planning Column */}
              <div className="space-y-3">
                <div className="flex items-center gap-2 pb-2 border-b">
                  <Pencil className="h-4 w-4 text-yellow-500" />
                  <h3 className="font-semibold">Planning</h3>
                  <span className="text-xs text-muted-foreground">({planningTasks.length})</span>
                </div>
                <div
                  className={cn(
                    "space-y-3 min-h-[80px] rounded-lg p-1 transition-colors",
                    dragOverCol === "planning" && dragTaskId && "bg-orange-50 ring-2 ring-orange-300 ring-dashed"
                  )}
                  onDragOver={(e) => { e.preventDefault(); setDragOverCol("planning"); }}
                  onDragLeave={() => setDragOverCol(null)}
                  onDrop={(e) => handleDrop(e, "planning")}
                >
                  {planningTasks.map((task) => (
                    <TaskCard
                      key={task.id}
                      task={task}
                      isCreator={isCreator}
                      onStatusChange={(status) => handleUpdateTask(task.id, { status })}
                      onEdit={() => handleOpenTaskDetail(task.id)}
                      onDelete={() => handleDeleteTask(task.id)}
                      onAddDeliverable={!isCreator ? () => { setActiveTab("deliverables"); setDeliverablePrefill(task.id); } : undefined}
                      onDragStart={() => setDragTaskId(task.id)}
                      onDragEnd={() => { setDragTaskId(null); setDragOverCol(null); }}
                    />
                  ))}
                  {planningTasks.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-8">No tasks in planning</p>
                  )}
                </div>
              </div>

              {/* In Progress Column */}
              <div className="space-y-3">
                <div className="flex items-center gap-2 pb-2 border-b">
                  <Clock className="h-4 w-4 text-primary" />
                  <h3 className="font-semibold">In Progress</h3>
                  <span className="text-xs text-muted-foreground">({inProgressTasks.length})</span>
                </div>
                <div
                  className={cn(
                    "space-y-3 min-h-[80px] rounded-lg p-1 transition-colors",
                    dragOverCol === "in-progress" && dragTaskId && "bg-yellow-50 ring-2 ring-yellow-300 ring-dashed"
                  )}
                  onDragOver={(e) => { e.preventDefault(); setDragOverCol("in-progress"); }}
                  onDragLeave={() => setDragOverCol(null)}
                  onDrop={(e) => handleDrop(e, "in-progress")}
                >
                  {inProgressTasks.map((task) => (
                    <TaskCard
                      key={task.id}
                      task={task}
                      isCreator={isCreator}
                      onStatusChange={(status) => handleUpdateTask(task.id, { status })}
                      onEdit={() => handleOpenTaskDetail(task.id)}
                      onDelete={() => handleDeleteTask(task.id)}
                      onAddDeliverable={!isCreator ? () => { setActiveTab("deliverables"); setDeliverablePrefill(task.id); } : undefined}
                      onDragStart={() => setDragTaskId(task.id)}
                      onDragEnd={() => { setDragTaskId(null); setDragOverCol(null); }}
                    />
                  ))}
                  {inProgressTasks.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-8">No tasks in progress</p>
                  )}
                </div>
              </div>

              {/* Completed Column */}
              <div className="space-y-3">
                <div className="flex items-center gap-2 pb-2 border-b">
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                  <h3 className="font-semibold">Completed</h3>
                  <span className="text-xs text-muted-foreground">({completedTasks.length})</span>
                </div>
                <div
                  className={cn(
                    "space-y-3 min-h-[80px] rounded-lg p-1 transition-colors",
                    dragOverCol === "completed" && dragTaskId && "bg-green-50 ring-2 ring-green-300 ring-dashed"
                  )}
                  onDragOver={(e) => { e.preventDefault(); setDragOverCol("completed"); }}
                  onDragLeave={() => setDragOverCol(null)}
                  onDrop={(e) => handleDrop(e, "completed")}
                >
                  {completedTasks.map((task) => (
                    <TaskCard
                      key={task.id}
                      task={task}
                      isCreator={isCreator}
                      onStatusChange={(status) => handleUpdateTask(task.id, { status })}
                      onEdit={() => handleOpenTaskDetail(task.id)}
                      onDelete={() => handleDeleteTask(task.id)}
                      onAddDeliverable={!isCreator ? () => { setActiveTab("deliverables"); setDeliverablePrefill(task.id); } : undefined}
                      onDragStart={() => setDragTaskId(task.id)}
                      onDragEnd={() => { setDragTaskId(null); setDragOverCol(null); }}
                    />
                  ))}
                  {completedTasks.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-8">No completed tasks</p>
                  )}
                </div>
              </div>

          </div>
        )}

          </TabsContent>

          <TabsContent value="deliverables" className="mt-6">
            <DeliverablesPanel
              projectId={id}
              openUploadForTask={deliverablePrefill}
              onUploadOpened={() => setDeliverablePrefill(undefined)}
              openUploadSignal={uploadAttachmentSignal}
              hideMobileUploadButton
              hideStats
            />
          </TabsContent>
        </Tabs>

        {/* Client Invites Section UNFINISHED BUSINESS HERE, WOULD BE REVISED LATER */} 
        {/* {id && isCreator && (
          <div className="mt-8 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold">Client Invites</h2>
              <span className="text-sm text-muted-foreground">Manage invitations</span>
            </div>
            <ClientInvitesTable projectId={id} refreshTrigger={refreshInvitesTrigger} />
          </div>
        )} */}

        {/* Client chat modal — opened from the header button */}
        {id && user?.role !== 'talent' && project?.has_clients && (
          <ClientChatModal
            projectId={id}
            open={isClientChatOpen}
            onClose={() => setIsClientChatOpen(false)}
          />
        )}

        {/* ClientInviteModal */}
        {id && project && (
          <ClientInviteModal
            projectId={id}
            projectName={project.name}
            isOpen={isInviteModalOpen}
            onClose={() => setIsInviteModalOpen(false)}
            onSuccess={() => { setRefreshInvitesTrigger(prev => prev + 1); fetchProjectTasks(id); }}
          />
        )}

        {/* Task Detail Modal */}
        <TaskDetailModal
          taskId={selectedTaskId}
          open={isTaskDetailOpen}
          onOpenChange={(open) => {
            setIsTaskDetailOpen(open);
            if (!open) setSelectedTaskId(null);
          }}
          onTaskUpdated={handleTaskDetailUpdated}
          onTaskDeleted={() => { setIsTaskDetailOpen(false); setSelectedTaskId(null); loadTasks(); }}
          availableAssignees={availableAssignees}
          currentUserId={user?.id ?? ""}
          isCreator={isCreator}
        />

        {/* First task celebration */}
        <CelebrationModal
          open={showTaskCelebration}
          onClose={() => setShowTaskCelebration(false)}
          emoji="✅"
          title="First task is rolling!"
          description="You're tracking work like a pro! Assign this task to a team member to get things moving, or create more tasks to build out the project."
          cta={{ label: "Go to My Team", href: "/team" }}
          secondaryLabel="I'll keep building"
        />

        <CelebrationModal
          open={showProjectDoneCelebration}
          onClose={() => setShowProjectDoneCelebration(false)}
          emoji="🎊"
          title="First project wrapped!"
          description="You just concluded your first project on Onswift, your team has been celebrated too. That's the full journey, start to finish. Onwards!"
          secondaryLabel="Amazing"
        />

        <CelebrationModal
          open={showTalentProjectDone}
          onClose={() => setShowTalentProjectDone(false)}
          emoji="🎊"
          title="Project complete. Great work!"
          description="A project you contributed to has been wrapped up. Your work helped get it across the line. Congratulations!"
          secondaryLabel="Thank you"
        />
      </div>
    </MainLayout>
  );
}

interface TaskCardProps {
  task: Task;
  isCreator: boolean;
  onStatusChange: (status: "planning" | "in-progress" | "completed") => void;
  onEdit: () => void;
  onDelete: () => void;
  onAddDeliverable?: () => void;
  onDragStart: () => void;
  onDragEnd: () => void;
}

const STATUS_COLORS: Record<string, string> = {
  planning: "!bg-orange-100 border-orange-400",
  "in-progress": "!bg-yellow-100 border-yellow-400",
  completed: "!bg-green-100 border-green-400",
};

const STATUSES: Array<"planning" | "in-progress" | "completed"> = ["planning", "in-progress", "completed"];
const SWIPE_THRESHOLD = 50;

function TaskCard({ task, isCreator, onStatusChange, onEdit, onDelete, onAddDeliverable, onDragStart, onDragEnd }: TaskCardProps) {
  const touchStartX = useRef(0);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    const delta = e.changedTouches[0].clientX - touchStartX.current;
    const idx = STATUSES.indexOf(task.status);
    if (delta < -SWIPE_THRESHOLD && idx < STATUSES.length - 1) onStatusChange(STATUSES[idx + 1]);
    if (delta > SWIPE_THRESHOLD && idx > 0) onStatusChange(STATUSES[idx - 1]);
  };

  return (
    <div
      className={`glass-card p-4 rounded-lg border space-y-3 cursor-pointer select-none ${STATUS_COLORS[task.status] || "border-border/50"}`}
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onClick={(e) => {
        // Don't open modal when clicking the dropdown menu
        if ((e.target as HTMLElement).closest("[data-radix-popper-content-wrapper]")) return;
        onEdit();
      }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-1.5 flex-1 min-w-0">
          <h4 className="font-medium text-sm truncate">{task.name}</h4>
          {task.recurrence_type && (
            <span title={`Repeats ${task.recurrence_type}`} className="shrink-0">
              <Repeat className="h-3 w-3 text-purple-500" />
            </span>
          )}
        </div>

        {/* Creator menu: Edit + Delete */}
        {isCreator && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0">
                <MoreVertical className="h-3 w-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={onEdit}>
                <Edit className="mr-2 h-3 w-3" />
                Edit
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={onDelete}
                className="text-destructive focus:text-destructive"
              >
                <Trash2 className="mr-2 h-3 w-3" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        {/* Talent menu: Add Deliverable */}
        {!isCreator && onAddDeliverable && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0">
                <MoreVertical className="h-3 w-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={onAddDeliverable}>
                <Upload className="mr-2 h-3 w-3" />
                Add Deliverable
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      {task.description && (
        <p className="text-xs text-muted-foreground">{task.description}</p>
      )}

      <div className="flex items-center justify-between text-xs">
        <span className={task.assignee_names?.length ? "text-muted-foreground" : "text-muted-foreground/50"}>
          {task.assignee_names?.length ? `Assigned to ${task.assignee_names.join(", ")}` : "Unassigned"}
        </span>
        {task.deadline && <span className="text-muted-foreground">{task.deadline}</span>}
      </div>
    </div>
  );
}
