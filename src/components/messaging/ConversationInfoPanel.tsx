import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Mail, Briefcase, CalendarDays, UserMinus } from "lucide-react";
import type { TeamMember } from "@/contexts/TeamContext";

interface OtherUser {
  id: string;
  name: string;
  avatar: string | null;
  company: string | null;
  role: string;
}

interface ConversationInfoPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  otherUser?: OtherUser | null;
  /** Matched team member (creator side) — carries title/email/joined date. */
  member?: TeamMember;
  /** Show the "Remove from team" action (creators only). */
  canRemove?: boolean;
  onRemoveFromTeam?: () => void;
}

/**
 * Contact details for a 1-on-1 conversation, opened from the DM header/info icon.
 * Details are sourced from the matched team member; falls back to the sparse
 * conversation `other_user` fields when no team record is available (e.g. talent
 * viewing a creator).
 */
export function ConversationInfoPanel({
  open,
  onOpenChange,
  otherUser,
  member,
  canRemove,
  onRemoveFromTeam,
}: ConversationInfoPanelProps) {
  if (!otherUser) return null;

  const title =
    member?.role ||
    otherUser.company ||
    (otherUser.role ? otherUser.role.charAt(0).toUpperCase() + otherUser.role.slice(1) : null);
  const email = member?.email;
  const joined = member?.created_at
    ? new Date(member.created_at).toLocaleDateString(undefined, {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="sr-only">Contact info</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col items-center gap-3 text-center">
          <Avatar className="h-20 w-20">
            <AvatarImage src={otherUser.avatar || undefined} alt={otherUser.name} />
            <AvatarFallback className="bg-primary/20 text-primary text-xl">
              {otherUser.name.charAt(0)}
            </AvatarFallback>
          </Avatar>
          <div>
            <p className="text-lg font-semibold text-foreground">{otherUser.name}</p>
            {title && <p className="text-sm text-muted-foreground">{title}</p>}
          </div>
        </div>

        <div className="mt-2 space-y-3">
          {title && (
            <div className="flex items-center gap-3 rounded-lg border p-3">
              <Briefcase className="h-4 w-4 shrink-0 text-muted-foreground" />
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">Role</p>
                <p className="truncate text-sm">{title}</p>
              </div>
            </div>
          )}
          {email && (
            <div className="flex items-center gap-3 rounded-lg border p-3">
              <Mail className="h-4 w-4 shrink-0 text-muted-foreground" />
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">Email</p>
                <p className="truncate text-sm">{email}</p>
              </div>
            </div>
          )}
          {joined && (
            <div className="flex items-center gap-3 rounded-lg border p-3">
              <CalendarDays className="h-4 w-4 shrink-0 text-muted-foreground" />
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">Joined your team</p>
                <p className="text-sm">{joined}</p>
              </div>
            </div>
          )}
          {!email && !joined && (
            <p className="text-center text-sm text-muted-foreground">
              No additional details available.
            </p>
          )}
        </div>

        {canRemove && member && onRemoveFromTeam && (
          <Button
            variant="outline"
            className="mt-2 w-full text-destructive hover:text-destructive"
            onClick={onRemoveFromTeam}
          >
            <UserMinus className="mr-2 h-4 w-4" />
            Remove from team
          </Button>
        )}
      </DialogContent>
    </Dialog>
  );
}
