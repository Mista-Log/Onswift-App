import { useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { ProjectCard } from "@/components/dashboard/ProjectCard";
import { TeamMemberCard } from "@/components/dashboard/TeamMemberCard";
import { StatCard } from "@/components/dashboard/StatCard";
import { Button } from "@/components/ui/button";
import { Plus, Users } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { useProjects } from "@/contexts/ProjectContext";
import { useTeam } from "@/contexts/TeamContext";
import { InviteMemberModal } from "@/components/dashboard/InviteMemberModal";
import { MyTasksPanel } from "@/components/tasks/MyTasksPanel";
import { AnalyticsSection } from "@/components/dashboard/analytics/AnalyticsSection";
import { toast } from "sonner";

export default function DashboardCreator() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { projects: allProjects, deleteProject } = useProjects();
  const { teamMembers, isLoading: isLoadingTeam, removeTeamMember } = useTeam();
  const [showInviteModal, setShowInviteModal] = useState(false);

  const profilePicture = user?.profilePicture;

  const handleRemoveMember = async (memberId: string) => {
    const success = await removeTeamMember(memberId);
    if (success) {
      toast.success("Team member removed successfully");
    } else {
      toast.error("Failed to remove team member");
    }
  };

  const handleDeleteProject = async (projectId: string) => {
    try {
      await deleteProject(projectId);
      toast.success("Project deleted successfully");
    } catch (error) {
      toast.error("Failed to delete project");
    }
  };


  const projects = allProjects
    .filter((p) => p.status !== "completed")
    .sort((a, b) => {
      const pa = a.task_count ? a.completed_tasks / a.task_count : 0;
      const pb = b.task_count ? b.completed_tasks / b.task_count : 0;
      if (pb !== pa) return pb - pa;
      const da = a.due_date ? new Date(a.due_date).getTime() : Infinity;
      const db = b.due_date ? new Date(b.due_date).getTime() : Infinity;
      return da - db;
    })
    .slice(0, 3);

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
            <section className="glass-card p-4 sm:p-6 space-y-4 sm:space-y-6">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-base sm:text-lg font-semibold text-foreground truncate">
                  Active Projects
                </h2>
                <Button
                  variant="ghost"
                  size="sm"
                  className="shrink-0 text-muted-foreground hover:text-foreground"
                  onClick={() => navigate('/projects')}
                >
                  View All
                </Button>
              </div>

              {projects.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 sm:py-12 text-center gap-4">
                  <div className="flex h-14 w-14 sm:h-16 sm:w-16 items-center justify-center rounded-full bg-primary/10">
                    <Plus className="h-7 w-7 sm:h-8 sm:w-8 text-primary" />
                  </div>
                  <div>
                    <p className="text-base font-semibold text-foreground mb-1">No active projects yet</p>
                    <p className="text-sm text-muted-foreground mb-4">
                      Create your first project to get started
                    </p>
                  </div>
                  <Button
                    variant="glow"
                    className="w-full sm:w-auto gap-2"
                    onClick={() => navigate('/projects')}
                  >
                    <Plus className="h-4 w-4" />
                    Create New Project
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  {projects.map((project) => (
                    <ProjectCard
                      key={project.id}
                      id={project.id}
                      name={project.name}
                      dueDate={project.due_date}
                      status={project.status}
                      teamMembers={project.teamMembers}
                      onClick={() => navigate(`/projects/${project.id}`)}
                      showActions={true}
                      onDelete={handleDeleteProject}
                    />
                  ))}
                </div>
              )}
            </section>

            {/* My Tasks — creator's own self-assigned tasks */}
            <MyTasksPanel variant="creator" />
          </div>

          {/* Right Column - Team */}
<div className="space-y-6">
  <section className="glass-card p-4 sm:p-6 space-y-4 sm:space-y-6">
    <div className="flex items-center justify-between gap-2">
      <h2 className="text-base sm:text-lg font-semibold text-foreground truncate">Team</h2>
      {teamMembers.length > 0 && (
        <span className="shrink-0 text-xs sm:text-sm text-muted-foreground">
          {teamMembers.length} {teamMembers.length === 1 ? 'member' : 'members'}
        </span>
      )}
    </div>

    {isLoadingTeam ? (
      <div className="flex items-center justify-center py-8">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
      </div>
    ) : teamMembers.length > 0 ? (
      <div className="space-y-1 max-h-80 overflow-y-auto">
        {teamMembers.map((member) => (
          <TeamMemberCard
            key={member.id}
            id={member.id}
            name={member.name}
            role={member.role}
            avatar={member.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${member.name}`}
            showActions={true}
            onRemove={handleRemoveMember}
          />
        ))}
      </div>
    ) : (
      <div className="flex flex-col items-center justify-center py-8 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 mb-3">
          <Users className="h-6 w-6 text-primary" />
        </div>
        <p className="text-sm text-muted-foreground mb-1">No team members yet</p>
        <p className="text-xs text-muted-foreground">
          Start building your team by inviting members
        </p>
      </div>
    )}

    <Button
      className="w-full gap-2"
      variant="glow"
      onClick={() => setShowInviteModal(true)}
    >
      <Plus className="h-4 w-4" />
      Invite Member
    </Button>
  </section>
</div>
        </div>

        {/* Analytics — completion, client acquisition, talent performance */}
        <AnalyticsSection />
      </div>

      <InviteMemberModal
        open={showInviteModal}
        onOpenChange={setShowInviteModal}
        onNavigateToTalent={() => navigate('/talent')}
      />
    </MainLayout>
  );
}
