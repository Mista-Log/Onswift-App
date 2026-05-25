import { useState } from "react";
import { Notification } from "@/types/notification";
import { formatDistanceToNow } from "date-fns";
import { Bell, Briefcase, Check, X, Loader2, Trash2, FileText, FolderOpen, MessageSquare, CalendarDays, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { secureFetch } from "@/api/apiClient";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { useTeam } from "@/contexts/TeamContext";
import { useProjects } from "@/contexts/ProjectContext";
import { useNavigate } from "react-router-dom";

interface NotificationItemProps {
  notification: Notification;
  onMarkAsRead: (id: string) => void;
  onDelete?: (id: string) => void;
  onClose?: () => void;
}

function resolveRoute(notification: Notification): string | null {
  if (notification.notification_type === "hire") return "/team";

  const text = `${notification.title} ${notification.message}`.toLowerCase();

  if (/deliverable|approved|revision|submitted/.test(text)) return "/deliverables";
  if (/task/.test(text)) return "/projects";
  if (/project/.test(text)) return "/projects";
  if (/message|chat/.test(text)) return "/messages";
  if (/deadline|calendar/.test(text)) return "/calendar";
  if (/team/.test(text)) return "/team";

  return null;
}

function getIconMeta(notification: Notification) {
  if (notification.notification_type === "hire") {
    return { icon: Briefcase, bg: "bg-primary/10", color: "text-primary" };
  }
  const text = `${notification.title} ${notification.message}`.toLowerCase();
  if (/deliverable|approved|revision/.test(text)) return { icon: FileText, bg: "bg-green-500/10", color: "text-green-600" };
  if (/task|project/.test(text)) return { icon: FolderOpen, bg: "bg-blue-500/10", color: "text-blue-600" };
  if (/message|chat/.test(text)) return { icon: MessageSquare, bg: "bg-purple-500/10", color: "text-purple-600" };
  if (/deadline|calendar/.test(text)) return { icon: CalendarDays, bg: "bg-orange-500/10", color: "text-orange-600" };
  if (/team/.test(text)) return { icon: Users, bg: "bg-secondary", color: "text-muted-foreground" };
  return { icon: Bell, bg: "bg-secondary", color: "text-muted-foreground" };
}

export function NotificationItem({
  notification,
  onMarkAsRead,
  onDelete,
  onClose,
}: NotificationItemProps) {
  const { user } = useAuth();
  const { fetchTeam } = useTeam();
  const { updateTask } = useProjects();
  const [isResponding, setIsResponding] = useState(false);
  const [hasResponded, setHasResponded] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const navigate = useNavigate();

  const handleHireResponse = async (accept: boolean) => {
    if (!notification.hire_request) return;
    setIsResponding(true);
    try {
      const response = await secureFetch(
        `/api/v3/hire-requests/${notification.hire_request}/respond/`,
        { method: "PATCH", body: JSON.stringify({ status: accept ? "accepted" : "rejected" }) }
      );
      if (response.ok) {
        setHasResponded(true);
        toast.success(accept ? "Hire request accepted! Welcome to the team." : "Hire request declined.");
        onMarkAsRead(notification.id);
        if (user?.role === "creator") await fetchTeam();
        if (onClose) setTimeout(onClose, 1000);
      } else {
        toast.error("Failed to respond to hire request");
      }
    } catch (error) {
      console.error("Error responding to hire request:", error);
      toast.error("An error occurred");
    } finally {
      setIsResponding(false);
    }
  };

  const handleClick = () => {
    if (!notification.is_read) {
      onMarkAsRead(notification.id);

      if (user?.role === "talent") {
        try {
          const urlTaskMatch = notification.message.match(/projects\/[\w-]+\/tasks\/([a-zA-Z0-9-]+)/);
          const shortTaskMatch = notification.message.match(/tasks\/([a-zA-Z0-9-]+)/);
          const taskId = urlTaskMatch?.[1] || shortTaskMatch?.[1];
          if (taskId) {
            updateTask(taskId, { status: "in-progress" })
              .then(() => toast.success("Task marked In Progress"))
              .catch((err) => console.error("Failed to auto-start task:", err));
          }
        } catch (err) {
          console.error("Error parsing notification for task id:", err);
        }
      }
    }

    const route = resolveRoute(notification);
    if (route) {
      navigate(route);
      if (onClose) onClose();
    }
  };

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!onDelete) return;
    setIsDeleting(true);
    await onDelete(notification.id);
    setIsDeleting(false);
  };

  const { icon: Icon, bg, color } = getIconMeta(notification);
  const route = resolveRoute(notification);

  const showActions =
    user?.role === "talent" &&
    notification.notification_type === "hire" &&
    notification.hire_request &&
    !hasResponded &&
    notification.message.includes("wants to hire you");

  return (
    <div
      onClick={handleClick}
      className={cn(
        "group relative p-4 border-b border-border/50 transition-colors",
        route ? "cursor-pointer hover:bg-secondary/30" : "cursor-default",
        !notification.is_read && "bg-primary/5"
      )}
    >
      {/* Hover-reveal delete button */}
      {onDelete && (
        <button
          onClick={handleDelete}
          disabled={isDeleting}
          className="absolute right-2 top-2 opacity-0 group-hover:opacity-100 transition-opacity rounded-md p-1 hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
          aria-label="Delete notification"
        >
          {isDeleting
            ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
            : <Trash2 className="h-3.5 w-3.5" />
          }
        </button>
      )}

      <div className="flex gap-3">
        {/* Icon */}
        <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-full", bg)}>
          <Icon className={cn("h-5 w-5", color)} />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0 pr-5">
          <div className="flex items-start justify-between gap-2 mb-1">
            <h4 className="text-sm font-semibold text-foreground leading-snug">
              {notification.title}
            </h4>
            {!notification.is_read && (
              <div className="h-2 w-2 rounded-full bg-primary shrink-0 mt-1" />
            )}
          </div>

          <p className={cn(
            "text-sm text-muted-foreground mb-1.5",
            route && "group-hover:text-foreground transition-colors"
          )}>
            {notification.message}
          </p>

          <p className="text-xs text-muted-foreground">
            {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}
          </p>

          {/* Hire Request Actions (Talent Only) */}
          {showActions && (
            <div className="flex gap-2 mt-3">
              <Button
                size="sm"
                variant="default"
                className="gap-1"
                onClick={(e) => { e.stopPropagation(); handleHireResponse(true); }}
                disabled={isResponding}
              >
                {isResponding ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                Accept
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="gap-1"
                onClick={(e) => { e.stopPropagation(); handleHireResponse(false); }}
                disabled={isResponding}
              >
                {isResponding ? <Loader2 className="h-3 w-3 animate-spin" /> : <X className="h-3 w-3" />}
                Decline
              </Button>
            </div>
          )}

          {hasResponded && (
            <div className="mt-2 text-xs text-primary font-medium">✓ Response sent</div>
          )}
        </div>
      </div>
    </div>
  );
}
