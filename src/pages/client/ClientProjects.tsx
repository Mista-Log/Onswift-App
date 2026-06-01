import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { secureFetch } from "@/api/apiClient";
import { toast } from "sonner";
import { MainLayout } from "@/components/layout/MainLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import {
  ArrowRight,
  CheckCircle2,
  Clock,
  FolderKanban,
  Loader2,
  MessageCircle,
  Upload,
  CalendarDays,
} from "lucide-react";
import type { PortalProject } from "@/types/portal";
import { format } from "date-fns";

export default function ClientProjects() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [projects, setProjects] = useState<PortalProject[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadProjects();
  }, []);

  const loadProjects = async () => {
    try {
      const response = await secureFetch("/api/v5/projects/");
      if (response.ok) {
        const data = await response.json();
        const normalized = Array.isArray(data)
          ? data
          : Array.isArray(data?.projects)
          ? data.projects
          : Array.isArray(data?.results)
          ? data.results
          : [];
        setProjects(normalized);
      } else {
        toast.error("Failed to load projects");
      }
    } catch {
      toast.error("Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active":
        return "bg-green-500/10 text-green-700 border-green-200";
      case "completed":
        return "bg-blue-500/10 text-blue-700 border-blue-200";
      case "on_hold":
        return "bg-yellow-500/10 text-yellow-700 border-yellow-200";
      default:
        return "bg-gray-500/10 text-gray-700 border-gray-200";
    }
  };

  const activeCount = projects.filter((p) => p.status === "active").length;
  const completedCount = projects.filter((p) => p.status === "completed").length;
  const totalTasks = projects.reduce((s, p) => s + (p.total_tasks || 0), 0);
  const completedTasks = projects.reduce((s, p) => s + (p.completed_tasks || 0), 0);

  if (loading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="animate-fade-in space-y-8">
        {/* Welcome Header */}
        <div>
          <h1 className="text-3xl font-bold text-foreground">
            Welcome back, {user?.full_name?.split(" ")[0] || "there"}!
          </h1>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Left Column — Projects */}
          <div className="space-y-6 lg:col-span-2">
            <section className="glass-card p-6">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-lg font-semibold text-foreground">Your Projects</h2>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-muted-foreground hover:text-foreground"
                  onClick={() => navigate("/projects")}
                >
                  View All
                </Button>
              </div>

              {projects.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center gap-4">
                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
                    <FolderKanban className="h-8 w-8 text-primary" />
                  </div>
                  <div>
                    <p className="text-base font-semibold text-foreground mb-1">No projects yet</p>
                    <p className="text-sm text-muted-foreground">
                      You'll see your projects here once your creator invites you.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  {projects.slice(0, 4).map((project) => (
                    <div
                      key={project.id}
                      onClick={() => navigate(`/projects/${project.id}`)}
                      className="glass-card-hover flex cursor-pointer items-center justify-between p-4 group"
                    >
                      <div className="flex-1 min-w-0 mr-4">
                        <div className="flex items-center gap-2 mb-0.5">
                          <h3 className="font-semibold text-foreground truncate">{project.name}</h3>
                          <Badge
                            variant="outline"
                            className={`shrink-0 text-xs capitalize ${getStatusColor(project.status)}`}
                          >
                            {project.status.replace("_", " ")}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mb-2">by {project.creator_name}</p>
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-1.5 bg-secondary rounded-full overflow-hidden">
                            <div
                              className="h-full bg-primary rounded-full transition-all"
                              style={{ width: `${project.progress}%` }}
                            />
                          </div>
                          <span className="text-xs text-muted-foreground shrink-0">
                            {project.progress}%
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 shrink-0">
                        <div className="text-right hidden sm:block">
                          <p className="text-xs text-muted-foreground">
                            {project.completed_tasks}/{project.total_tasks} tasks
                          </p>
                          {project.due_date && (
                            <p className="text-xs text-muted-foreground">
                              Due {format(new Date(project.due_date), "MMM d")}
                            </p>
                          )}
                        </div>
                        <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>

          {/* Right Column — Overview + Quick Access */}
          <div className="space-y-4">
            <section className="glass-card p-6">
              <h2 className="text-lg font-semibold text-foreground mb-4">Overview</h2>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
                      <FolderKanban className="h-4 w-4 text-primary" />
                    </div>
                    <span className="text-sm text-muted-foreground">Active Projects</span>
                  </div>
                  <span className="text-2xl font-bold text-foreground">{activeCount}</span>
                </div>

                <div className="h-px bg-border" />

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-9 w-9 rounded-lg bg-green-500/10 flex items-center justify-center">
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                    </div>
                    <span className="text-sm text-muted-foreground">Completed</span>
                  </div>
                  <span className="text-2xl font-bold text-foreground">{completedCount}</span>
                </div>

                <div className="h-px bg-border" />

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-9 w-9 rounded-lg bg-blue-500/10 flex items-center justify-center">
                      <Clock className="h-4 w-4 text-blue-600" />
                    </div>
                    <span className="text-sm text-muted-foreground">Tasks Done</span>
                  </div>
                  <span className="text-2xl font-bold text-foreground">
                    {totalTasks > 0 ? `${completedTasks}/${totalTasks}` : "—"}
                  </span>
                </div>
              </div>
            </section>

            <section className="glass-card p-6">
              <h2 className="text-lg font-semibold text-foreground mb-4">Quick Access</h2>
              <div className="space-y-1">
                <button
                  onClick={() => navigate("/messages")}
                  className="w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground transition-colors"
                >
                  <MessageCircle className="h-4 w-4" />
                  Messages
                </button>
                <button
                  onClick={() => navigate("/deliverables")}
                  className="w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground transition-colors"
                >
                  <Upload className="h-4 w-4" />
                  Deliverables
                </button>
                <button
                  onClick={() => navigate("/calendar")}
                  className="w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground transition-colors"
                >
                  <CalendarDays className="h-4 w-4" />
                  Deadlines
                </button>
              </div>
            </section>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
