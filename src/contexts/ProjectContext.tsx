import {
  createContext,
  useContext,
  useState,
  ReactNode,
  useEffect,
} from "react";
import { mapFromBackend } from "../lib/api";
import { useAuth } from "./AuthContext";
import { secureFetch } from '../api/apiClient';

export interface Task {
  id: string;
  project: string;
  name: string;
  description: string;
  assignee: string | null;
  assignee_name: string | null;
  status: "planning" | "in-progress" | "completed";
  deadline: string | null;
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
  progress?: number;
}

interface ProjectContextType {
  projects: Project[];
  fetchProjects: () => Promise<void>;
  addProject: (
    project: Omit<Project, "id" | "teamMembers" | "task_count" | "completed_tasks" | "status" | "progress">
  ) => Promise<void>;
  updateProject: (id: string, updates: Partial<Project>) => Promise<void>;
  deleteProject: (id: string) => Promise<void>;

  // Task management
  fetchProjectTasks: (projectId: string) => Promise<Task[]>;
  addTask: (projectId: string, task: Omit<Task, "id" | "project" | "assignee_name" | "created_at">) => Promise<void>;
  updateTask: (taskId: string, updates: Partial<Task>) => Promise<void>;
  deleteTask: (taskId: string) => Promise<void>;
}

const ProjectContext = createContext<ProjectContextType | undefined>(undefined);

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

export function ProjectProvider({ children }: { children: ReactNode }) {
  const [projects, setProjects] = useState<Project[]>([]);

  const getToken = () => localStorage.getItem("onswift_access");

  // FETCH PROJECTS
  const fetchProjects = async () => {
    try {
      // Just provide the endpoint. secureFetch handles the token + refresh!
      const response = await secureFetch('/api/v2/projects/'); 
      if (response.ok) {
        const data = await response.json();
        setProjects(data);
      }
    } catch (error) {
      console.error("Error loading projects:", error);
    }
  };

  // 🚀 Fetch on mount (near-realtime)
  useEffect(() => {
    fetchProjects();
  }, []);

  // ---------------- ADD PROJECT ----------------
  const addProject = async (projectData: {name: string; description: string; due_date: string;}) => {
    try {
      // secureFetch replaces fetch + getToken logic
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

      // Sync progress & update state
      await fetchProjects();
      const newProject = mapFromBackend(data);
      setProjects((prev) => [newProject, ...prev]);
      
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
        }),
      });

      if (!res.ok) throw new Error("Failed to update project");

      const data = await res.json();
      const updated = mapFromBackend(data);

      setProjects((prev) =>
        prev.map((p) => (p.id === id ? updated : p))
      );
    } catch (error: any) {
      console.error("Update Project failed:", error.message);
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

      setProjects((prev) => prev.filter((p) => p.id !== id));
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
        return data;
      }
      return [];
    } catch (error) {
      console.error("Error loading tasks:", error);
      return [];
    }
  };

  // ---------------- ADD TASK ----------------
  const addTask = async (projectId: string, taskData: Omit<Task, "id" | "project" | "assignee_name" | "created_at">) => {
    try {
      const res = await secureFetch(`/api/v2/projects/${projectId}/tasks/`, {
        method: "POST",
        body: JSON.stringify({
          name: taskData.name,
          description: taskData.description,
          assignee: taskData.assignee || null,
          status: taskData.status || "planning",
          deadline: taskData.deadline || null,
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
          assignee: updates.assignee,
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
        fetchProjects,
        addProject,
        updateProject,
        deleteProject,
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
