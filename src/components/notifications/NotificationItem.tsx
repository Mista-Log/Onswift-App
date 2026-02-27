import { useState } from "react";
import { Notification } from "@/types/notification";
import { formatDistanceToNow } from "date-fns";
import { Bell, Briefcase, Check, X, Loader2 } from "lucide-react";
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
  onClose?: () => void;
}

export function NotificationItem({
  notification,
  onMarkAsRead,
  onClose,
}: NotificationItemProps) {
  const { user } = useAuth();
  const { fetchTeam } = useTeam();
  const { updateTask } = useProjects();
  const [isResponding, setIsResponding] = useState(false);
  const [hasResponded, setHasResponded] = useState(false);
  const navigate = useNavigate();

  const handleHireResponse = async (accept: boolean) => {
    if (!notification.hire_request) return;

    setIsResponding(true);
    try {
      const response = await secureFetch(
        `/api/v3/hire-requests/${notification.hire_request}/respond/`,
        {
          method: "PATCH",
          body: JSON.stringify({
            status: accept ? "accepted" : "rejected",
          }),
        }
      );

      if (response.ok) {
        setHasResponded(true);
        toast.success(
          accept
            ? "Hire request accepted! Welcome to the team."
            : "Hire request declined."
        );

        // Mark notification as read
        onMarkAsRead(notification.id);

        // Refresh team if creator
        if (user?.role === "creator") {
          await fetchTeam();
        }

        // Close dropdown after action
        if (onClose) {
          setTimeout(onClose, 1000);
        }
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
    // Mark as read if not already
    if (!notification.is_read) {
      onMarkAsRead(notification.id);

      // If this notification references a task URL or id, auto-start the task
      if (user?.role === "talent") {
        try {
          // Try to extract task id from common URL patterns in the message
          const urlTaskMatch = notification.message.match(/projects\/[\w-]+\/tasks\/([a-zA-Z0-9-]+)/);
          const shortTaskMatch = notification.message.match(/tasks\/([a-zA-Z0-9-]+)/);
          const taskId = urlTaskMatch?.[1] || shortTaskMatch?.[1];

          if (taskId) {
            // Fire and forget: update task to in-progress
            updateTask(taskId, { status: "in-progress" }).then(() => {
              toast.success("Task marked In Progress");
            }).catch((err) => {
              console.error("Failed to auto-start task from notification:", err);
            });
          }
        } catch (err) {
          console.error("Error parsing notification for task id:", err);
        }
      }
    }
    // Navigate based on notification type/content
    if (notification.notification_type === "hire" && notification.hire_request) {
      // Go to team page or hire request detail if exists
      navigate("/team");
      if (onClose) onClose();
      return;
    }
    if (notification.notification_type === "system") {
      // Example: If message contains 'project', go to projects
      if (/project/i.test(notification.message)) {
        navigate("/projects");
        if (onClose) onClose();
        return;
      }
      // If message contains 'message' or 'chat', go to messages
      if (/message|chat/i.test(notification.message)) {
        navigate("/messages");
        if (onClose) onClose();
        return;
      }
      // If message contains 'deadline' or 'calendar', go to calendar
      if (/deadline|calendar/i.test(notification.message)) {
        navigate("/calendar");
        if (onClose) onClose();
        return;
      }
      // If message contains 'team', go to team
      if (/team/i.test(notification.message)) {
        navigate("/team");
        if (onClose) onClose();
        return;
      }
    }
    // Default: do nothing
  };

  const getIcon = () => {
    if (notification.notification_type === "hire") {
      return <Briefcase className="h-5 w-5 text-primary" />;
    }
    return <Bell className="h-5 w-5 text-muted-foreground" />;
  };

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
        "p-4 border-b border-border/50 transition-colors cursor-pointer hover:bg-secondary/30",
        !notification.is_read && "bg-primary/5"
      )}
    >
      <div className="flex gap-3">
        {/* Icon */}
        <div
          className={cn(
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-full",
            notification.notification_type === "hire"
              ? "bg-primary/10"
              : "bg-secondary"
          )}
        >
          {getIcon()}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 mb-1">
            <h4 className="text-sm font-semibold text-foreground">
              {notification.title}
            </h4>
            {!notification.is_read && (
              <div className="h-2 w-2 rounded-full bg-primary shrink-0 mt-1" />
            )}
          </div>

          <p className="text-sm text-muted-foreground mb-2">
            {notification.message}
          </p>

          <p className="text-xs text-muted-foreground">
            {formatDistanceToNow(new Date(notification.created_at), {
              addSuffix: true,
            })}
          </p>

          {/* Hire Request Actions (Talent Only) */}
          {showActions && (
            <div className="flex gap-2 mt-3">
              <Button
                size="sm"
                variant="default"
                className="gap-1"
                onClick={(e) => {
                  e.stopPropagation();
                  handleHireResponse(true);
                }}
                disabled={isResponding}
              >
                {isResponding ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Check className="h-3 w-3" />
                )}
                Accept
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="gap-1"
                onClick={(e) => {
                  e.stopPropagation();
                  handleHireResponse(false);
                }}
                disabled={isResponding}
              >
                {isResponding ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <X className="h-3 w-3" />
                )}
                Decline
              </Button>
            </div>
          )}

          {/* Response Confirmation */}
          {hasResponded && (
            <div className="mt-2 text-xs text-primary font-medium">
              ✓ Response sent
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
