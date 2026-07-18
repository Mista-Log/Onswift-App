import { useState, useEffect } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { TalentStatCard } from "@/components/talent/TalentStatCard";
import { ActivityFeed } from "@/components/talent/ActivityFeed";
import { ProfileCompletionBanner } from "@/components/talent/ProfileCompletionBanner";
import { DeadlineCountdown } from "@/components/talent/DeadlineCountdown";
import { MyTasksPanel } from "@/components/tasks/MyTasksPanel";
import { Folder, CheckSquare, Calendar } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
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

        // Auto-start recently assigned tasks for the logged-in talent
        if (user && data && Array.isArray(data)) {
          const now = Date.now();
          const RECENT_MS = 5 * 60 * 1000; // 5 minutes

          data.forEach((task: any) => {
            try {
              if (
                task.status === "planning" &&
                task.assignees?.includes(user.id) &&
                task.created_at &&
                now - new Date(task.created_at).getTime() <= RECENT_MS
              ) {
                // update remotely and locally
                updateTask(task.id, { status: "in-progress" })
                  .then(() => {
                    setTasks((prev) =>
                      prev.map((t) => (t.id === task.id ? { ...t, status: "in-progress" } : t))
                    );
                    toast.success("New task started");
                  })
                  .catch((err) => {
                    console.error("Failed to auto-start newly assigned task:", err);
                  });
              }
            } catch (err) {
              console.error("Error auto-starting task:", err);
            }
          });
        }
      }
    } catch (error) {
      console.error("Error fetching tasks:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // Get project name for a task
  const getProjectName = (task: TalentTask) => {
    const project = projects.find(p => p.id === task.project);
    return project?.name || "Unknown Project";
  };

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
      <div className="animate-fade-in space-y-6 sm:space-y-8">
        {/* Welcome Header */}
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground leading-tight">
            Welcome back, {user?.full_name?.split(' ')[0] || 'there'}!
          </h1>
          <p className="text-muted-foreground mt-1">Here's what's happening with your projects today</p>
        </div>

        {/* Profile Completion Banner */}
        <ProfileCompletionBanner completionPercentage={profileCompletion} />

        {/* Quick Stats */}
        <div className="grid grid-cols-2 gap-5 sm:gap-6 lg:grid-cols-4">
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
          {/* <TalentStatCard
            title="Client Rating"
            value="4.8/5.0"
            icon={Target}
            subValue="Based on 12 reviews"
            colorClass="text-warning"
          /> */}
        </div>

        <div className="grid gap-6 sm:gap-8 lg:grid-cols-3">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* My Tasks — shared with the creator dashboard */}
            <MyTasksPanel variant="talent" />

            {/* Recent Activity */}
            <section className="glass-card p-5 sm:p-6 md:p-7">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-foreground">Recent Activity</h2>
              </div>
              <ActivityFeed activities={[]} />
            </section>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Performance Overview */}
            {/* <div className="grid grid-cols-2 gap-3">
              <div className="glass-card p-5 text-center">
                <Target className="h-8 w-8 text-primary mx-auto mb-2" />
                <p className="text-2xl font-bold text-foreground">{completedTasksCount * 50}</p>
                <p className="text-xs text-muted-foreground">Points Earned</p>
              </div>
              <div className="glass-card p-5 text-center">
                <CheckSquare className="h-8 w-8 text-success mx-auto mb-2" />
                <p className="text-2xl font-bold text-foreground">{completedTasksCount}</p>
                <p className="text-xs text-muted-foreground">Tasks Done</p>
              </div>
            </div> */}

            {/* Current Rank */}
            {/* <div className="glass-card p-5 sm:p-6 md:p-7 text-center">
              <Trophy className="h-10 w-10 text-warning mx-auto mb-2" />
              <p className="text-4xl font-bold text-foreground">#3</p>
              <p className="text-sm text-muted-foreground">Current Rank</p>
            </div> */}

            {/* Countdown to the next task deadline */}
            <DeadlineCountdown tasks={tasks} />

            {/* Upcoming Deadlines */}
            <section className="glass-card p-5 sm:p-6 md:p-7">
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
