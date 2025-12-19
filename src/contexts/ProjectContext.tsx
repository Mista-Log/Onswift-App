import {
  createContext,
  useContext,
  useState,
  ReactNode,
  useEffect,
} from "react";
import { mapFromBackend } from "../lib/api";
import { useAuth } from "./AuthContext";

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
}

interface ProjectContextType {
  projects: Project[];
  fetchProjects: () => Promise<void>;
  addProject: (
    project: Omit<Project, "id" | "teamMembers" | "task_count" | "completed_tasks" | "status" | "progress">
  ) => Promise<void>;
  updateProject: (id: string, updates: Partial<Project>) => Promise<void>;
  deleteProject: (id: string) => Promise<void>;
}

const ProjectContext = createContext<ProjectContextType | undefined>(undefined);

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

export function ProjectProvider({ children }: { children: ReactNode }) {
  const [projects, setProjects] = useState<Project[]>([]);

  const getToken = () => localStorage.getItem("onswift_access");

  // 🔄 Fetch projects
  const fetchProjects = async () => {
    const token = getToken();
    if (!token) return;

    const res = await fetch(`${API_BASE_URL}/api/v2/projects/`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) throw new Error("Failed to fetch projects");

    const data = await res.json();
    setProjects(data.map(mapFromBackend));
  };

  // 🚀 Fetch on mount (near-realtime)
  useEffect(() => {
    fetchProjects();
  }, []);

  const addProject = async (projectData: {name: string; description: string; due_date: string;}) => {
    const token = getToken();
    if (!token) throw new Error("No token");

    const res = await fetch(`${API_BASE_URL}/api/v2/projects/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        name: projectData.name,
        description: projectData.description,
        due_date: projectData.due_date, // ✅ ISO format
      }),
    });
    

  const data = await res.json(); // 👈 READ RESPONSE

  if (!res.ok) {
    console.error("Backend validation error:", data);
    throw new Error(JSON.stringify(data));
  }

  // 🔥 Sync progress
  await fetchProjects();

  const newProject = mapFromBackend(data);

    // ⚡ optimistic realtime update
    setProjects((prev) => [newProject, ...prev]);
  };


  const updateProject = async (id: string, updates: Partial<Project>) => {
    const token = getToken();
    if (!token) throw new Error("No token");

    const res = await fetch(`${API_BASE_URL}/api/v2/projects/${id}/`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        name: updates.name,
        description: updates.description,
        due_date: updates.due_date,
        status: updates.status,
      }),
    });

    if (!res.ok) throw new Error("Failed to update project");

    const updated = mapFromBackend(await res.json());

    setProjects((prev) =>
      prev.map((p) => (p.id === id ? updated : p))
    );
  };


    const deleteProject = async (id: string) => {
    const token = getToken();
    if (!token) throw new Error("No token");

    const res = await fetch(`${API_BASE_URL}/api/v2/projects/${id}/`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) throw new Error("Failed to delete project");

    setProjects((prev) => prev.filter((p) => p.id !== id));
  };




  return (
    <ProjectContext.Provider
      value={{
        projects,
        fetchProjects,
        addProject,
        updateProject,
        deleteProject,
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
