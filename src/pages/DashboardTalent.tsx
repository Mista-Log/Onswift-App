import { useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { TalentStatCard } from "@/components/talent/TalentStatCard";
import { TaskCard } from "@/components/talent/TaskCard";
import { ActivityFeed } from "@/components/talent/ActivityFeed";
import { ProfileCompletionBanner } from "@/components/talent/ProfileCompletionBanner";
import { ProfileStrengthCard } from "@/components/talent/ProfileStrengthCard";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Folder, CheckSquare, DollarSign, Star, Trophy, Target, Calendar } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { Link } from "react-router-dom";
import { useProjects } from "@/contexts/ProjectContext";

const talentTasks = [
  { id: "1", name: "Design hero section mockups", dueDate: "Due: Tomorrow", projectName: "Brand Collab", points: 75, completed: false },
  { id: "2", name: "Create icon set for mobile app", dueDate: "Due: In 3 days", projectName: "Mobile App", points: 50, completed: false },
  { id: "3", name: "Review and iterate on logo design", dueDate: "Due: In 5 days", projectName: "Brand Identity", points: 40, completed: false },
  { id: "4", name: "Prepare presentation slides", dueDate: "Due: Next week", projectName: "Client Pitch", points: 60, completed: false },
];

const talentActivities = [
  { id: "1", type: "upload" as const, message: "You submitted a deliverable for Brand Collab", timestamp: "2 hours ago" },
  { id: "2", type: "approval" as const, message: "Alex Creator approved your work on Logo Design", timestamp: "5 hours ago" },
  { id: "3", type: "task" as const, message: "New task assigned: Create homepage wireframes", timestamp: "Yesterday" },
  { id: "4", type: "message" as const, message: "Jordan Smith sent you a message", timestamp: "2 days ago" },
];

const deadlines = [
  { id: "1", date: "Dec 12", taskName: "Hero Section Design", projectName: "Brand Collab", urgent: true },
  { id: "2", date: "Dec 15", taskName: "Icon Set Delivery", projectName: "Mobile App", urgent: false },
  { id: "3", date: "Dec 18", taskName: "Final Logo Files", projectName: "Brand Identity", urgent: false },
];

export default function DashboardTalent() {
  const { user } = useAuth();
  // const { projects } = useProjects(); // TODO: In a real app, this would filter for projects assigned to this talent
  const [tasks, setTasks] = useState(talentTasks);
  const [activeTab, setActiveTab] = useState("todo");

  const handleToggleTask = (taskId: string) => {
    setTasks(prev => prev.map(task =>
      task.id === taskId ? { ...task, completed: !task.completed } : task
    ));
  };

  const filteredTasks = tasks.filter(task => {
    if (activeTab === "todo") return !task.completed;
    if (activeTab === "completed") return task.completed;
    return true;
  });

  // Calculate profile completion
  const profileCompletion = user ?
    (user.name ? 10 : 0) +
    (user.professionalTitle ? 15 : 0) +
    (user.bio ? 15 : 0) +
    (user.skills?.length ? 15 : 0) +
    (user.portfolioLink ? 15 : 0) +
    (user.avatarUrl ? 10 : 0) +
    (user.hourlyRate ? 10 : 0) +
    (user.availability ? 10 : 0)
    : 0;

  return (
    <MainLayout>
      <div className="animate-fade-in space-y-6">
        {/* Welcome Header */}
        <div>
          <h1 className="text-3xl font-bold text-foreground">
            Welcome back, {user?.name?.split(' ')[0] || 'there'}!
          </h1>
          <p className="text-muted-foreground mt-1">Here's what's happening with your projects today</p>
        </div>

        {/* Profile Completion Banner */}
        <ProfileCompletionBanner completionPercentage={profileCompletion} />

        {/* Quick Stats */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <TalentStatCard
            title="Active Projects"
            value={3}
            icon={Folder}
            trend={{ value: "12% from last month", positive: true }}
          />
          <TalentStatCard
            title="Pending Tasks"
            value={tasks.filter(t => !t.completed).length}
            icon={CheckSquare}
            colorClass="text-warning"
          />
          <TalentStatCard
            title="Earnings This Month"
            value="$2,450"
            icon={DollarSign}
            trend={{ value: "$250 from last month", positive: true }}
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
                    To Do <span className="ml-1 text-xs">({tasks.filter(t => !t.completed).length})</span>
                  </TabsTrigger>
                  <TabsTrigger value="completed">
                    Completed <span className="ml-1 text-xs">({tasks.filter(t => t.completed).length})</span>
                  </TabsTrigger>
                </TabsList>

                <TabsContent value={activeTab} className="space-y-2">
                  {filteredTasks.length > 0 ? (
                    filteredTasks.map(task => (
                      <TaskCard
                        key={task.id}
                        {...task}
                        onToggleComplete={handleToggleTask}
                      />
                    ))
                  ) : (
                    <div className="text-center py-8">
                      <CheckSquare className="h-12 w-12 text-primary mx-auto mb-2" />
                      <p className="text-foreground font-medium">You're all caught up!</p>
                      <p className="text-sm text-muted-foreground">No pending tasks at the moment</p>
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
              <ActivityFeed activities={talentActivities} />
            </section>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Performance Overview */}
            <div className="grid grid-cols-2 gap-3">
              <div className="glass-card p-4 text-center">
                <Target className="h-8 w-8 text-primary mx-auto mb-2" />
                <p className="text-2xl font-bold text-foreground">1,250</p>
                <p className="text-xs text-muted-foreground">Points Earned</p>
              </div>
              <div className="glass-card p-4 text-center">
                <CheckSquare className="h-8 w-8 text-success mx-auto mb-2" />
                <p className="text-2xl font-bold text-foreground">18</p>
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
                {deadlines.map(deadline => (
                  <div key={deadline.id} className="flex items-center gap-3">
                    <div className="flex-shrink-0 w-12 h-12 rounded-lg bg-secondary flex items-center justify-center">
                      <span className="text-xs font-medium text-foreground">{deadline.date}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{deadline.taskName}</p>
                      <p className="text-xs text-muted-foreground">{deadline.projectName}</p>
                    </div>
                    {deadline.urgent && (
                      <span className="text-xs px-2 py-1 rounded bg-destructive/20 text-destructive">Urgent</span>
                    )}
                  </div>
                ))}
              </div>
            </section>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
