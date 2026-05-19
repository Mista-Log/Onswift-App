import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/dashboard/StatusBadge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Plus, Calendar as CalendarIcon, Users, FolderKanban, MoreVertical, Trash2, ExternalLink, Sparkles, ArrowRight, Pencil } from "lucide-react";
import { CelebrationModal } from "@/components/CelebrationModal";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
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
} from "@/components/ui/dropdown-menu";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { useProjects } from "@/contexts/ProjectContext";

export default function Projects() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { projects, addProject, deleteProject, updateProject } = useProjects();
  const isTalent = user?.role === 'talent';
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [projectToDelete, setProjectToDelete] = useState<{ id: string; name: string } | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    due_date: "",
  });
  const [celebration, setCelebration] = useState<{ open: boolean; projectId?: string }>({ open: false });
  const [renameDialogOpen, setRenameDialogOpen] = useState(false);
  const [projectToRename, setProjectToRename] = useState<{ id: string; name: string } | null>(null);
  const [renameValue, setRenameValue] = useState("");

  const handleDeleteProject = async () => {
    if (!projectToDelete) return;
    try {
      await deleteProject(projectToDelete.id);
      toast.success("Project deleted successfully");
    } catch (error) {
      toast.error("Failed to delete project");
    } finally {
      setDeleteDialogOpen(false);
      setProjectToDelete(null);
    }
  };

  const openDeleteDialog = (e: React.MouseEvent, project: { id: string; name: string }) => {
    e.stopPropagation();
    setProjectToDelete(project);
    setDeleteDialogOpen(true);
  };

  const openRenameDialog = (e: React.MouseEvent, project: { id: string; name: string }) => {
    e.stopPropagation();
    setProjectToRename(project);
    setRenameValue(project.name);
    setRenameDialogOpen(true);
  };

  const handleRenameProject = async () => {
    if (!projectToRename || !renameValue.trim()) return;
    try {
      await updateProject(projectToRename.id, { name: renameValue.trim() });
      toast.success("Project renamed successfully");
    } catch {
      toast.error("Failed to rename project");
    } finally {
      setRenameDialogOpen(false);
      setProjectToRename(null);
    }
  };

  // const projects = isTalent ? talentProjects : contextProjects;




  const handleCreateProject = async () => {
    if (!formData.name || !formData.description || !formData.due_date) {
      toast.error("Please fill in all fields");
      return;
    }

    const isFirstProject = projects.length === 0;

    const newId = await addProject({
      name: formData.name,
      description: formData.description,
      due_date: formData.due_date,
    });

    toast.success("Project created successfully!");
    setFormData({ name: "", description: "", due_date: "" });
    setIsDialogOpen(false);

    if (isFirstProject && !localStorage.getItem("onswift_celebrated_first_project")) {
      localStorage.setItem("onswift_celebrated_first_project", "1");
      setCelebration({ open: true, projectId: newId });
    }
  };



  return (
    <MainLayout>
      <div className="animate-fade-in space-y-6 sm:space-y-8">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-foreground leading-tight">
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
                <Button className="gap-2 w-full sm:w-auto">
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
                    <Label>Due Date</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn(
                            "w-full justify-start text-left font-normal",
                            !formData.due_date && "text-muted-foreground"
                          )}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {formData.due_date ? format(new Date(formData.due_date), "PPP") : "Pick a date"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0 z-50" align="start">
                        <Calendar
                          mode="single"
                          selected={formData.due_date ? new Date(formData.due_date) : undefined}
                          onSelect={(date) => setFormData(prev => ({ ...prev, due_date: date ? format(date, "yyyy-MM-dd") : "" }))}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
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
        {projects.length === 0 ? (
          isTalent ? (
            <div className="flex flex-col items-center justify-center p-8 sm:p-12 text-center min-h-[360px]">
              <div className="rounded-2xl bg-secondary/60 p-6 mb-4">
                <FolderKanban className="h-12 w-12 text-muted-foreground/50" />
              </div>
              <p className="text-base font-semibold text-foreground">No projects assigned yet</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Projects assigned to you will appear here once a creator adds you.
              </p>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center p-10 sm:p-14 text-center min-h-[420px] border-2 border-dashed border-border/60 rounded-2xl bg-secondary/20">
              <div className="rounded-2xl bg-primary/10 p-5 mb-5">
                <FolderKanban className="h-14 w-14 text-primary" />
              </div>
              <h2 className="text-xl font-bold text-foreground mb-2">Create your first project</h2>
              <p className="text-sm text-muted-foreground mb-8 max-w-xs leading-relaxed">
                Projects are where you organize tasks, assign work to your team, and track everything from start to finish.
              </p>
              <Button
                size="lg"
                className="gap-2 text-base px-8"
                onClick={() => setIsDialogOpen(true)}
              >
                <Sparkles className="h-5 w-5" />
                Create My First Project
              </Button>
              <p className="mt-3 text-xs text-muted-foreground">Takes less than a minute</p>
            </div>
          )
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {projects.map((project) => {
              const progress =
                project.task_count === 0
                  ? 0
                  : (project.completed_tasks / project.task_count) * 100;

              return (
                <div
                  key={project.id}
                  onClick={() => navigate(`/projects/${project.id}`)}
                  className="cursor-pointer p-6 rounded-lg border group hover:border-primary/50 transition-colors"
                >
                  <div className="flex justify-between mb-3">
                    <h3 className="font-semibold">{project.name}</h3>
                    <div className="flex items-center gap-2">
                      <StatusBadge status={project.status} />
                      {!isTalent && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); navigate(`/projects/${project.id}`); }}>
                              <ExternalLink className="h-4 w-4 mr-2" />
                              Open Project
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={(e) => openRenameDialog(e, { id: project.id, name: project.name })}>
                              <Pencil className="h-4 w-4 mr-2" />
                              Rename Project
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={(e) => openDeleteDialog(e, { id: project.id, name: project.name })}
                              className="text-destructive focus:text-destructive"
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Delete Project
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </div>
                  </div>

                  <p className="text-sm text-muted-foreground mb-4">
                    {project.description}
                  </p>

                  {/* Progress */}
                  <div className="mb-4">
                    <div className="flex justify-between text-sm mb-1">
                      <span>Progress</span>
                      <span>
                        {project.completed_tasks}/{project.task_count}
                      </span>
                    </div>

                    <div className="h-2 bg-secondary rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  </div>

                  {/* Meta */}
                  {/* <div className="flex justify-between items-center text-sm">
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4" />
                      {project.due_date}
                    </div>

                    <div className="flex -space-x-2">
                      {project.teamMembers?.slice(0, 3).map((m) => (
                        <Avatar key={m.id} className="h-7 w-7">
                          <AvatarImage src={m.avatar} />
                          <AvatarFallback>
                            {m.name[0]}
                          </AvatarFallback>
                        </Avatar>
                      ))}
                    </div>
                  </div> */}

                  <div className="flex items-center justify-end pt-2 mt-1 border-t border-border/40">
                    <span className="flex items-center gap-1 text-xs text-muted-foreground group-hover:text-primary transition-colors">
                      Open project
                      <ArrowRight className="h-3 w-3 group-hover:translate-x-0.5 transition-transform" />
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* First project celebration */}
        <CelebrationModal
          open={celebration.open}
          onClose={() => setCelebration({ open: false })}
          emoji="🚀"
          title="First project is live!"
          description="You're officially building on Onswift! Head into your project and create your first task to start tracking real work."
          cta={
            celebration.projectId
              ? { label: "Create My First Task", href: `/projects/${celebration.projectId}` }
              : undefined
          }
          secondaryLabel="I'll explore on my own"
        />

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Project</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete "{projectToDelete?.name}"? This action cannot be undone and will remove all tasks and deliverables associated with this project.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDeleteProject}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
        {/* Rename Dialog */}
        <Dialog open={renameDialogOpen} onOpenChange={setRenameDialogOpen}>
          <DialogContent className="glass-card border-border/50 sm:max-w-sm">
            <DialogHeader>
              <DialogTitle>Rename Project</DialogTitle>
              <DialogDescription>Enter a new name for "{projectToRename?.name}".</DialogDescription>
            </DialogHeader>
            <div className="py-4">
              <Label htmlFor="rename-input">Project Name</Label>
              <Input
                id="rename-input"
                className="mt-2"
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleRenameProject()}
                autoFocus
              />
            </div>
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setRenameDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleRenameProject} disabled={!renameValue.trim()}>Rename</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </MainLayout>
  );
}
