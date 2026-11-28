import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
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
  ChevronRight,
  Download,
  FileText,
  Loader2,
  MessageCircle,
  MessageSquareText,
} from "lucide-react";
import { format } from "date-fns";
import { useAuth } from "@/contexts/AuthContext";
import { TaskDetailModal } from "@/components/project/TaskDetailModal";
import { ProfileView, type ProfileData } from "@/components/profile/ProfileView";
import { ClientTour } from "@/components/client/ClientTour";
import type { PortalProject, PortalTask, PortalDeliverable, PortalMessage } from "@/types/portal";

interface ProjectDetail extends PortalProject {
  tasks: PortalTask[];
  deliverables: PortalDeliverable[];
  recent_messages: PortalMessage[];
}

const TAB_CLASS =
  "min-w-0 px-2 text-xs sm:px-3 sm:text-sm data-[state=active]:bg-primary data-[state=active]:text-white data-[state=inactive]:bg-white data-[state=inactive]:text-primary";

export default function ClientProjectDetail() {
  // The route is /projects/:id (shared with the creator page); older links used :projectId.
  const params = useParams<{ id?: string; projectId?: string }>();
  const projectId = params.id ?? params.projectId;
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuth();
  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [openTaskId, setOpenTaskId] = useState<string | null>(null);
  const [tab, setTab] = useState("tasks");
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [profileState, setProfileState] = useState<"idle" | "loading" | "ready" | "missing">("idle");

  const loadProject = useCallback(async () => {
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
  }, [projectId, navigate]);

  useEffect(() => {
    loadProject();
  }, [loadProject]);

  // Notification links open a task directly: /projects/<id>?task=<taskId>
  useEffect(() => {
    const fromLink = searchParams.get("task");
    if (fromLink) setOpenTaskId(fromLink);
  }, [searchParams]);

  // The creator's profile loads the first time the Portfolio tab is opened.
  useEffect(() => {
    if (tab !== "portfolio" || profileState !== "idle") return;
    setProfileState("loading");
    secureFetch(`/api/v5/projects/${projectId}/creator-profile/`)
      .then(async (res) => {
        if (!res.ok) throw new Error();
        setProfile(await res.json());
        setProfileState("ready");
      })
      .catch(() => setProfileState("missing"));
  }, [tab, profileState, projectId]);

  const closeTask = (open: boolean) => {
    if (open) return;
    setOpenTaskId(null);
    if (searchParams.has("task")) {
      searchParams.delete("task");
      setSearchParams(searchParams, { replace: true });
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
  const creatorFirstName = (project.creator_name || "your creator").split(" ")[0];

  return (
    <MainLayout>
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        {/* On phones the actions drop to their own row, so the title keeps the full width. */}
        <div className="mb-6 flex flex-wrap items-start gap-x-3 gap-y-3 sm:flex-nowrap sm:gap-x-4" data-tour="project-header">
          <Button variant="ghost" size="icon" className="shrink-0" onClick={() => navigate("/projects")} aria-label="Back to your projects">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1 min-w-0">
            <h1 className="break-words text-xl font-bold sm:text-2xl">{project.name}</h1>
            {project.description && (
              <p className="text-muted-foreground mt-1 line-clamp-2">{project.description}</p>
            )}
            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
              <Badge className="capitalize">
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
          <div className="flex w-full items-center justify-between gap-2 sm:w-auto sm:flex-col sm:items-end">
            <Button className="flex-1 sm:flex-none" onClick={() => navigate(`/projects/${projectId}/messages`)} data-tour="chat">
              <MessageCircle className="h-4 w-4 mr-2" />
              Messages
            </Button>
            <ClientTour variant="link" hasPortfolio={!!project.creator_profile_available} />
          </div>
        </div>

        {/* Progress */}
        <Card className="mb-6" data-tour="progress">
          <CardContent className="p-4 sm:p-6">
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
              {project.completed_tasks} of {project.total_tasks} tasks completed and approved for you
            </p>
          </CardContent>
        </Card>

        {/* Tabs */}
        <Tabs value={tab} onValueChange={setTab}>
          {/* Full-width equal tabs on phones, with shorter labels; counts show from sm up. */}
          <TabsList
            className={`grid h-auto w-full bg-primary/10 p-1 sm:inline-flex sm:w-auto ${
              project.creator_profile_available ? "grid-cols-3" : "grid-cols-2"
            }`}
          >
            <TabsTrigger value="tasks" className={TAB_CLASS} data-tour="tasks">
              <span className="sm:hidden">Work</span>
              <span className="hidden sm:inline">Completed work ({project.tasks?.length || 0})</span>
            </TabsTrigger>
            <TabsTrigger value="deliverables" className={TAB_CLASS} data-tour="deliverables">
              <span className="sm:hidden">Deliverables</span>
              <span className="hidden sm:inline">Deliverables ({allDeliverables.length})</span>
            </TabsTrigger>
            {project.creator_profile_available && (
              <TabsTrigger value="portfolio" className={TAB_CLASS} data-tour="portfolio">
                Portfolio
              </TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="tasks" className="mt-4">
            {!project.tasks?.length ? (
              <Card>
                <CardContent className="py-10 text-center">
                  <CheckCircle2 className="mx-auto mb-3 h-8 w-8 text-muted-foreground/60" />
                  <p className="font-medium">No completed work shared yet</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    When {creatorFirstName} finishes and approves a task, it shows up here for you to review.
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-2">
                {project.tasks.map((task, i) => (
                  <Card
                    key={task.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => setOpenTaskId(task.id)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        setOpenTaskId(task.id);
                      }
                    }}
                    className="cursor-pointer transition-colors hover:border-primary/40 hover:bg-primary/5"
                    data-tour={i === 0 ? "first-task" : undefined}
                  >
                    <CardContent className="flex items-center gap-3 px-4 py-3 sm:px-6">
                      <CheckCircle2 className="h-4 w-4 shrink-0 text-green-500" />
                      <div className="flex-1 min-w-0">
                        <p className="line-clamp-2 break-words font-medium leading-snug">{task.name}</p>
                        {task.description && (
                          <p className="text-xs text-muted-foreground line-clamp-1">{task.description}</p>
                        )}
                        {(task.deliverables?.length ?? 0) > 0 && (
                          <p className="text-xs text-muted-foreground">
                            {task.deliverables.length} deliverable{task.deliverables.length !== 1 ? "s" : ""}
                          </p>
                        )}
                      </div>
                      <span className="hidden sm:inline-flex items-center gap-1 text-xs text-muted-foreground">
                        <MessageSquareText className="h-3.5 w-3.5" />
                        Give feedback
                      </span>
                      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
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
                    <CardContent className="flex items-start gap-3 px-4 py-3 sm:items-center sm:px-6">
                      <FileText className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="line-clamp-2 break-words font-medium leading-snug">{deliverable.title}</p>
                        {deliverable.description && (
                          <p className="text-xs text-muted-foreground line-clamp-1">{deliverable.description}</p>
                        )}
                        <p className="text-xs text-muted-foreground mt-1">
                          {deliverable.files?.length || 0} file{(deliverable.files?.length || 0) !== 1 ? "s" : ""} ·{" "}
                          <span className="break-words">Submitted by {deliverable.submitted_by_name}</span>
                        </p>
                      </div>
                      <Badge variant="outline" className="capitalize flex-shrink-0">
                        {deliverable.status.replace("_", " ")}
                      </Badge>
                    </CardContent>
                    {deliverable.files && deliverable.files.length > 0 && (
                      <CardContent className="border-t px-4 py-2 sm:px-6">
                        <div className="space-y-1">
                          {deliverable.files.map((file) => (
                            <a
                              key={file.id}
                              href={file.file}
                              download
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex min-w-0 items-center gap-1 text-xs text-primary hover:underline"
                            >
                              <Download className="h-3 w-3 shrink-0" />
                              <span className="truncate">{file.name}</span>
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

          {project.creator_profile_available && (
            <TabsContent value="portfolio" className="mt-4">
              {profileState === "ready" && profile ? (
                <div className="space-y-4">
                  <ProfileView profile={profile} layout="wide" />
                  <Card className="border-primary/30 bg-primary/5">
                    <CardContent className="flex flex-col items-stretch gap-3 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-6">
                      <div>
                        <p className="font-semibold">Like what you see?</p>
                        <p className="text-sm text-muted-foreground">
                          Talk to {creatorFirstName} about what else you'd like to work on together.
                        </p>
                      </div>
                      <Button onClick={() => navigate(`/projects/${projectId}/messages`)}>
                        <MessageCircle className="h-4 w-4 mr-2" />
                        Work with {creatorFirstName} on more
                      </Button>
                    </CardContent>
                  </Card>
                </div>
              ) : profileState === "missing" ? (
                <Card>
                  <CardContent className="py-8 text-center text-muted-foreground">
                    This portfolio isn't available right now.
                  </CardContent>
                </Card>
              ) : (
                <div className="flex justify-center py-12">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              )}
            </TabsContent>
          )}
        </Tabs>
      </div>

      {/* The same task view creators use, read-only apart from the feedback thread. */}
      <TaskDetailModal
        taskId={openTaskId}
        open={!!openTaskId}
        onOpenChange={closeTask}
        availableAssignees={[]}
        currentUserId={user?.id ?? ""}
        isCreator={false}
        isClient
      />

      <ClientTour variant="auto" hasPortfolio={!!project.creator_profile_available} />
    </MainLayout>
  );
}
