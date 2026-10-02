import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, CheckSquare, Plus, Hourglass } from "lucide-react";
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
import { Button } from "@/components/ui/button";
import { queueStatusChange, applyPendingStatuses, onSyncResult } from "@/lib/syncQueue";
import { success as feedbackSuccess, swipe as feedbackSwipe, error as feedbackError } from "@/lib/feedback";
import { TaskCard } from "@/components/talent/TaskCard";
import { PersonalTaskDialog, type PersonalTask } from "@/components/tasks/PersonalTaskDialog";
import { useAuth } from "@/contexts/AuthContext";
import { useProjects, type Task } from "@/contexts/ProjectContext";
import { secureFetch } from "@/api/apiClient";
import { readCache, writeCache } from "@/lib/cache";
import { stageAction } from "@/lib/taskStages";

const CACHE_TTL_MS = 30 * 60 * 1000;
const TASK_DISPLAY_LIMIT = 5;
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
  const { projects } = useProjects();
  const navigate = useNavigate();
  const isCreator = (variant ?? user?.role) === "creator";

  // Last-seen copy from this browser, so the panel is filled instantly (and offline) while the
  // server answers. Keyed by user so accounts on a shared browser never see each other's tasks.
  const cacheKey = `my-tasks:${user?.id ?? "anon"}`;
  const cached = useRef(
    readCache<{ tasks: MyTask[]; personal: PersonalTask[]; canAdd: boolean; projects: { id: string; name: string }[] }>(cacheKey)
  ).current;

  const [tasks, setTasks] = useState<MyTask[]>(() => (cached ? applyPendingStatuses("task", cached.tasks) : []));
  const [isLoading, setIsLoading] = useState(!cached);
  const [activeTab, setActiveTab] = useState("todo");
  const [gateTaskId, setGateTaskId] = useState<string | null>(null);
  const [personalTasks, setPersonalTasks] = useState<PersonalTask[]>(() =>
    cached ? applyPendingStatuses("personal", cached.personal) : []
  );
  const [canAddPersonal, setCanAddPersonal] = useState(!!cached?.canAdd);
  const [linkableProjects, setLinkableProjects] = useState<{ id: string; name: string }[]>(cached?.projects ?? []);
  const [personalDialogOpen, setPersonalDialogOpen] = useState(false);
  const [editingPersonal, setEditingPersonal] = useState<PersonalTask | null>(null);
  const [showAllTasks, setShowAllTasks] = useState(false);

  // Latest state for fetchTasks, which outlives the render it was created in.
  const tasksRef = useRef(tasks);
  const personalRef = useRef(personalTasks);
  const canAddRef = useRef(canAddPersonal);
  const projectsRef = useRef(linkableProjects);
  tasksRef.current = tasks;
  personalRef.current = personalTasks;
  canAddRef.current = canAddPersonal;
  projectsRef.current = linkableProjects;

  useEffect(() => {
    fetchTasks();
  }, []);

  // `silent` refreshes without the spinner. Status changes the server hasn't confirmed yet stay
  // visible, so a refresh can't bounce a card back.
  const fetchTasks = async (silent = false) => {
    try {
      // With a browser copy on screen there is nothing to wait for, so no spinner.
      if (silent !== true && !cached) setIsLoading(true);
      const [res, personalRes, eligibilityRes] = await Promise.all([
        secureFetch("/api/v2/my-tasks/"),
        secureFetch("/api/v2/personal-tasks/"),
        secureFetch("/api/v2/personal-tasks/eligibility/"),
      ]);
      // Anything the server didn't answer keeps the value already on screen.
      const next = {
        tasks: res.ok ? ((await res.json()) as MyTask[]) : tasksRef.current,
        personal: personalRes.ok ? ((await personalRes.json()) as PersonalTask[]) : personalRef.current,
        canAdd: canAddRef.current,
        projects: projectsRef.current,
      };
      if (eligibilityRes.ok) {
        const eligibility = await eligibilityRes.json();
        next.canAdd = !!eligibility.allowed;
        next.projects = eligibility.projects ?? [];
        setCanAddPersonal(next.canAdd);
        setLinkableProjects(next.projects);
      }
      if (res.ok) setTasks(applyPendingStatuses("task", next.tasks));
      if (personalRes.ok) setPersonalTasks(applyPendingStatuses("personal", next.personal));
      if (res.ok || personalRes.ok || eligibilityRes.ok) writeCache(cacheKey, next, CACHE_TTL_MS);
    } catch (error) {
      console.error("Error fetching tasks:", error);
    } finally {
      if (silent !== true) setIsLoading(false);
    }
  };

  // When the server answers a queued change: quietly refresh on success; on rejection say so.
  const syncRefreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    return onSyncResult((result) => {
      if (!result.ok) {
        feedbackError();
        toast.error(
          result.httpStatus === 403
            ? "You don't have permission to change that task."
            : "Couldn't save that change, so it was undone."
        );
      }
      if (syncRefreshTimer.current) clearTimeout(syncRefreshTimer.current);
      syncRefreshTimer.current = setTimeout(() => void fetchTasks(true), 400);
    });
  }, []);

  const openAddPersonal = () => {
    setEditingPersonal(null);
    setPersonalDialogOpen(true);
  };

  const openEditPersonal = (task: PersonalTask) => {
    setEditingPersonal(task);
    setPersonalDialogOpen(true);
  };

  const handlePersonalSaved = (saved: PersonalTask) =>
    setPersonalTasks((prev) =>
      prev.some((t) => t.id === saved.id)
        ? prev.map((t) => (t.id === saved.id ? saved : t))
        : [saved, ...prev],
    );

  // Personal tasks skip the deliverable gate: the owner just sets the status.
  // Instant: the card moves now, the change is stored on this device and sent in the background.
  const handlePersonalStatusChange = (
    taskId: string,
    newStatus: "planning" | "in-progress" | "completed",
  ) => {
    setPersonalTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, status: newStatus } : t)));
    (newStatus === "completed" ? feedbackSuccess : feedbackSwipe)();
    queueStatusChange("personal", taskId, newStatus);
  };

  const personalLabel = (task: PersonalTask) =>
    task.linked_projects.length === 0
      ? "Personal"
      : task.linked_projects.length === 1
      ? `Personal · ${task.linked_projects[0].name}`
      : `Personal · ${task.linked_projects.length} projects`;

  const getProjectName = (task: MyTask) =>
    task.project_name || projects.find((p) => p.id === task.project)?.name || "Project";

  // "completed" opens the deliverable gate; other transitions pass straight through.
  const handleStatusChange = (
    taskId: string,
    newStatus: "planning" | "in-progress" | "completed",
  ) => {
    // Talents can start/pause their own task; completed tasks and ones awaiting approval are locked.
    const current = tasks.find((t) => t.id === taskId);
    if (
      current &&
      stageAction(isCreator ? "creator" : "talent", current.status, newStatus, current.awaiting_approval) === "locked"
    ) {
      return;
    }
    if (newStatus === "completed") {
      setGateTaskId(taskId);
      return;
    }
    setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, status: newStatus } : t)));
    feedbackSwipe();
    queueStatusChange("task", taskId, newStatus);
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
      setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, status: "completed" } : t)));
      feedbackSuccess();
      queueStatusChange("task", id, "completed");
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

  const pendingCount =
    tasks.filter((t) => t.status !== "completed").length +
    personalTasks.filter((t) => t.status !== "completed").length;
  const completedCount =
    tasks.filter((t) => t.status === "completed").length +
    personalTasks.filter((t) => t.status === "completed").length;
  const inActiveTab = (status: string) =>
    activeTab === "todo" ? status !== "completed" : status === "completed";
  const filteredTasks = tasks.filter((t) => inActiveTab(t.status));
  const filteredPersonal = personalTasks.filter((t) => inActiveTab(t.status));

  // Tasks a talent has sent to their creator for approval sit in their own group: the ball is with
  // the creator, so they're locked and set apart from the work still on the talent's plate.
  const waitingTasks = !isCreator && activeTab === "todo" ? filteredTasks.filter((t) => t.awaiting_approval) : [];
  const activeTasks = filteredTasks.filter((t) => !waitingTasks.includes(t));

  const totalVisibleCount = filteredPersonal.length + activeTasks.length;
  const personalLimit = showAllTasks ? filteredPersonal.length : Math.min(filteredPersonal.length, TASK_DISPLAY_LIMIT);
  const projectLimit = showAllTasks ? activeTasks.length : Math.max(0, TASK_DISPLAY_LIMIT - personalLimit);
  const visiblePersonal = filteredPersonal.slice(0, personalLimit);
  const visibleActiveTasks = activeTasks.slice(0, projectLimit);

  const renderProjectTask = (task: MyTask) => (
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
      stageRule={(to) => stageAction(isCreator ? "creator" : "talent", task.status, to, task.awaiting_approval)}
      onClick={() => navigate(`/projects/${task.project}?task=${task.id}`)}
    />
  );

  return (
    <section className="glass-card p-5 sm:p-6 md:p-7">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-foreground">My Tasks</h2>
        {canAddPersonal && (
          <Button
            size="icon"
            aria-label="Add a task"
            className="h-9 w-9 rounded-xl bg-primary text-white hover:bg-primary/90"
            onClick={openAddPersonal}
          >
            <Plus className="h-5 w-5" />
          </Button>
        )}
      </div>

      {/* To Do/ Completed tabs */} 
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-4">
          <TabsTrigger value="todo" className="text-muted-foreground data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm">
            To Do <span className="ml-1 text-xs ">({pendingCount})</span>
          </TabsTrigger>
          <TabsTrigger value="completed" className="text-muted-foreground data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm">
            Completed <span className="ml-1 text-xs">({completedCount})</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="space-y-2 ">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : filteredPersonal.length + filteredTasks.length > 0 ? (
            <>
              {visiblePersonal.map((task) => (
                <TaskCard
                  key={`personal-${task.id}`}
                  id={task.id}
                  name={task.name}
                  description={task.description ?? undefined}
                  deadline={task.deadline}
                  projectName={personalLabel(task)}
                  status={task.status}
                  onStatusChange={handlePersonalStatusChange}
                  onClick={() => openEditPersonal(task)}
                />
              ))}
              {visibleActiveTasks.map(renderProjectTask)}
              {waitingTasks.length > 0 && (
                <div className="space-y-2 rounded-lg border border-dashed border-amber-400/50 bg-amber-500/5 p-2">
                  <p className="flex items-center gap-1.5 px-1 text-xs font-medium text-amber-600">
                    <Hourglass className="h-3.5 w-3.5" />
                    Waiting on your creator ({waitingTasks.length})
                  </p>
                  {waitingTasks.map(renderProjectTask)}
                </div>
              )}
              {totalVisibleCount > TASK_DISPLAY_LIMIT && (
                <button
                  type="button"
                  onClick={() => setShowAllTasks((v) => !v)}
                  className="block w-full border-t border-border/50 p-3 text-center text-sm font-medium text-primary hover:bg-secondary/30 transition-colors"
                >
                  {showAllTasks ? "Show less" : `View all (${totalVisibleCount})`}
                </button>
              )}
            </>
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

      <PersonalTaskDialog
        open={personalDialogOpen}
        onOpenChange={setPersonalDialogOpen}
        task={editingPersonal}
        linkableProjects={linkableProjects}
        onSaved={handlePersonalSaved}
        onDeleted={(id) => setPersonalTasks((prev) => prev.filter((t) => t.id !== id))}
      />

      <AlertDialog open={!!gateTaskId} onOpenChange={(o) => { if (!o) setGateTaskId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Do you have an attachment for this task?</AlertDialogTitle>
            <AlertDialogDescription>
              Onswift is attachment-based. If you have work to submit along with this task, add it now.
              {isCreator
                ? " Otherwise you can mark the task complete directly."
                : " Otherwise we'll let your creator know it's ready for their approval."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleNoDeliverable}>
              {isCreator ? "No, complete it" : "No, request approval"}
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleHasDeliverable}>Yes, add attachment</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
