import { useState, useEffect } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { TalentStatCard } from "@/components/talent/TalentStatCard";
import { TaskCard } from "@/components/talent/TaskCard";
import { ActivityFeed } from "@/components/talent/ActivityFeed";
import { ProfileCompletionBanner } from "@/components/talent/ProfileCompletionBanner";
import { ProfileStrengthCard } from "@/components/talent/ProfileStrengthCard";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Folder, CheckSquare, Clock, Star, Trophy, Target, Calendar, Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { Link } from "react-router-dom";
import { useProjects, type Task } from "@/contexts/ProjectContext";
import { secureFetch } from "@/api/apiClient";
import { toast } from "sonner";

interface TalentTask extends Task {
  project_name?: string;
}

export default function DashboardTalent() {
  const { user } = useAuth();
  const { projects, updateTask } = useProjects();
  const [tasks, setTasks] = useState<TalentTask[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("todo");

  // Fetch tasks assigned to this talent
  useEffect(() => {
    fetchTasks();
  }, []);

  const fetchTasks = async () => {
    try {
      setIsLoading(true);
      const response = await secureFetch('/api/v2/my-tasks/');
      if (response.ok) {
        const data = await response.json();
        setTasks(data);
      }
    } catch (error) {
      console.error("Error fetching tasks:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleStatusChange = async (taskId: string, newStatus: "planning" | "in-progress" | "completed") => {
    try {
      await updateTask(taskId, { status: newStatus });
      // Update local state
      setTasks(prev => prev.map(task =>
        task.id === taskId ? { ...task, status: newStatus } : task
      ));
      toast.success("Task status updated!");
    } catch (error) {
      toast.error("Failed to update task status");
    }
  };

  // Get project name for a task
  const getProjectName = (task: TalentTask) => {
    const project = projects.find(p => p.id === task.project);
    return project?.name || "Unknown Project";
  };

  // Filter tasks based on active tab
  const filteredTasks = tasks.filter(task => {
    if (activeTab === "todo") return task.status !== "completed";
    if (activeTab === "completed") return task.status === "completed";
    return true;
  });

  // Calculate stats
  const completedTasksCount = tasks.filter(t => t.status === "completed").length;
  const pendingTasksCount = tasks.filter(t => t.status !== "completed").length;
  const activeProjectsCount = [...new Set(tasks.map(t => t.project))].length;

  // Get upcoming deadlines (tasks with deadlines, sorted by date)
  const upcomingDeadlines = tasks
    .filter(t => t.deadline && t.status !== "completed")
    .sort((a, b) => new Date(a.deadline!).getTime() - new Date(b.deadline!).getTime())
    .slice(0, 5);

  // Calculate profile completion
  const profileCompletion = user ?
    (user.full_name ? 10 : 0) +
    (user.professional_title ? 15 : 0) +
    (user.bio ? 15 : 0) +
    (user.skills?.length ? 15 : 0) +
    (user.portfolioLink ? 15 : 0) +
    (user.avatarUrl ? 10 : 0) +
    (user.hourlyRate ? 10 : 0) +
    (user.availability ? 10 : 0)
    : 0;

  const formatDeadlineDate = (date: string) => {
    const d = new Date(date);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const isUrgent = (deadline: string) => {
    const d = new Date(deadline);
    const now = new Date();
    const diffDays = Math.ceil((d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    return diffDays <= 2;
  };

  return (
    <MainLayout>
      <div className="animate-fade-in space-y-6">
        {/* Welcome Header */}
        <div>
          <h1 className="text-3xl font-bold text-foreground">
            Welcome back, {user?.full_name?.split(' ')[0] || 'there'}!
          </h1>
          <p className="text-muted-foreground mt-1">Here's what's happening with your projects today</p>
        </div>

        {/* Profile Completion Banner */}
        <ProfileCompletionBanner completionPercentage={profileCompletion} />

        {/* Quick Stats */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <TalentStatCard
            title="Active Projects"
            value={activeProjectsCount}
            icon={Folder}
          />
          <TalentStatCard
            title="Pending Tasks"
            value={pendingTasksCount}
            icon={CheckSquare}
            colorClass="text-warning"
          />
          <TalentStatCard
            title="Completed Tasks"
            value={completedTasksCount}
            icon={CheckSquare}
            colorClass="text-success"
          />
          <TalentStatCard
            title="Client Rating"
            value="4.8/5.0"
            icon={Star}
            subValue="Based on 12 reviews"
            colorClass="text-warning"
          />
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* My Tasks */}
            <section className="glass-card p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-foreground">My Tasks</h2>
                <Button variant="ghost" size="sm" asChild>
                  <Link to="/projects">View All</Link>
                </Button>
              </div>

              <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList className="mb-4">
                  <TabsTrigger value="todo">
                    To Do <span className="ml-1 text-xs">({pendingTasksCount})</span>
                  </TabsTrigger>
                  <TabsTrigger value="completed">
                    Completed <span className="ml-1 text-xs">({completedTasksCount})</span>
                  </TabsTrigger>
                </TabsList>

                <TabsContent value={activeTab} className="space-y-2">
                  {isLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    </div>
                  ) : filteredTasks.length > 0 ? (
                    filteredTasks.map(task => (
                      <TaskCard
                        key={task.id}
                        id={task.id}
                        name={task.name}
                        description={task.description}
                        deadline={task.deadline}
                        projectName={getProjectName(task)}
                        status={task.status}
                        onStatusChange={handleStatusChange}
                      />
                    ))
                  ) : (
                    <div className="text-center py-8">
                      <CheckSquare className="h-12 w-12 text-primary mx-auto mb-2" />
                      <p className="text-foreground font-medium">
                        {activeTab === "todo" ? "You're all caught up!" : "No completed tasks yet"}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {activeTab === "todo" ? "No pending tasks at the moment" : "Complete some tasks to see them here"}
                      </p>
                    </div>
                  )}
                </TabsContent>
              </Tabs>
            </section>

            {/* Recent Activity */}
            <section className="glass-card p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-foreground">Recent Activity</h2>
              </div>
              <ActivityFeed activities={[]} />
            </section>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Performance Overview */}
            <div className="grid grid-cols-2 gap-3">
              <div className="glass-card p-4 text-center">
                <Target className="h-8 w-8 text-primary mx-auto mb-2" />
                <p className="text-2xl font-bold text-foreground">{completedTasksCount * 50}</p>
                <p className="text-xs text-muted-foreground">Points Earned</p>
              </div>
              <div className="glass-card p-4 text-center">
                <CheckSquare className="h-8 w-8 text-success mx-auto mb-2" />
                <p className="text-2xl font-bold text-foreground">{completedTasksCount}</p>
                <p className="text-xs text-muted-foreground">Tasks Done</p>
              </div>
            </div>

            {/* Current Rank */}
            <div className="glass-card p-6 text-center">
              <Trophy className="h-10 w-10 text-warning mx-auto mb-2" />
              <p className="text-4xl font-bold text-foreground">#3</p>
              <p className="text-sm text-muted-foreground">Current Rank</p>
            </div>

            {/* Profile Strength */}
            <ProfileStrengthCard
              percentage={profileCompletion}
              tips={[
                { text: "Add profile photo", completed: !!user?.avatarUrl },
                { text: "Upload portfolio samples", completed: !!user?.portfolioLink },
                { text: "Get 3+ client reviews", completed: false },
                { text: "Complete your bio", completed: !!user?.bio },
              ]}
            />

            {/* Upcoming Deadlines */}
            <section className="glass-card p-6">
              <div className="flex items-center gap-2 mb-4">
                <Calendar className="h-5 w-5 text-primary" />
                <h3 className="font-semibold text-foreground">Upcoming Deadlines</h3>
              </div>
              <div className="space-y-3">
                {upcomingDeadlines.length > 0 ? (
                  upcomingDeadlines.map(task => (
                    <div key={task.id} className="flex items-center gap-3">
                      <div className="flex-shrink-0 w-12 h-12 rounded-lg bg-secondary flex items-center justify-center">
                        <span className="text-xs font-medium text-foreground">
                          {formatDeadlineDate(task.deadline!)}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{task.name}</p>
                        <p className="text-xs text-muted-foreground">{getProjectName(task)}</p>
                      </div>
                      {isUrgent(task.deadline!) && (
                        <span className="text-xs px-2 py-1 rounded bg-destructive/20 text-destructive">Urgent</span>
                      )}
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No upcoming deadlines
                  </p>
                )}
              </div>
            </section>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
