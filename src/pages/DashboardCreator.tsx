
import { MainLayout } from "@/components/layout/MainLayout";
import { ProjectCard } from "@/components/dashboard/ProjectCard";
import { TeamMemberCard } from "@/components/dashboard/TeamMemberCard";
import { StatCard } from "@/components/dashboard/StatCard";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { useProjects } from "@/contexts/ProjectContext";

const teamMembers = [
  { id: "1", name: "Alia Vance", role: "Manager", avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Alia" },
  { id: "2", name: "Ben Carter", role: "Video Editor", avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Ben" },
  { id: "3", name: "Clara Dane", role: "Illustrator", avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Clara" },
];

const creatorStats = [
  
  { title: "Active Collabs", value: "8", change: 2.1 }
  
];

export default function DashboardCreator() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { projects: allProjects } = useProjects();

  // Show only the first 3 projects
  const projects = allProjects.slice(0, 3);

  return (
    <MainLayout>
      <div className="animate-fade-in space-y-8">
        {/* Welcome Header */}
        <div>
          <h1 className="text-3xl font-bold text-foreground">
            Welcome back, {user?.full_name?.split(' ')[0] || 'there'}!
          </h1>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Left Column - Projects & Stats */}
          <div className="space-y-6 lg:col-span-2">
            {/* Active Projects */}
            <section className="glass-card p-6">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-lg font-semibold text-foreground">Active Projects</h2>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-muted-foreground hover:text-foreground"
                  onClick={() => navigate('/projects')}
                >
                  View All
                </Button>
              </div>

              <div className="space-y-3">
                {projects.map((project) => (
                  <ProjectCard
                    key={project.id}
                    name={project.name}
                    dueDate={project.dueDate}
                    status={project.status}
                    teamMembers={project.teamMembers}
                  />
                ))}
              </div>
            </section>

            {/* Stats */}
            <div className="grid gap-4 sm:grid-cols-3">
              {creatorStats.map((stat) => (
                <StatCard
                  key={stat.title}
                  title={stat.title}
                  value={stat.value}
                  change={stat.change}
                />
              ))}
            </div>
          </div>

          {/* Right Column - Team */}
          <div className="space-y-6">
            <section className="glass-card p-6">
              <div className="mb-4">
                <h2 className="text-lg font-semibold text-foreground">Team</h2>
              </div>

              <div className="space-y-1">
                {teamMembers.map((member) => (
                  <TeamMemberCard
                    key={member.id}
                    name={member.name}
                    role={member.role}
                    avatar={member.avatar}
                  />
                ))}
              </div>

              <Button
                className="mt-4 w-full gap-2"
                variant="glow"
                onClick={() => navigate('/talent')}
              >
                <Plus className="h-4 w-4" />
                Invite Member
              </Button>
            </section>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
