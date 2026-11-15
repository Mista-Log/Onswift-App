import {
  createContext,
  useContext,
  useState,
  ReactNode,
  useEffect,
  useRef,
} from "react";
import { mapFromBackend } from "../lib/api";
import { useAuth } from "./AuthContext";
import { secureFetch, isNetworkError } from '../api/apiClient';
import { clearCache, readCache, writeCache } from "../lib/cache";

export interface Task {
  id: string;
  project: string;
  name: string;
  description: string;
  assignees: string[];
  assignee_names: string[];
  status: "planning" | "in-progress" | "completed";
  deadline: string | null;
  task_time?: string | null;
  recurrence_type?: "daily" | "weekly" | "monthly" | "custom" | null;
  recurrence_days?: number | null;
  /** A talent asked for completion; waiting on the creator. */
  awaiting_approval?: boolean;
  /** The creator sent this task (or one of its deliverables) back for changes. */
  revision_requested?: boolean;
  created_at: string;
}

export interface Project {
  id: string;
  name: string;
  description: string;
  due_date: string;
  status: "in-progress" | "planning" | "completed";
  teamMembers: Array<{
    id: string;
    name: string;
    avatar: string;
  }>;
  task_count: number;
  completed_tasks: number;
  /** Tasks currently in progress; absent on data cached before this field existed. */
  in_progress_tasks?: number;
  progress?: number;
  has_clients?: boolean;
  allow_talent_task_creation?: boolean;
  /** Id of the user who owns the project: a creator, or a talent for a project they made themselves. */
  creator?: string;
  /** Name of the owner; used to label a project a team member shared with a creator. */
  owner_name?: string;
  /** A talent's own project is private until they switch this on; then their creators can view it. */
  shared_with_creators?: boolean;
}

interface ProjectContextType {
  projects: Project[];
  /** True only while the very first load is in flight and nothing is cached yet. */
  isLoading: boolean;
  /** True while the latest attempt to load the list failed; what is on screen may be out of date. */
  loadFailed: boolean;
  fetchProjects: () => Promise<void>;
  addProject: (
    project: Omit<Project, "id" | "teamMembers" | "task_count" | "completed_tasks" | "status" | "progress">
  ) => Promise<string | undefined>;
  updateProject: (id: string, updates: Partial<Project>) => Promise<void>;
  deleteProject: (id: string) => Promise<void>;
  duplicateProject: (id: string) => Promise<string | undefined>;

  // Task management
  fetchProjectTasks: (projectId: string) => Promise<Task[]>;
  addTask: (projectId: string, task: Omit<Task, "id" | "project" | "assignee_names" | "created_at">) => Promise<void>;
  updateTask: (taskId: string, updates: Partial<Task>) => Promise<void>;
  deleteTask: (taskId: string) => Promise<void>;
}

const ProjectContext = createContext<ProjectContextType | undefined>(undefined);

const PROJECTS_CHANGED = "onswift:projects-changed";
const MAX_AUTO_RETRIES = 5;
const STALE_AFTER_MS = 60_000;

/** Tell the app that projects or tasks were changed somewhere else, so the project list reloads. */
export function announceProjectsChanged(): void {
  window.dispatchEvent(new Event(PROJECTS_CHANGED));
}

