// import { createContext, useContext, useState, ReactNode } from "react";

// export interface Project {
//   id: string;
//   name: string;
//   description: string;
//   due_date: string;
//   status: "in-progress" | "planning" | "completed";
//   teamMembers: Array<{
//     id: string;
//     name: string;
//     avatar: string;
//   }>;
//   taskCount: number;
//   completedTasks: number;
// }

// interface ProjectContextType {
//   projects: Project[];
//   addProject: (project: Omit<Project, "id" | "teamMembers" | "taskCount" | "completedTasks" | "status">) => void;
//   updateProject: (id: string, updates: Partial<Project>) => void;
//   deleteProject: (id: string) => void;
// }

// const ProjectContext = createContext<ProjectContextType | undefined>(undefined);

// const initialProjects: Project[] = [
//   {
//     id: "1",
//     name: 'Brand Collab - "Future Funk"',
//     description: "Music video production and promotional materials for upcoming EP release.",
//     due_date: "24 Oct 2023",
//     status: "in-progress",
//     teamMembers: [
//       { id: "1", name: "Alia Vance", avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Alia" },
//       { id: "2", name: "Ben Carter", avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Ben" },
//       { id: "3", name: "Clara Dane", avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Clara" },
//       { id: "4", name: "David Lee", avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=David" },
//     ],
//     taskCount: 12,
//     completedTasks: 7,
//   },
//   {
//     id: "2",
//     name: '"Cyber Dreams" EP Visuals',
//     description: "Album artwork and visualizer animations for Cyber Dreams EP.",
//     due_date: "15 Nov 2023",
//     status: "planning",
//     teamMembers: [
//       { id: "1", name: "Alia Vance", avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Alia" },
//       { id: "2", name: "Ben Carter", avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Ben" },
//     ],
//     taskCount: 8,
//     completedTasks: 0,
//   },
//   {
//     id: "3",
//     name: "V-Tuber Model 2.0",
//     description: "Updated VTuber model with new expressions and rigging.",
//     due_date: "02 Oct 2023",
//     status: "completed",
//     teamMembers: [
//       { id: "1", name: "Alia Vance", avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Alia" },
//     ],
//     taskCount: 6,
//     completedTasks: 6,
//   },
// ];

// export function ProjectProvider({ children }: { children: ReactNode }) {
//   const [projects, setProjects] = useState<Project[]>(initialProjects);

//   const addProject = (projectData: Omit<Project, "id" | "teamMembers" | "taskCount" | "completedTasks" | "status">) => {
//     const newProject: Project = {
//       ...projectData,
//       id: Date.now().toString(),
//       teamMembers: [],
//       taskCount: 0,
//       completedTasks: 0,
//       status: "planning",
//     };
//     setProjects((prev) => [newProject, ...prev]);
//   };

//   const updateProject = (id: string, updates: Partial<Project>) => {
//     setProjects((prev) =>
//       prev.map((project) => (project.id === id ? { ...project, ...updates } : project))
//     );
//   };

//   const deleteProject = (id: string) => {
//     setProjects((prev) => prev.filter((project) => project.id !== id));
//   };

//   return (
//     <ProjectContext.Provider value={{ projects, addProject, updateProject, deleteProject }}>
//       {children}
//     </ProjectContext.Provider>
//   );
// }

// export function useProjects() {
//   const context = useContext(ProjectContext);
//   if (!context) {
//     throw new Error("useProjects must be used within ProjectProvider");
//   }
//   return context;
// }


// import { createContext, useContext, useState, ReactNode, useEffect } from "react";

// export interface Project {
//   id: string;
//   name: string;
//   description: string;
//   due_date: string;
//   status: "in-progress" | "planning" | "completed";
//   teamMembers: Array<{
//     id: string;
//     name: string;
//     avatar: string;
//   }>;
//   taskCount: number;
//   completedTasks: number;
// }

// interface ProjectContextType {
//   projects: Project[];
//   fetchProjects: () => Promise<void>;
//   addProject: (project: Omit<Project, "id" | "teamMembers" | "taskCount" | "completedTasks" | "status">) => Promise<void>;
//   updateProject: (id: string, updates: Partial<Project>) => Promise<void>;
//   deleteProject: (id: string) => Promise<void>;
// }

// const ProjectContext = createContext<ProjectContextType | undefined>(undefined);

// const API_BASE_URL = import.meta.env.VITE_API_BASE_URL; // Replace with your backend URL

