import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, CheckSquare } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { TaskCard } from "@/components/talent/TaskCard";
import { useAuth } from "@/contexts/AuthContext";
import { useProjects, type Task } from "@/contexts/ProjectContext";
import { secureFetch } from "@/api/apiClient";
import { toast } from "sonner";

interface MyTask extends Task {
  project_name?: string;
  awaiting_approval?: boolean;
}

interface MyTasksPanelProps {
  /** Defaults to the current user's role. Creators can complete their own tasks directly. */
  variant?: "talent" | "creator";
}

/**
 * Shared "My Tasks" panel used by both the Talent and Creator dashboards. Lists the
 * signed-in user's assigned tasks (`/api/v2/my-tasks/`) and gates completion behind a
 * "do you have a deliverable?" prompt — since Onswift is deliverable-based.
 */
export function MyTasksPanel({ variant }: MyTasksPanelProps) {
  const { user } = useAuth();
  const { projects, updateTask } = useProjects();
  const navigate = useNavigate();
  const isCreator = (variant ?? user?.role) === "creator";

  const [tasks, setTasks] = useState<MyTask[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("todo");
  const [gateTaskId, setGateTaskId] = useState<string | null>(null);

  useEffect(() => {
    fetchTasks();
  }, []);

  const fetchTasks = async () => {
    try {
      setIsLoading(true);
      const res = await secureFetch("/api/v2/my-tasks/");
      if (res.ok) setTasks(await res.json());
    } catch (error) {
      console.error("Error fetching tasks:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const getProjectName = (task: MyTask) =>
    task.project_name || projects.find((p) => p.id === task.project)?.name || "Project";

  // "completed" opens the deliverable gate; other transitions pass straight through.
  const handleStatusChange = async (
    taskId: string,
    newStatus: "planning" | "in-progress" | "completed",
  ) => {
    if (newStatus === "completed") {
      setGateTaskId(taskId);
      return;
    }
    try {
      await updateTask(taskId, { status: newStatus });
      setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, status: newStatus } : t)));
      toast.success("Task status updated!");
    } catch {
      toast.info(
        "Task stages are controlled by your project creator. Submit a deliverable to show your progress on this task.",
        { duration: 4000 },
      );
    }
  };

  // "Yes, I have a deliverable" → go add it (creator approval will complete the task).
  const handleHasDeliverable = () => {
    if (!gateTaskId) return;
    const id = gateTaskId;
    setGateTaskId(null);
    navigate("/deliverables", { state: { prefillTaskId: id } });
  };

  // "No deliverable": creators complete directly; talent requests creator approval.
  const handleNoDeliverable = async () => {
    if (!gateTaskId) return;
    const id = gateTaskId;
    setGateTaskId(null);

    if (isCreator) {
      try {
        await updateTask(id, { status: "completed" });
        setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, status: "completed" } : t)));
        toast.success("Task completed");
      } catch {
        toast.error("Failed to complete task");
      }
      return;
    }

    try {
      const res = await secureFetch(`/api/v2/tasks/${id}/request-completion/`, { method: "POST" });
      if (!res.ok) throw new Error("request failed");
      setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, awaiting_approval: true } : t)));
      toast.success("Sent. Awaiting your creator's approval");
    } catch { 
      toast.error("Couldn't send for approval. Please try again.");
    }
  };

  const pendingCount = tasks.filter((t) => t.status !== "completed").length;
  const completedCount = tasks.filter((t) => t.status === "completed").length;
  const filteredTasks = tasks.filter((t) =>
    activeTab === "todo" ? t.status !== "completed" : t.status === "completed",
  );

  return (
    <section className="glass-card p-5 sm:p-6 md:p-7">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-foreground">My Tasks</h2>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-4">
          <TabsTrigger value="todo">
            To Do <span className="ml-1 text-xs">({pendingCount})</span>
          </TabsTrigger>
          <TabsTrigger value="completed">
            Completed <span className="ml-1 text-xs">({completedCount})</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="space-y-2">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : filteredTasks.length > 0 ? (
            filteredTasks.map((task) => (
              <TaskCard
                key={task.id}
                id={task.id}
                name={task.name}
                description={task.description}
                deadline={task.deadline}
                projectName={getProjectName(task)}
                status={task.status}
                awaitingApproval={task.awaiting_approval}
                assignedToMe={isCreator}
                onStatusChange={handleStatusChange}
              />
            ))
          ) : (
            <div className="text-center py-8">
              <CheckSquare className="h-12 w-12 text-primary mx-auto mb-2" />
              <p className="text-foreground font-medium">
                {activeTab === "todo" ? "You're all caught up!" : "No completed tasks yet"}
              </p>
              <p className="text-sm text-muted-foreground">
                {activeTab === "todo" ? "No pending tasks at the moment" : "Complete some tasks to see them here"}
              </p>
            </div>
          )}
        </TabsContent>
      </Tabs>

      <AlertDialog open={!!gateTaskId} onOpenChange={(o) => { if (!o) setGateTaskId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Do you have a deliverable for this task?</AlertDialogTitle>
            <AlertDialogDescription>
              Onswift is deliverable-based. If you have work to submit, add it now.
              {isCreator
                ? " Otherwise you can mark the task complete directly."
                : " Otherwise we'll let your creator know it's ready for their approval."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleNoDeliverable}>
              {isCreator ? "No, complete it" : "No, request approval"}
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleHasDeliverable}>Yes, add deliverable</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