/** Calls `handler` each time that happens. Returns the unsubscribe function. */
export function onProjectsChanged(handler: () => void): () => void {
  window.addEventListener(PROJECTS_CHANGED, handler);
  return () => window.removeEventListener(PROJECTS_CHANGED, handler);
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

/**
 * A project is "planning" until work actually starts (a fresh duplicate has tasks but none begun),
 * "completed" when every task is done, and "in-progress" otherwise. When the API doesn't report
 * in_progress_tasks (older cached data) we can't tell, so it falls back to "in-progress".
 */
export const deriveStatus = (p: Project): Project["status"] => {
  if (p.task_count === 0) return "planning";
  if (p.completed_tasks >= p.task_count) return "completed";
  if (p.in_progress_tasks === 0 && p.completed_tasks === 0) return "planning";
  return "in-progress";
};

export function ProjectProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [projects, setProjects] = useState<Project[]>(
    () => readCache<Project[]>("projects") ?? []
  );
  const [isLoading, setIsLoading] = useState<boolean>(
    () => readCache<Project[]>("projects") === null && !!localStorage.getItem("onswift_access")
  );
  const signedInUserId = useRef<string | undefined>(undefined);
  const [loadFailed, setLoadFailed] = useState(false);
  const failedAttempts = useRef(0);
  const lastLoadedAt = useRef(0);
  const retryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const getToken = () => localStorage.getItem("onswift_access");

  const cancelRetry = () => {
    if (retryTimer.current) clearTimeout(retryTimer.current);
    retryTimer.current = null;
  };

  // FETCH PROJECTS
  // A failed load keeps whatever is on screen, flags it, and tries again by itself with growing
  // gaps (2s, 4s, 8s, 16s, 30s). After that it waits for the user, the tab or the network to return.
  const fetchProjects = async () => {
    cancelRetry();
    let loaded = false;
    let worthRetrying = true;
    try {
      // Just provide the endpoint. secureFetch handles the token + refresh!
      const response = await secureFetch('/api/v2/projects/');
      if (response.ok) {
        const data = await response.json();
        const mapped = data.map((p: Project) => ({ ...p, status: deriveStatus(p) }));
        setProjects(mapped);
        writeCache("projects", mapped);
        loaded = true;
      } else {
        // The server refused (signed out, not allowed): asking again will not change the answer.
        worthRetrying = response.status >= 500 || response.status === 408 || response.status === 429;
      }
    } catch (error) {
      console.error("Error loading projects:", error);
    }
    if (!signedInUserId.current) return;
    if (loaded) {
      failedAttempts.current = 0;
      lastLoadedAt.current = Date.now();
      setLoadFailed(false);
      return;
    }
    setLoadFailed(true);
    failedAttempts.current += 1;
    if (worthRetrying && failedAttempts.current <= MAX_AUTO_RETRIES) {
      const delay = Math.min(30_000, 2_000 * 2 ** (failedAttempts.current - 1));
      retryTimer.current = setTimeout(() => void fetchProjects(), delay);
    }
  };

  // Load when a user signs in (or the session is restored), clear when they sign out.
  // A mount-only fetch ran on the landing page with no token and never re-ran after login.
  useEffect(() => {
    if (!user) {
      if (signedInUserId.current) setProjects([]);
      signedInUserId.current = undefined;
      cancelRetry();
      failedAttempts.current = 0;
      setLoadFailed(false);
      return;
    }
    signedInUserId.current = user.id;
    setIsLoading(projects.length === 0);
    fetchProjects().finally(() => setIsLoading(false));
  }, [user?.id]);

  // Something outside this provider changed projects or tasks (the Agent): bring the list up to date.
  useEffect(() => {
    return onProjectsChanged(() => {
      if (signedInUserId.current) void fetchProjects();
    });
  }, []);

  // Coming back to the tab or back online: refresh if the list is stale or its last load failed.
  useEffect(() => {
    const refresh = () => {
      if (!signedInUserId.current || document.visibilityState !== "visible") return;
      const stale = Date.now() - lastLoadedAt.current > STALE_AFTER_MS;
      if (stale || failedAttempts.current > 0) void fetchProjects();
    };
    document.addEventListener("visibilitychange", refresh);
    window.addEventListener("online", refresh);
    return () => {
      document.removeEventListener("visibilitychange", refresh);
      window.removeEventListener("online", refresh);
      cancelRetry();
    };
  }, []);

  // ---------------- ADD PROJECT ----------------
  const addProject = async (projectData: {name: string; description: string; due_date: string;}): Promise<string | undefined> => {
    try {
      const res = await secureFetch(`/api/v2/projects/`, {
        method: "POST",
        body: JSON.stringify({
          name: projectData.name,
          description: projectData.description,
          due_date: projectData.due_date,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        console.error("Backend validation error:", data);
        throw new Error(JSON.stringify(data));
      }

      await fetchProjects();
      return data.id as string;
    } catch (error: any) {
      console.error("Add Project failed:", error.message);
      throw error;
    }
  };

  // ---------------- UPDATE PROJECT ----------------
  const updateProject = async (id: string, updates: Partial<Project>) => {
    try {
      const res = await secureFetch(`/api/v2/projects/${id}/`, {
        method: "PATCH",
        body: JSON.stringify({
          name: updates.name,
          description: updates.description,
          due_date: updates.due_date,
          status: updates.status,
          allow_talent_task_creation: updates.allow_talent_task_creation,
          shared_with_creators: updates.shared_with_creators,
        }),
      });

      if (!res.ok) throw new Error("Failed to update project");

      const data = await res.json();
      // Merge over what we already hold: the mapper keeps only some fields, and the rest
      // (owner, sharing, has_clients) must survive a rename or a toggle.
      const updated = { ...mapFromBackend(data), shared_with_creators: data.shared_with_creators } as Project;

      setProjects((prev) =>
        prev.map((p) => (p.id === id ? { ...p, ...updated, status: deriveStatus({ ...p, ...updated }) } : p))
      );
    } catch (error: any) {
      console.error("Update Project failed:", error.message);
      throw error;
    }
  };

  // ---------------- DUPLICATE PROJECT ----------------
  const duplicateProject = async (id: string): Promise<string | undefined> => {
    try {
      const res = await secureFetch(`/api/v2/projects/${id}/duplicate/`, {
        method: "POST",
      });

      const data = await res.json();

      if (!res.ok) {
        console.error("Backend validation error:", data);
        throw new Error(data?.error || "Failed to duplicate project");
      }

      await fetchProjects();
      return data.id as string;
    } catch (error: any) {
      console.error("Duplicate Project failed:", error.message);
      throw error;
    }
  };

  // ---------------- DELETE PROJECT ----------------
  const deleteProject = async (id: string) => {
    try {
      const res = await secureFetch(`/api/v2/projects/${id}/`, {
        method: "DELETE",
      });

      if (!res.ok) throw new Error("Failed to delete project");

      setProjects((prev) => {
        const remaining = prev.filter((p) => p.id !== id);
        writeCache("projects", remaining);
        return remaining;
      });
      // The project's tasks are gone on the server, so drop every saved copy of their deadlines
      // and tell the sidebar badge to recount.
      clearCache("deadlines");
      clearCache("deadline-count");
      clearCache(`project-tasks:${id}`);
      window.dispatchEvent(new Event("onswift:deadlines-changed"));
    } catch (error: any) {
      console.error("Delete Project failed:", error.message);
      throw error;
    }
  };

  // ---------------- FETCH PROJECT TASKS ----------------
  const fetchProjectTasks = async (projectId: string): Promise<Task[]> => {
    try {
      const response = await secureFetch(`/api/v2/projects/${projectId}/tasks/`);
      if (response.ok) {
        const data = await response.json();
        // Keep a copy in this browser for slow or offline visits.
        writeCache(`project-tasks:${projectId}`, data, 30 * 60 * 1000);
        return data;
      }
      return readCache<Task[]>(`project-tasks:${projectId}`) ?? [];
    } catch (error) {
      console.error("Error loading tasks:", error);
      return readCache<Task[]>(`project-tasks:${projectId}`) ?? [];
    }
  };

  // ---------------- ADD TASK ----------------
  const addTask = async (projectId: string, taskData: Omit<Task, "id" | "project" | "assignee_names" | "created_at">) => {
    try {
      const res = await secureFetch(`/api/v2/projects/${projectId}/tasks/`, {
        method: "POST",
        body: JSON.stringify({
          name: taskData.name,
          description: taskData.description,
          assignees: taskData.assignees ?? [],
          status: taskData.status || "planning",
          deadline: taskData.deadline || null,
          task_time: taskData.task_time || null,
          recurrence_type: taskData.recurrence_type || null,
          recurrence_days: taskData.recurrence_days || null,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        console.error("Backend validation error:", data);
        throw new Error(JSON.stringify(data));
      }

      // Refresh projects to update task counts
      await fetchProjects();
    } catch (error: any) {
      console.error("Add Task failed:", error.message);
      throw error;
    }
  };

  // ---------------- UPDATE TASK ----------------
  const updateTask = async (taskId: string, updates: Partial<Task>) => {
    try {
      const res = await secureFetch(`/api/v2/tasks/${taskId}/`, {
        method: "PATCH",
        body: JSON.stringify({
          name: updates.name,
          description: updates.description,
          assignees: updates.assignees,
          status: updates.status,
          deadline: updates.deadline,
        }),
      });

      if (!res.ok) throw new Error("Failed to update task");

      // Refresh projects to update task counts
      await fetchProjects();
    } catch (error: any) {
      console.error("Update Task failed:", error.message);
      throw error;
    }
  };

  // ---------------- DELETE TASK ----------------
  const deleteTask = async (taskId: string) => {
    try {
      const res = await secureFetch(`/api/v2/tasks/${taskId}/`, {
        method: "DELETE",
      });

      if (!res.ok) throw new Error("Failed to delete task");

      // Refresh projects to update task counts
      await fetchProjects();
    } catch (error: any) {
      console.error("Delete Task failed:", error.message);
      throw error;
    }
  };

  return (
    <ProjectContext.Provider
      value={{
        projects,
        isLoading,
        loadFailed,
        fetchProjects,
        addProject,
        updateProject,
        deleteProject,
        duplicateProject,
        fetchProjectTasks,
        addTask,
        updateTask,
        deleteTask,
      }}
    >
      {children}
    </ProjectContext.Provider>
  );
}

export function useProjects() {
  const context = useContext(ProjectContext);
  if (!context) {
    throw new Error("useProjects must be used within ProjectProvider");
  }
  return context;
}
