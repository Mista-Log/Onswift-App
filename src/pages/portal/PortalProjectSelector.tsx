/**
 * PortalProjectSelector — Lists all projects the client has access to.
 * Each project card links to its dedicated portal dashboard.
 */
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { secureFetch } from "@/api/apiClient";
import { toast } from "sonner";
import { PortalLayout } from "@/components/portal/PortalLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Folder, ArrowRight, Loader2 } from "lucide-react";
import type { PortalProject } from "@/types/portal";
import { format } from "date-fns";

export default function PortalProjectSelector() {
  const navigate = useNavigate();
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
        const normalizedProjects = Array.isArray(data)
          ? data
          : Array.isArray(data?.results)
          ? data.results
          : [];
        setProjects(normalizedProjects);
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

  if (loading) {
    return (
      <PortalLayout>
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </PortalLayout>
    );
  }

  return (
    <PortalLayout>
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold">Your Projects</h1>
          <p className="text-muted-foreground mt-1">
            View progress, deliverables, and communicate with your creator.
          </p>
        </div>

        {projects.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Folder className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-1">No Projects Yet</h3>
              <p className="text-muted-foreground">
                You'll see your projects here once your creator assigns one.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {projects.map((project) => (
              <Card
                key={project.id}
                className="cursor-pointer transition-shadow hover:shadow-md group"
                onClick={() => navigate(`/portal/${project.id}`)}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <CardTitle className="text-lg">{project.title}</CardTitle>
                    <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                  </div>
                  <CardDescription className="line-clamp-2">
                    {project.description || "No description"}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Badge variant="outline" className={getStatusColor(project.status)}>
                      {project.status.replace("_", " ")}
                    </Badge>
                    <span className="text-sm text-muted-foreground">
                      by {project.creator_name}
                    </span>
                  </div>

                  {/* Progress bar */}
                  <div>
                    <div className="flex justify-between text-xs text-muted-foreground mb-1">
                      <span>Progress</span>
                      <span>{project.task_progress}%</span>
                    </div>
                    <div className="h-2 bg-secondary rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary rounded-full transition-all"
                        style={{ width: `${project.task_progress}%` }}
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>
                      {project.total_tasks} task{project.total_tasks !== 1 ? "s" : ""} ·{" "}
                      {project.completed_tasks} done
                    </span>
                    {project.deadline && (
                      <span>Due {format(new Date(project.deadline), "MMM d, yyyy")}</span>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </PortalLayout>
  );
}
