import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/dashboard/StatusBadge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Plus, Calendar, Users } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { useProjects } from "@/contexts/ProjectContext";

// Creator's projects (projects they own)
const creatorProjects = [
  {
    id: "1",
    name: 'Brand Collab - "Future Funk"',
    description: "Music video production and promotional materials for upcoming EP release.",
    dueDate: "24 Oct 2023",
    status: "in-progress" as const,
    teamMembers: [
      { id: "1", name: "Alia Vance", avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Alia" },
      { id: "2", name: "Ben Carter", avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Ben" },
      { id: "3", name: "Clara Dane", avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Clara" },
    ],
    taskCount: 12,
    completedTasks: 7,
  },
  {
    id: "2",
    name: '"Cyber Dreams" EP Visuals',
    description: "Album artwork and visualizer animations for Cyber Dreams EP.",
    dueDate: "15 Nov 2023",
    status: "planning" as const,
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
    status: "completed" as const,
    teamMembers: [
      { id: "1", name: "Alia Vance", avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Alia" },
    ],
    taskCount: 6,
    completedTasks: 6,
  },
];

// Talent's assigned projects (projects they're working on)
const talentProjects = [
  {
    id: "1",
    name: 'Brand Collab - "Future Funk"',
    description: "Creating promotional materials and motion graphics.",
    dueDate: "24 Oct 2023",
    status: "in-progress" as const,
    creatorName: "Alex Johnson",
    creatorAvatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Alex",
    myTasks: 5,
    completedTasks: 3,
  },
  {
    id: "4",
    name: "Mobile App UI Redesign",
    description: "Designing new UI components and user flows.",
    dueDate: "30 Nov 2023",
    status: "in-progress" as const,
    creatorName: "Jordan Smith",
    creatorAvatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Jordan",
    myTasks: 8,
    completedTasks: 2,
  },
  {
    id: "5",
    name: "Logo Design for StartupX",
    description: "Brand identity and logo variations.",
    dueDate: "10 Oct 2023",
    status: "completed" as const,
    creatorName: "Taylor Chen",
    creatorAvatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Taylor",
    myTasks: 4,
    completedTasks: 4,
  },
];

export default function Projects() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { projects: contextProjects, addProject } = useProjects();
  const isTalent = user?.role === 'talent';
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    dueDate: "",
  });

  const projects = isTalent ? talentProjects : contextProjects;

  const handleCreateProject = () => {
    if (!formData.name || !formData.description || !formData.dueDate) {
      toast.error("Please fill in all fields");
      return;
    }

    addProject({
      name: formData.name,
      description: formData.description,
      dueDate: new Date(formData.dueDate).toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' }),
    });

    toast.success("Project created successfully!");
    setFormData({ name: "", description: "", dueDate: "" });
    setIsDialogOpen(false);
  };

  return (
    <MainLayout>
      <div className="animate-fade-in space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">
              {isTalent ? "My Projects" : "Projects"}
            </h1>
            <p className="mt-1 text-muted-foreground">
              {isTalent
                ? "Projects you're currently working on"
                : "Manage all your creative projects"
              }
            </p>
          </div>

          {!isTalent && (
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button className="gap-2">
                  <Plus className="h-4 w-4" />
                  New Project
                </Button>
              </DialogTrigger>
              <DialogContent className="glass-card border-border/50 sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>Create New Project</DialogTitle>
                  <DialogDescription>
                    Add a new project to organize your tasks and team.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Project Name</Label>
                    <Input
                      id="name"
                      placeholder="Enter project name"
                      value={formData.name}
                      onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="description">Description</Label>
                    <Textarea
                      id="description"
                      placeholder="Describe your project"
                      value={formData.description}
                      onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="dueDate">Due Date</Label>
                    <Input
                      id="dueDate"
                      type="date"
                      value={formData.dueDate}
                      onChange={(e) => setFormData(prev => ({ ...prev, dueDate: e.target.value }))}
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-3">
                  <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleCreateProject}>Create Project</Button>
                </div>
              </DialogContent>
            </Dialog>
          )}
        </div>

        {/* Projects Grid */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {projects.map((project) => (
            <div
              key={project.id}
              onClick={() => navigate(`/projects/${project.id}`)}
              className="glass-card-hover cursor-pointer p-6"
            >
              <div className="mb-4 flex items-start justify-between">
                <h3 className="font-semibold text-foreground">{project.name}</h3>
                <StatusBadge status={project.status} />
              </div>

              <p className="mb-4 line-clamp-2 text-sm text-muted-foreground">
                {project.description}
              </p>

              {/* Progress */}
              <div className="mb-4">
                <div className="mb-1 flex justify-between text-sm">
                  <span className="text-muted-foreground">
                    {isTalent ? "My Progress" : "Progress"}
                  </span>
                  <span className="text-foreground">
                    {project.completedTasks}/{isTalent ? (project as any).myTasks : (project as any).taskCount} tasks
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-secondary">
                  <div
                    className="h-full rounded-full bg-primary transition-all"
                    style={{
                      width: `${(project.completedTasks / (isTalent ? (project as any).myTasks : (project as any).taskCount)) * 100}%`,
                    }}
                  />
                </div>
              </div>

              {/* Meta */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Calendar className="h-4 w-4" />
                  <span>{project.dueDate}</span>
                </div>

                {isTalent ? (
                  <div className="flex items-center gap-2">
                    <Avatar className="h-7 w-7 border-2 border-card">
                      <AvatarImage src={(project as any).creatorAvatar} alt={(project as any).creatorName} />
                      <AvatarFallback className="bg-primary/20 text-primary text-xs">
                        {(project as any).creatorName.charAt(0)}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-xs text-muted-foreground">{(project as any).creatorName}</span>
                  </div>
                ) : (
                  <div className="flex -space-x-2">
                    {(project as any).teamMembers.slice(0, 3).map((member: any) => (
                      <Avatar key={member.id} className="h-7 w-7 border-2 border-card">
                        <AvatarImage src={member.avatar} alt={member.name} />
                        <AvatarFallback className="bg-primary/20 text-primary text-xs">
                          {member.name.charAt(0)}
                        </AvatarFallback>
                      </Avatar>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </MainLayout>
  );
}
