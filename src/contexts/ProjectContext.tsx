import { createContext, useContext, useState, ReactNode } from "react";

export interface Project {
  id: string;
  name: string;
  description: string;
  dueDate: string;
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
  addProject: (project: Omit<Project, "id" | "teamMembers" | "taskCount" | "completedTasks" | "status">) => void;
  updateProject: (id: string, updates: Partial<Project>) => void;
  deleteProject: (id: string) => void;
}

const ProjectContext = createContext<ProjectContextType | undefined>(undefined);

const initialProjects: Project[] = [
  {
    id: "1",
    name: 'Brand Collab - "Future Funk"',
    description: "Music video production and promotional materials for upcoming EP release.",
    dueDate: "24 Oct 2023",
    status: "in-progress",
    teamMembers: [
      { id: "1", name: "Alia Vance", avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Alia" },
      { id: "2", name: "Ben Carter", avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Ben" },
      { id: "3", name: "Clara Dane", avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Clara" },
      { id: "4", name: "David Lee", avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=David" },
    ],
    taskCount: 12,
    completedTasks: 7,
  },
  {
    id: "2",
    name: '"Cyber Dreams" EP Visuals',
    description: "Album artwork and visualizer animations for Cyber Dreams EP.",
    dueDate: "15 Nov 2023",
    status: "planning",
    teamMembers: [
      { id: "1", name: "Alia Vance", avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Alia" },
      { id: "2", name: "Ben Carter", avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Ben" },
    ],
    taskCount: 8,
    completedTasks: 0,
  },
  {
    id: "3",
    name: "V-Tuber Model 2.0",
    description: "Updated VTuber model with new expressions and rigging.",
    dueDate: "02 Oct 2023",
    status: "completed",
    teamMembers: [
      { id: "1", name: "Alia Vance", avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Alia" },
    ],
    taskCount: 6,
    completedTasks: 6,
  },
];

export function ProjectProvider({ children }: { children: ReactNode }) {
  const [projects, setProjects] = useState<Project[]>(initialProjects);

  const addProject = (projectData: Omit<Project, "id" | "teamMembers" | "taskCount" | "completedTasks" | "status">) => {
    const newProject: Project = {
      ...projectData,
      id: Date.now().toString(),
      teamMembers: [],
      taskCount: 0,
      completedTasks: 0,
      status: "planning",
    };
    setProjects((prev) => [newProject, ...prev]);
  };

  const updateProject = (id: string, updates: Partial<Project>) => {
    setProjects((prev) =>
      prev.map((project) => (project.id === id ? { ...project, ...updates } : project))
    );
  };

  const deleteProject = (id: string) => {
    setProjects((prev) => prev.filter((project) => project.id !== id));
  };

  return (
    <ProjectContext.Provider value={{ projects, addProject, updateProject, deleteProject }}>
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
