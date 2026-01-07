import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/dashboard/StatusBadge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  ArrowLeft,
  Calendar,
  Users,
  Plus,
  MoreVertical,
  CheckCircle2,
  Circle,
  Clock,
  Trash2,
  Edit,
  Loader2,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { useProjects, type Task } from "@/contexts/ProjectContext";
import { useTeam } from "@/contexts/TeamContext";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";

export default function ProjectDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { projects, fetchProjectTasks, addTask, updateTask, deleteTask, deleteProject, updateProject } = useProjects();
  const { teamMembers } = useTeam();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isTaskDialogOpen, setIsTaskDialogOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [taskFormData, setTaskFormData] = useState({
    name: "",
    description: "",
    assignee: "unassigned",
    status: "planning" as "planning" | "in-progress" | "completed",
    deadline: "",
  });

  const project = projects.find((p) => p.id === id);
  const isCreator = user?.role === "creator";

  useEffect(() => {
    loadTasks();
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
  const planningTasks = tasks.filter((t) => t.status === "planning");
  const inProgressTasks = tasks.filter((t) => t.status === "in-progress");
  const completedTasks = tasks.filter((t) => t.status === "completed");

  // Available team members for assignment (if creator)
  const availableAssignees = isCreator ? [
    { id: user.id, name: user.full_name },
    ...teamMembers.map((m) => ({ id: m.id, name: m.name }))
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
                <Calendar className="h-4 w-4" />
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
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold">Tasks</h2>
          {isCreator && (
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
                            {member.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="task-deadline">Deadline</Label>
                    <Input
                      id="task-deadline"
                      type="date"
                      value={taskFormData.deadline}
                      onChange={(e) =>
                        setTaskFormData((prev) => ({
                          ...prev,
                          deadline: e.target.value,
                        }))
                      }
                    />
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

function TaskCard({ task, isCreator, onStatusChange, onDelete }: TaskCardProps) {
  return (
    <div className="glass-card p-4 rounded-lg border border-border/50 space-y-3">
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
        {task.assignee_name ? (
          <span className="text-muted-foreground">
            Assigned to {task.assignee_name}
          </span>
        ) : (
          <span className="text-muted-foreground/50">Unassigned</span>
        )}

        {task.deadline && (
          <div className="flex items-center gap-1 text-muted-foreground">
            <Calendar className="h-3 w-3" />
            {task.deadline}
          </div>
        )}
      </div>
    </div>
  );
}