// export function ProjectProvider({ children }: { children: ReactNode }) {
//   const [projects, setProjects] = useState<Project[]>([]);

//   // Fetch projects from backend on mount
//   // useEffect(() => {
//   //   const fetchProjects = async () => {
//   //     const token = localStorage.getItem("onswift_access");
//   //     if (!token) return;

//   //     try {
//   //       const res = await fetch(`${API_BASE_URL}/api/v2/projects/`, {
//   //         headers: {
//   //           Authorization: `Bearer ${token}`,
//   //         },
//   //       });

//   //       if (!res.ok) throw new Error("Failed to fetch projects");
//   //       const data = await res.json();
//   //       setProjects(data);
//   //     } catch (error) {
//   //       console.error(error);
//   //     }
//   //   };

//   //   fetchProjects();
//   // }, []);



//   const fetchProjects = async () => {
//     const token = localStorage.getItem("onswift_access");
//     if (!token) return;

//     try {
//       const res = await fetch(`${API_BASE_URL}/api/v2/projects/`, {
//         method: "GET",
//         headers: {
//           Authorization: `Bearer ${token}`,
//         },
//       });

//       if (!res.ok) throw new Error("Failed to fetch projects");
//       const data = await res.json();

//       setProjects(data);
//     } catch (error) {
//       console.error(error);
//     }
//   };



//   const addProject = async (projectData: Omit<Project, "id" | "teamMembers" | "taskCount" | "completedTasks" | "status">) => {

//     const token = localStorage.getItem("onswift_access");
//     const creatorId = localStorage.getItem("user_id");

//     if (!token) throw new Error("No access token found");

//     try {
//       const res = await fetch(`${API_BASE_URL}/api/v2/projects/`, {
//         method: "POST",
//         headers: {
//           "Content-Type": "application/json",
//           Authorization: `Bearer ${token}`, // <-- this is the key part
//         },        
//         body: JSON.stringify({
//         ...projectData,
//         creator: creatorId, // 👈 added explicitly
//       }),
//       });
//       if (!res.ok) throw new Error("Failed to add project");
//       const newProject = await res.json();

//       console.log("Added project:", newProject)
//       setProjects((prev) => [newProject, ...prev]);
//     } catch (error) {
//       console.error(error);
//     }
//   };

//   const updateProject = async (id: string, updates: Partial<Project>) => {

//     const token = localStorage.getItem("onswift_access");
//     if (!token) throw new Error("No access token found");

//     try {
//       const res = await fetch(`${API_BASE_URL}/api/v2/projects/${id}/`, {
//         method: "PATCH",
//         headers: {
//           "Content-Type": "application/json",
//           Authorization: `Bearer ${token}`, // <-- this is the key part
//         }, 
//         body: JSON.stringify(updates),
//       });
//       if (!res.ok) throw new Error("Failed to update project");
//       const updatedProject = await res.json();
//       setProjects((prev) => prev.map((p) => (p.id === id ? updatedProject : p)));
//     } catch (error) {
//       console.error(error);
//     }
//   };

//   const deleteProject = async (id: string) => {
//     const token = localStorage.getItem("onswift_access");
//     if (!token) throw new Error("No access token found");

//     try {
//       const res = await fetch(`${API_BASE_URL}/api/v2/projects/${id}/`, {
//         method: "DELETE",
//         headers: {
//           Authorization: `Bearer ${token}`,
//         },
//       });

//       if (!res.ok) throw new Error("Failed to delete project");
//       setProjects((prev) => prev.filter((p) => p.id !== id));
//     } catch (error) {
//       console.error(error);
//     }
//   };


//   return (
//     <ProjectContext.Provider value={{ projects, addProject, fetchProjects, updateProject, deleteProject }}>
//       {children}
//     </ProjectContext.Provider>
//   );
// }

// export function useProjects() {
//   const context = useContext(ProjectContext);
//   if (!context) {
//     throw new Error("useProjects must be used within ProjectProvider");
//   }
//   return context;
// }



import {
  createContext,
  useContext,
  useState,
  ReactNode,
  useEffect,
} from "react";
import { mapFromBackend } from "../lib/api";

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
  taskCount: number;
  completedTasks: number;
}

interface ProjectContextType {
  projects: Project[];
  fetchProjects: () => Promise<void>;
  addProject: (
    project: Omit<Project, "id" | "teamMembers" | "taskCount" | "completedTasks" | "status">
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
