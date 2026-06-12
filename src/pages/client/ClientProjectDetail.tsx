import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { secureFetch } from "@/api/apiClient";
import { toast } from "sonner";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ArrowLeft,
  CheckCircle2,
  Circle,
  Clock,
  Download,
  FileText,
  Loader2,
  MessageCircle,
} from "lucide-react";
import { format } from "date-fns";
import type { PortalProject, PortalTask, PortalDeliverable, PortalMessage } from "@/types/portal";

interface ProjectDetail extends PortalProject {
  tasks: PortalTask[];
  deliverables: PortalDeliverable[];
  recent_messages: PortalMessage[];
}

export default function ClientProjectDetail() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadProject();
  }, [projectId]);

  const loadProject = async () => {
    try {
      const response = await secureFetch(`/api/v5/projects/${projectId}/`);
      if (response.ok) {
        const data = await response.json();
        setProject(data.project || data);
      } else if (response.status === 403) {
        toast.error("You don't have access to this project");
        navigate("/projects");
      } else {
        toast.error("Failed to load project");
        navigate("/projects");
      }
    } catch {
      toast.error("Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  const getTaskIcon = (status: string) => {
    switch (status) {
      case "done": return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case "in_progress": return <Clock className="h-4 w-4 text-blue-500" />;
      default: return <Circle className="h-4 w-4 text-muted-foreground" />;
    }
  };

  if (loading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </MainLayout>
    );
  }

  if (!project) return null;

  const allDeliverables = project.tasks?.flatMap((t) => t.deliverables || []) || [];

  return (
    <MainLayout>
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex items-start gap-4 mb-6">
          <Button variant="ghost" size="icon" onClick={() => navigate("/projects")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-bold truncate">{project.name}</h1>
            {project.description && (
              <p className="text-muted-foreground mt-1 line-clamp-2">{project.description}</p>
            )}
            <div className="flex items-center gap-3 mt-2">
              <Badge variant="outline" className="capitalize">
                {project.status.replace("_", " ")}
              </Badge>
              {project.due_date && (
                <span className="text-sm text-muted-foreground">
                  Due {format(new Date(project.due_date), "MMM d, yyyy")}
                </span>
              )}
              <span className="text-sm text-muted-foreground">by {project.creator_name}</span>
            </div>
          </div>
          <Button onClick={() => navigate(`/projects/${projectId}/messages`)}>
            <MessageCircle className="h-4 w-4 mr-2" />
            Messages
          </Button>
        </div>

        {/* Progress */}
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="flex justify-between text-sm mb-2">
              <span className="font-medium">Overall Progress</span>
              <span className="text-muted-foreground">{project.progress}%</span>
            </div>
            <div className="h-3 bg-secondary rounded-full overflow-hidden">
              <div
                className="h-full bg-primary rounded-full transition-all"
                style={{ width: `${project.progress}%` }}
              />
            </div>
            <p className="mt-3 text-sm text-muted-foreground">
              {project.completed_tasks} of {project.total_tasks} tasks done
            </p>
          </CardContent>
        </Card>

        {/* Tabs */}
        <Tabs defaultValue="tasks">
          <TabsList className="bg-primary/10 p-1">
            <TabsTrigger
              value="tasks"
              className="data-[state=active]:bg-primary data-[state=active]:text-white data-[state=inactive]:bg-white data-[state=inactive]:text-primary"
            >
              Tasks ({project.tasks?.length || 0})
            </TabsTrigger>
            <TabsTrigger
              value="deliverables"
              className="data-[state=active]:bg-primary data-[state=active]:text-white data-[state=inactive]:bg-white data-[state=inactive]:text-primary"
            >
              Deliverables ({allDeliverables.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="tasks" className="mt-4">
            {!project.tasks?.length ? (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground">No tasks yet</CardContent>
              </Card>
            ) : (
              <div className="space-y-2">
                {project.tasks.map((task) => (
                  <Card key={task.id}>
                    <CardContent className="py-3 flex items-center gap-3">
                      {getTaskIcon(task.status)}
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{task.name}</p>
                        {task.description && (
                          <p className="text-xs text-muted-foreground line-clamp-1">{task.description}</p>
                        )}
                        {task.due_date && (
                          <p className="text-xs text-muted-foreground">
                            Due {format(new Date(task.due_date), "MMM d")}
                          </p>
                        )}
                      </div>
                      <Badge variant="outline" className="capitalize">
                        {task.status.replace("_", " ")}
                      </Badge>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="deliverables" className="mt-4">
            {!allDeliverables.length ? (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground">No deliverables yet</CardContent>
              </Card>
            ) : (
              <div className="space-y-2">
                {allDeliverables.map((deliverable) => (
                  <Card key={deliverable.id}>
                    <CardContent className="py-3 flex items-center gap-3">
                      <FileText className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{deliverable.title}</p>
                        {deliverable.description && (
                          <p className="text-xs text-muted-foreground line-clamp-1">{deliverable.description}</p>
                        )}
                        <p className="text-xs text-muted-foreground mt-1">
                          {deliverable.files?.length || 0} file{(deliverable.files?.length || 0) !== 1 ? "s" : ""} ·
                          Submitted by {deliverable.submitted_by_name}
                        </p>
                      </div>
                      <Badge variant="outline" className="capitalize flex-shrink-0">
                        {deliverable.status.replace("_", " ")}
                      </Badge>
                    </CardContent>
                    {deliverable.files && deliverable.files.length > 0 && (
                      <CardContent className="py-2 border-t">
                        <div className="space-y-1">
                          {deliverable.files.map((file) => (
                            <a
                              key={file.id}
                              href={file.file}
                              download
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-primary hover:underline flex items-center gap-1"
                            >
                              <Download className="h-3 w-3" />
                              {file.name}
                            </a>
                          ))}
                        </div>
                      </CardContent>
                    )}
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </MainLayout>
  );
}
