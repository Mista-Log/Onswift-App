import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { CelebrationModal } from "@/components/CelebrationModal";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/dashboard/StatusBadge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
import { secureFetch } from "@/api/apiClient";
import { ClientInviteModal } from "@/components/project/ClientInviteModal";
import { ClientInvitesTable } from "@/components/project/ClientInvitesTable";
import { useProjects, type Task } from "@/contexts/ProjectContext";
import { useTeam } from "@/contexts/TeamContext";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

export default function ProjectDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
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
    assignee: "unassigned",
    status: "planning" as "planning" | "in-progress" | "completed",
    deadline: "",
  });
  const [taskFormData, setTaskFormData] = useState({
    name: "",
    description: "",
    assignee: "unassigned",
    status: "planning" as "planning" | "in-progress" | "completed",
    deadline: "",
  });
  const [sortMethod, setSortMethod] = useState<"deadline-asc" | "deadline-desc" | "alphabetical-asc" | "alphabetical-desc">("deadline-asc");
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [refreshInvitesTrigger, setRefreshInvitesTrigger] = useState(0);
  const [showTaskCelebration, setShowTaskCelebration] = useState(false);
  const [dragTaskId, setDragTaskId] = useState<string | null>(null);
  const [dragOverCol, setDragOverCol] = useState<"planning" | "in-progress" | "completed" | null>(null);
  
  // Messages state
  const [messages, setMessages] = useState<any[]>([]);
  const [messageContent, setMessageContent] = useState("");
  const [messageFile, setMessageFile] = useState<File | null>(null);
  const [isSendingMessage, setIsSendingMessage] = useState(false);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [isMessagesCollapsed, setIsMessagesCollapsed] = useState(false);

  useEffect(() => {
    if (!id) return;
    try {
      const stored = localStorage.getItem(`onswift_project_${id}_messages_collapsed`);
      setIsMessagesCollapsed(stored === "1");
    } catch (e) {
      // ignore
    }
  }, [id]);

  const project = projects.find((p) => p.id === id);
  const isCreator = user?.role === "creator";

  useEffect(() => {
    loadTasks();
    if (user?.role !== 'talent') loadMessages();
  }, [id]);

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
        assignee: taskFormData.assignee && taskFormData.assignee !== "unassigned" ? taskFormData.assignee : null,
        status: taskFormData.status,
        deadline: taskFormData.deadline || null,
      });

      toast.success("Task created successfully!");
      setTaskFormData({
        name: "",
        description: "",
        assignee: "unassigned",
        status: "planning",
        deadline: "",
      });
      setIsTaskDialogOpen(false);
      await loadTasks();

      if (isFirstTask && !localStorage.getItem("onswift_celebrated_first_task")) {
        localStorage.setItem("onswift_celebrated_first_task", "1");
        setShowTaskCelebration(true);
      }
    } catch (error) {
      toast.error("Failed to create task");
    }
  };

  const handleUpdateTask = async (taskId: string, updates: Partial<Task>) => {
    try {
      await updateTask(taskId, updates);
      toast.success("Task updated successfully!");
      await loadTasks();
    } catch (error) {
      toast.error("Failed to update task");
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    try {
      await deleteTask(taskId);
      toast.success("Task deleted successfully!");
      await loadTasks();
    } catch (error) {
      toast.error("Failed to delete task");
    }
  };

  const handleOpenEditTask = (task: Task) => {
    setEditingTask(task);
    setEditFormData({
      name: task.name,
      description: task.description || "",
      assignee: task.assignee || "unassigned",
      status: task.status,
      deadline: task.deadline || "",
    });
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
        assignee: editFormData.assignee !== "unassigned" ? editFormData.assignee : null,
        status: editFormData.status,
        deadline: editFormData.deadline || null,
      });
      toast.success("Task updated!");
      setEditingTask(null);
      await loadTasks();
    } catch (error) {
      toast.error("Failed to update task");
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

  const handleStatusChange = async (newStatus: "planning" | "in-progress" | "completed") => {
    if (!id) return;
    try {
      await updateProject(id, { status: newStatus });
      toast.success("Project status updated!");
    } catch (error) {
      toast.error("Failed to update project status");
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

  const loadMessages = async () => {
    if (!id) return;
    setIsLoadingMessages(true);
    try {
      const response = await secureFetch(`/api/v5/projects/${id}/messages/`);
      console.log("Messages response status:", response.status);
      
      if (response.ok) {
        const data = await response.json();
        console.log("Messages data:", data);
        setMessages(data.messages || []);
      } else {
        const errorText = await response.text();
        console.error("Failed to load messages:", response.status, errorText);
        toast.error(`Failed to load messages: ${response.status}`);
      }
    } catch (error) {
      console.error("Error loading messages:", error);
      toast.error("Failed to load messages");
    } finally {
      setIsLoadingMessages(false);
    }
  };

  const sendMessage = async () => {
    if (!id || (!messageContent.trim() && !messageFile)) return;

    setIsSendingMessage(true);
    try {
      const formData = new FormData();
      if (messageContent.trim()) formData.append("content", messageContent.trim());
      if (messageFile) formData.append("file", messageFile);

      const response = await secureFetch(`/api/v5/projects/${id}/messages/send/`, {
        method: "POST",
        body: formData,
        headers: {},
      });

      if (response.ok) {
        const newMessage = await response.json();
        setMessages((prev) => [...prev, newMessage]);
        setMessageContent("");
        setMessageFile(null);
        toast.success("Message sent!");
      } else {
        toast.error("Failed to send message");
      }
    } catch {
      toast.error("Something went wrong");
    } finally {
      setIsSendingMessage(false);
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

          {isCreator && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon">
                  <MoreVertical className="h-5 w-5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => handleStatusChange("planning")}>
                  Set to Planning
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleStatusChange("in-progress")}>
                  Set to In Progress
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleStatusChange("completed")}>
                  Set to Completed
                </DropdownMenuItem>
                <DropdownMenuSeparator />
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
                <Select
                  value={editFormData.assignee}
                  onValueChange={(value) => setEditFormData((prev) => ({ ...prev, assignee: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select team member" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unassigned">Unassigned</SelectItem>
                    {availableAssignees.map((member) => (
                      <SelectItem key={member.id} value={member.id}>
                        {member.id === user?.id ? "Self" : member.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
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
            <div>
              <p className="text-sm text-muted-foreground mb-1">Team</p>
              <div className="flex -space-x-2">
                {project.teamMembers?.slice(0, 5).map((member) => (
                  <Avatar key={member.id} className="h-8 w-8 border-2 border-background">
                    <AvatarImage src={member.avatar} />
                    <AvatarFallback className="text-xs">{member.name[0]}</AvatarFallback>
                  </Avatar>
                ))}
                {project.teamMembers && project.teamMembers.length > 5 && (
                  <div className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-background bg-secondary text-xs">
                    +{project.teamMembers.length - 5}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

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
          {isCreator && (
            <div className="flex gap-3">
              <Button
                variant="outline"
                className="gap-2 px-2 sm:px-4"
                onClick={() => setIsInviteModalOpen(true)}
              >
                <UserPlus className="h-4 w-4 shrink-0" />
                <span className="hidden sm:inline">New Client</span>
              </Button>
              <Dialog open={isTaskDialogOpen} onOpenChange={setIsTaskDialogOpen}>
                <DialogTrigger asChild>
                  <Button className="gap-2 px-2 sm:px-4">
                    <ListPlus className="h-4 w-4 shrink-0" />
                    <span className="hidden sm:inline">New Task</span>
                  </Button>
                </DialogTrigger>
              <DialogContent className="glass-card border-border/50 sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>Create New Task</DialogTitle>
                  <DialogDescription>
                    Add a new task to this project
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="task-name">Task Name</Label>
                    <Input
                      id="task-name"
                      placeholder="Enter task name"
                      value={taskFormData.name}
                      onChange={(e) =>
                        setTaskFormData((prev) => ({
                          ...prev,
                          name: e.target.value,
                        }))
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="task-description">Description</Label>
                    <Textarea
                      id="task-description"
                      placeholder="Describe the task"
                      value={taskFormData.description}
                      onChange={(e) =>
                        setTaskFormData((prev) => ({
                          ...prev,
                          description: e.target.value,
                        }))
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="task-assignee">Assign To</Label>
                    <Select
                      value={taskFormData.assignee}
                      onValueChange={(value) =>
                        setTaskFormData((prev) => ({
                          ...prev,
                          assignee: value,
                        }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select team member" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="unassigned">Unassigned</SelectItem>
                        {availableAssignees.map((member) => (
                          <SelectItem key={member.id} value={member.id}>
                            {member.id === user?.id ? "Self" : member.name}
                          </SelectItem>
                        ))}
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
                            !taskFormData.deadline && "text-muted-foreground"
                          )}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {taskFormData.deadline ? format(new Date(taskFormData.deadline), "PPP") : "Pick a deadline"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={taskFormData.deadline ? new Date(taskFormData.deadline) : undefined}
                          onSelect={(date) =>
                            setTaskFormData((prev) => ({
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
                  <Button
                    variant="outline"
                    onClick={() => setIsTaskDialogOpen(false)}
                  >
                    Cancel
                  </Button>
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
                  <Circle className="h-4 w-4 text-muted-foreground" />
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
                      onEdit={() => handleOpenEditTask(task)}
                      onDelete={() => handleDeleteTask(task.id)}
                      onAddDeliverable={!isCreator ? () => navigate("/deliverables", { state: { prefillTaskId: task.id } }) : undefined}
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
                      onEdit={() => handleOpenEditTask(task)}
                      onDelete={() => handleDeleteTask(task.id)}
                      onAddDeliverable={!isCreator ? () => navigate("/deliverables", { state: { prefillTaskId: task.id } }) : undefined}
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
                      onEdit={() => handleOpenEditTask(task)}
                      onDelete={() => handleDeleteTask(task.id)}
                      onAddDeliverable={!isCreator ? () => navigate("/deliverables", { state: { prefillTaskId: task.id } }) : undefined}
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

        {/* Messages Section — hidden from talent; these are creator↔client conversations */}
        {id && user?.role !== 'talent' && (
          <div className="mt-8 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold flex items-center gap-2">
                <MessageCircle className="h-5 w-5" />
                Project Messages
              </h2>
              <div className="flex items-center gap-2">
                <Button 
                  variant="outline"
                  size="sm"
                  onClick={loadMessages}
                  disabled={isLoadingMessages}
                >
                  {isLoadingMessages ? "Loading..." : "Refresh"}
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => {
                    const next = !isMessagesCollapsed;
                    setIsMessagesCollapsed(next);
                    try { localStorage.setItem(`onswift_project_${id}_messages_collapsed`, next ? "1" : "0"); } catch (e) {}
                  }}
                  aria-label={isMessagesCollapsed ? "Expand messages" : "Collapse messages"}
                >
                  {isMessagesCollapsed ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </Button>
              </div>
            </div>

            {!isMessagesCollapsed && (
              <Card className="overflow-hidden border-border/50 bg-white shadow-sm">
                <CardContent className="p-0">
                  {/* Thread header */}
                  <div className="border-b border-border/50 px-3 py-3 sm:px-5 sm:py-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium text-foreground">Project Thread</p>
                        <p className="text-xs text-muted-foreground">Messages from your client and your replies</p>
                      </div>
                      <div className="rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                        {messages.length} messages
                      </div>
                    </div>
                  </div>

                  {/* Message list */}
                  <div className="max-h-[16rem] sm:max-h-[28rem] space-y-4 overflow-y-auto px-3 py-3 sm:px-5 sm:py-5 bg-[#f8f6ff]">
                    {isLoadingMessages ? (
                      <div className="flex justify-center py-10">
                        <Loader2 className="h-5 w-5 animate-spin text-primary" />
                      </div>
                    ) : messages.length === 0 ? (
                      <div className="rounded-2xl border border-dashed border-border/70 bg-white px-4 py-6 text-center text-sm text-muted-foreground">
                        No messages yet. Start a conversation with your clients!
                      </div>
                    ) : (
                      messages.map((msg: any) => {
                        const isMine = msg.sender === user?.id;

                        return (
                          <div
                            key={msg.id}
                            className={cn(
                              "flex items-end gap-2",
                              isMine ? "justify-end" : "justify-start"
                            )}
                          >
                            {!isMine && (
                              <Avatar className="h-8 w-8 shrink-0 self-end">
                                <AvatarFallback className="bg-primary/10 text-primary text-xs">
                                  {(msg.sender_name || "?").charAt(0)}
                                </AvatarFallback>
                              </Avatar>
                            )}

                            <div className={cn("max-w-[75%]", isMine && "text-right")}>
                              {!isMine && (
                                <p className="mb-1 text-xs font-medium text-muted-foreground">{msg.sender_name}</p>
                              )}
                              <div
                                className={cn(
                                  "rounded-2xl px-4 py-3 shadow-sm",
                                  isMine
                                    ? "bg-primary text-primary-foreground"
                                    : "bg-white text-foreground border border-border/40"
                                )}
                              >
                                <p className="text-sm leading-relaxed">{msg.content}</p>
                                {msg.file_name && (
                                  <a
                                    href={msg.file}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className={cn(
                                      "mt-3 inline-flex items-center gap-1 text-xs font-medium underline-offset-4 hover:underline",
                                      isMine ? "text-primary-foreground/90" : "text-primary"
                                    )}
                                  >
                                    <FileIcon className="h-3 w-3" />
                                    {msg.file_name}
                                  </a>
                                )}
                              </div>
                              <p className={cn("mt-1 text-[10px] text-muted-foreground", isMine && "text-right")}>
                                {msg.created_at && format(new Date(msg.created_at), "hh:mm a")}
                              </p>
                            </div>

                            {isMine && (
                              <Avatar className="h-8 w-8 shrink-0 self-end">
                                <AvatarFallback className="bg-primary text-primary-foreground text-xs">
                                  {user?.full_name?.charAt(0) || "Y"}
                                </AvatarFallback>
                              </Avatar>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>

                  {/* Composer */}
                  <div className="border-t border-border/50 space-y-3 p-3 sm:p-5">
                    <div className="flex items-end gap-2">
                      <Button
                        size="icon"
                        variant="outline"
                        disabled={isSendingMessage}
                        className="shrink-0"
                      >
                        <label className="cursor-pointer">
                          <input
                            ref={(input) => {
                              if (input) {
                                const fileInput = input as HTMLInputElement;
                                fileInput.onchange = (e) => {
                                  const file = (e.target as HTMLInputElement).files?.[0];
                                  if (file) setMessageFile(file);
                                };
                              }
                            }}
                            type="file"
                            className="hidden"
                          />
                          <Paperclip className="h-4 w-4" />
                        </label>
                      </Button>

                      <Textarea
                        placeholder="Type your message..."
                        value={messageContent}
                        onChange={(e) => setMessageContent(e.target.value)}
                        className="min-h-[52px] flex-1 resize-none rounded-2xl"
                      />

                      <Button
                        onClick={sendMessage}
                        className="shrink-0 rounded-full px-4"
                        disabled={(!messageContent.trim() && !messageFile) || isSendingMessage}
                      >
                        {isSendingMessage ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Send className="h-4 w-4" />
                        )}
                      </Button>
                    </div>

                    {messageFile && (
                      <div className="flex items-center gap-2 rounded-lg border border-border/60 bg-secondary/40 p-3 text-xs text-muted-foreground">
                        <FileIcon className="h-3 w-3" />
                        <span className="truncate">{messageFile.name}</span>
                        <button
                          onClick={() => setMessageFile(null)}
                          className="ml-auto rounded-full p-1 hover:bg-secondary"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* ClientInviteModal */}
        {id && project && (
          <ClientInviteModal
            projectId={id}
            projectName={project.name}
            isOpen={isInviteModalOpen}
            onClose={() => setIsInviteModalOpen(false)}
            onSuccess={() => setRefreshInvitesTrigger(prev => prev + 1)}
          />
        )}

        {/* First task celebration */}
        <CelebrationModal
          open={showTaskCelebration}
          onClose={() => setShowTaskCelebration(false)}
          emoji="✅"
          title="First task is rolling!"
          description="You're tracking work like a pro! Assign this task to a team member to get things moving — or create more tasks to build out the project."
          cta={{ label: "Go to My Team", href: "/team" }}
          secondaryLabel="I'll keep building"
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
      className={`glass-card p-4 rounded-lg border space-y-3 cursor-grab active:cursor-grabbing select-none ${STATUS_COLORS[task.status] || "border-border/50"}`}
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      <div className="flex items-start justify-between gap-2">
        <h4 className="font-medium text-sm flex-1">{task.name}</h4>

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
        <span className={task.assignee_name ? "text-muted-foreground" : "text-muted-foreground/50"}>
          {task.assignee_name ? `Assigned to ${task.assignee_name}` : "Unassigned"}
        </span>
        {task.deadline && <span className="text-muted-foreground">{task.deadline}</span>}
      </div>
    </div>
  );
}
