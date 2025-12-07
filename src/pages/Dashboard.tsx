import { MainLayout } from "@/components/layout/MainLayout";
import { ProjectCard } from "@/components/dashboard/ProjectCard";
import { TeamMemberCard } from "@/components/dashboard/TeamMemberCard";
import { StatCard } from "@/components/dashboard/StatCard";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

// Mock data
const projects = [
  {
    id: "1",
    name: 'Brand Collab - "Future Funk"',
    dueDate: "24 Oct 2023",
    status: "in-progress" as const,
    teamMembers: [
      { id: "1", name: "Alia Vance", avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Alia" },
      { id: "2", name: "Ben Carter", avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Ben" },
      { id: "3", name: "Clara Dane", avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Clara" },
      { id: "4", name: "David Lee", avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=David" },
    ],
  },
  {
    id: "2",
    name: '"Cyber Dreams" EP Visuals',
    dueDate: "15 Nov 2023",
    status: "planning" as const,
    teamMembers: [
      { id: "1", name: "Alia Vance", avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Alia" },
      { id: "2", name: "Ben Carter", avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Ben" },
    ],
  },
  {
    id: "3",
    name: "V-Tuber Model 2.0",
    dueDate: "02 Oct 2023",
    status: "completed" as const,
    teamMembers: [
      { id: "1", name: "Alia Vance", avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Alia" },
    ],
  },
];

const teamMembers = [
  { id: "1", name: "Alia Vance", role: "Manager", avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Alia" },
  { id: "2", name: "Ben Carter", role: "Video Editor", avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Ben" },
  { id: "3", name: "Clara Dane", role: "Illustrator", avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Clara" },
];

const stats = [
  { title: "Total Earnings", value: "$12,850", change: 12.5 },
  { title: "Active Collabs", value: "8", change: 2.1 },
  { title: "Audience Growth", value: "24.1K", change: 8.3 },
];

export default function Dashboard() {
  return (
    <MainLayout>
      <div className="animate-fade-in space-y-8">
        {/* Welcome Header */}
        <div>
          <h1 className="text-3xl font-bold text-foreground">
            Welcome back, Alex!
          </h1>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Left Column - Projects & Stats */}
          <div className="space-y-6 lg:col-span-2">
            {/* Active Projects */}
            <section className="glass-card p-6">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-lg font-semibold text-foreground">Active Projects</h2>
                <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground">
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
              {stats.map((stat) => (
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

              <Button className="mt-4 w-full gap-2" variant="glow">
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
