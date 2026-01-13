import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { MainLayout } from "@/components/layout/MainLayout";
import { useAuth } from "@/contexts/AuthContext";
import { useTeam } from "@/contexts/TeamContext";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Users,
  MessageSquare,
  MoreVertical,
  UserMinus,
  Search,
  Plus,
  Loader2,
  Mail
} from "lucide-react";
import { toast } from "sonner";
import { InviteMemberModal } from "@/components/dashboard/InviteMemberModal";
import { secureFetch } from "@/api/apiClient";

export default function Team() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { teamMembers, isLoading, removeTeamMember, fetchTeam } = useTeam();
  const [searchQuery, setSearchQuery] = useState("");
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [memberToRemove, setMemberToRemove] = useState<{ id: string; name: string } | null>(null);

  // Redirect talent users to dashboard
  useEffect(() => {
    if (user?.role === 'talent') {
      toast.error("This page is only accessible to creators");
      navigate('/dashboard');
    }
  }, [user, navigate]);

  const handleRemoveMember = async () => {
    if (!memberToRemove) return;

    const success = await removeTeamMember(memberToRemove.id);
    if (success) {
      toast.success(`${memberToRemove.name} has been removed from your team`);
    } else {
      toast.error("Failed to remove team member");
    }
    setMemberToRemove(null);
  };

  const handleStartConversation = async (userId: string) => {
    try {
      // Start or get existing conversation
      const response = await secureFetch('/api/v2/conversations/start/', {
        method: "POST",
        body: JSON.stringify({ user_id: userId }),
      });

      if (response.ok) {
        // Navigate to messages page
        navigate('/messages');
      } else {
        toast.error("Failed to start conversation");
      }
    } catch (error) {
      console.error("Error starting conversation:", error);
      toast.error("Failed to start conversation");
    }
  };

  const filteredMembers = teamMembers.filter(member =>
    member.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    member.role?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    member.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <MainLayout>
      <div className="animate-fade-in space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">My Team</h1>
            <p className="mt-1 text-muted-foreground">
              Manage your team members and communicate with them
            </p>
          </div>
          <Button onClick={() => setShowInviteModal(true)} className="gap-2">
            <Plus className="h-4 w-4" />
            Invite Member
          </Button>
        </div>

        {/* Search */}
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search team members..."
            className="pl-10"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        {/* Team Stats */}
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="glass-card p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                <Users className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{teamMembers.length}</p>
                <p className="text-sm text-muted-foreground">Team Members</p>
              </div>
            </div>
          </div>
        </div>

        {/* Team Members Grid */}
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : filteredMembers.length > 0 ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filteredMembers.map((member) => (
              <div
                key={member.id}
                className="glass-card p-4 group hover:border-primary/50 transition-colors"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-12 w-12">
                      <AvatarImage
                        src={member.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${member.name}`}
                        alt={member.name}
                      />
                      <AvatarFallback className="bg-primary/20 text-primary">
                        {member.name.charAt(0)}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-medium text-foreground">{member.name}</p>
                      <p className="text-sm text-muted-foreground">{member.role || "Talent"}</p>
                    </div>
                  </div>

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => handleStartConversation(member.user_id)}>
                        <MessageSquare className="h-4 w-4 mr-2" />
                        Send Message
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => setMemberToRemove({ id: member.id, name: member.name })}
                        className="text-destructive focus:text-destructive"
                      >
                        <UserMinus className="h-4 w-4 mr-2" />
                        Remove from Team
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
                  <Mail className="h-4 w-4" />
                  <span className="truncate">{member.email}</span>
                </div>

                {member.skills && member.skills.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {member.skills.slice(0, 3).map((skill, index) => (
                      <span
                        key={index}
                        className="px-2 py-1 text-xs rounded-full bg-secondary text-muted-foreground"
                      >
                        {skill}
                      </span>
                    ))}
                    {member.skills.length > 3 && (
                      <span className="px-2 py-1 text-xs rounded-full bg-secondary text-muted-foreground">
                        +{member.skills.length - 3}
                      </span>
                    )}
                  </div>
                )}

                <div className="flex gap-2 mt-4 pt-4 border-t border-border/50">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 gap-2"
                    onClick={() => handleStartConversation(member.user_id)}
                  >
                    <MessageSquare className="h-4 w-4" />
                    Message
                  </Button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="glass-card py-16 text-center">
            <Users className="h-16 w-16 mx-auto mb-4 text-muted-foreground opacity-50" />
            <h3 className="text-lg font-semibold text-foreground mb-2">
              {searchQuery ? "No team members found" : "No team members yet"}
            </h3>
            <p className="text-muted-foreground mb-6">
              {searchQuery
                ? "Try adjusting your search"
                : "Invite talents to join your team and start collaborating"}
            </p>
            {!searchQuery && (
              <Button onClick={() => setShowInviteModal(true)} className="gap-2">
                <Plus className="h-4 w-4" />
                Invite Member
              </Button>
            )}
          </div>
        )}

        {/* Remove Member Dialog */}
        <AlertDialog open={!!memberToRemove} onOpenChange={() => setMemberToRemove(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Remove Team Member</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to remove {memberToRemove?.name} from your team?
                They will no longer have access to your projects.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleRemoveMember}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Remove
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Invite Modal */}
        <InviteMemberModal
          open={showInviteModal}
          onOpenChange={setShowInviteModal}
          onNavigateToTalent={() => navigate('/talent')}
        />
      </div>
    </MainLayout>
  );
}
