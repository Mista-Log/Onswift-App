import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/dashboard/StatusBadge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  ArrowLeft,
  Calendar as CalendarIcon,
  Users,
  Plus,
  MoreVertical,
  CheckCircle2,
  Circle,
  Clock,
  Trash2,
  Edit,
  Loader2,
  ArrowUpDown,
  MessageCircle,
  Send,
  Paperclip,
  X,
  File as FileIcon,
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { secureFetch } from "@/api/apiClient";
import { ClientInviteModal } from "@/components/project/ClientInviteModal";
import { ClientInvitesTable } from "@/components/project/ClientInvitesTable";
import { useProjects, type Task } from "@/contexts/ProjectContext";
import { useTeam } from "@/contexts/TeamContext";
import { cn } from "@/lib/utils";
import { formatDistanceToNow, format } from "date-fns";

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
  
  // Messages state
  const [messages, setMessages] = useState<any[]>([]);
  const [messageContent, setMessageContent] = useState("");
  const [messageFile, setMessageFile] = useState<File | null>(null);
  const [isSendingMessage, setIsSendingMessage] = useState(false);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [showMessages, setShowMessages] = useState(false);

  const project = projects.find((p) => p.id === id);
  const isCreator = user?.role === "creator";

  useEffect(() => {
    loadTasks();
    loadMessages();
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

        {/* Project Info */}
        <div className="glass-card p-6 rounded-lg border border-border/50">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div>
              <p className="text-sm text-muted-foreground mb-1">Status</p>
              <StatusBadge status={project.status} />
            </div>
            <div>
              <p className="text-sm text-muted-foreground mb-1">Due Date</p>
              <div className="flex items-center gap-2 text-sm">
                
                {project.due_date}
              </div>
            </div>
            <div>
              <p className="text-sm text-muted-foreground mb-1">Progress</p>
              <div className="space-y-1">
                <div className="flex justify-between text-sm">
                  <span>{Math.round(progress)}%</span>
                  <span>
                    {project.completed_tasks}/{project.task_count} tasks
                  </span>
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
                    <AvatarFallback>{member.name[0]}</AvatarFallback>
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
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <h2 className="text-2xl font-bold">Tasks</h2>
            <Select value={sortMethod} onValueChange={(value: any) => setSortMethod(value)}>
              <SelectTrigger className="w-48">
                <div className="flex items-center gap-2">
                  <ArrowUpDown className="h-4 w-4" />
                  <SelectValue />
                </div>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="deadline-asc">Filter (Soonest)</SelectItem>
                <SelectItem value="deadline-desc">Due Date (Latest)</SelectItem>
                <SelectItem value="alphabetical-asc">Name (A-Z)</SelectItem>
                <SelectItem value="alphabetical-desc">Name (Z-A)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {isCreator && (
            <div className="flex gap-2">
              <Button 
                variant="outline"
                className="gap-2"
                onClick={() => setIsInviteModalOpen(true)}
              >
                <Plus className="h-4 w-4" />
                New Client
              </Button>
              <Dialog open={isTaskDialogOpen} onOpenChange={setIsTaskDialogOpen}>
                <DialogTrigger asChild>
                  <Button className="gap-2">
                    <Plus className="h-4 w-4" />
                    New Task
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
                <span className="text-xs text-muted-foreground">
                  ({planningTasks.length})
                </span>
              </div>
              <div className="space-y-3">
                {planningTasks.map((task) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    isCreator={isCreator}
                                        onStatusChange={(status) =>
                      handleUpdateTask(task.id, { status })
                    }
                    onDelete={() => handleDeleteTask(task.id)}
                  />
                ))}
                {planningTasks.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    No tasks in planning
                  </p>
                )}
              </div>
            </div>

            {/* In Progress Column */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 pb-2 border-b">
                <Clock className="h-4 w-4 text-primary" />
                <h3 className="font-semibold">In Progress</h3>
                <span className="text-xs text-muted-foreground">
                  ({inProgressTasks.length})
                </span>
              </div>
              <div className="space-y-3">
                {inProgressTasks.map((task) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    isCreator={isCreator}
                                        onStatusChange={(status) =>
                      handleUpdateTask(task.id, { status })
                    }
                    onDelete={() => handleDeleteTask(task.id)}
                  />
                ))}
                {inProgressTasks.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    No tasks in progress
                  </p>
                )}
              </div>
            </div>

            {/* Completed Column */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 pb-2 border-b">
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                <h3 className="font-semibold">Completed</h3>
                <span className="text-xs text-muted-foreground">
                  ({completedTasks.length})
                </span>
              </div>
              <div className="space-y-3">
                {completedTasks.map((task) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    isCreator={isCreator}
                                        onStatusChange={(status) =>
                      handleUpdateTask(task.id, { status })
                    }
                    onDelete={() => handleDeleteTask(task.id)}
                  />
                ))}
                {completedTasks.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    No completed tasks
                  </p>
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

        {/* Messages Section */}
        {id && (
          <div className="mt-8 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold flex items-center gap-2">
                <MessageCircle className="h-5 w-5" />
                Project Messages
              </h2>
              <Button 
                variant="outline"
                size="sm"
                onClick={loadMessages}
                disabled={isLoadingMessages}
              >
                {isLoadingMessages ? "Loading..." : "Refresh"}
              </Button>
            </div>
            
            <Card className="glass-card border-border/50">
              <CardContent className="pt-6">
                {isLoadingMessages ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="h-5 w-5 animate-spin" />
                  </div>
                ) : messages.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">
                    No messages yet. Start a conversation with your clients!
                  </p>
                ) : (
                  <div className="space-y-4 max-h-96 overflow-y-auto">
                    {messages.map((msg: any) => (
                      <div key={msg.id} className="p-3 bg-secondary/30 rounded-lg">
                        <div className="flex items-start justify-between mb-1">
                          <span className="font-medium text-sm">{msg.sender_name}</span>
                          <span className="text-xs text-muted-foreground">
                            {msg.created_at && format(new Date(msg.created_at), "MMM d, HH:mm")}
                          </span>
                        </div>
                        <p className="text-sm text-foreground/90">{msg.content}</p>
                        {msg.file_name && (
                          <a
                            href={msg.file}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-xs text-blue-500 hover:text-blue-600 mt-2"
                          >
                            <FileIcon className="h-3 w-3" />
                            {msg.file_name}
                          </a>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* Message Input */}
                <div className="mt-4 pt-4 border-t border-border/50 space-y-2">
                  <div className="flex gap-2">
                    <Textarea
                      placeholder="Type your message..."
                      value={messageContent}
                      onChange={(e) => setMessageContent(e.target.value)}
                      className="resize-none"
                      rows={2}
                    />
                    <div className="flex flex-col gap-2">
                      <Button
                        size="icon"
                        variant="outline"
                        disabled={isSendingMessage}
                      >
                        <label className="cursor-pointer">
                          <input
                            ref={
                              (input) => {
                                if (input) {
                                  const fileInput = input as HTMLInputElement;
                                  fileInput.onchange = (e) => {
                                    const file = (e.target as HTMLInputElement).files?.[0];
                                    if (file) setMessageFile(file);
                                  };
                                }
                              }
                            }
                            type="file"
                            className="hidden"
                          />
                          <Paperclip className="h-4 w-4" />
                        </label>
                      </Button>
                      <Button
                        onClick={sendMessage}
                        disabled={(!messageContent.trim() && !messageFile) || isSendingMessage}
                      >
                        {isSendingMessage ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Send className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </div>
                  {messageFile && (
                    <div className="flex items-center gap-2 text-xs bg-secondary/30 p-2 rounded">
                      <FileIcon className="h-3 w-3" />
                      <span>{messageFile.name}</span>
                      <button
                        onClick={() => setMessageFile(null)}
                        className="ml-auto"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
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
      </div>
    </MainLayout>
  );
}

interface TaskCardProps {
  task: Task;
  isCreator: boolean;
  onStatusChange: (status: "planning" | "in-progress" | "completed") => void;
  onDelete: () => void;
}

const STATUS_COLORS: Record<string, string> = {
  planning: "!bg-orange-100 border-orange-400",
  "in-progress": "!bg-yellow-100 border-yellow-400",
  completed: "!bg-green-100 border-green-400",
};

function TaskCard({ task, isCreator, onStatusChange, onDelete }: TaskCardProps) {
  return (
    <div className={`glass-card p-4 rounded-lg border space-y-3 ${STATUS_COLORS[task.status] || "border-border/50"}`}>
      <div className="flex items-start justify-between gap-2">
        <h4 className="font-medium text-sm flex-1">{task.name}</h4>
        {isCreator && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-6 w-6">
                <MoreVertical className="h-3 w-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onStatusChange("planning")}>
                Move to Planning
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onStatusChange("in-progress")}>
                Move to In Progress
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onStatusChange("completed")}>
                Move to Completed
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
