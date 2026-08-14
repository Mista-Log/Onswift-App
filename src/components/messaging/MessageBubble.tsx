import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ArrowUp, Check, Reply, Pencil, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useMessageGesture } from "@/hooks/use-message-gesture";
import type { Message, GroupMessage } from "@/pages/Messages";

interface MessageBubbleProps {
  message: Message | GroupMessage;
  isOwn: boolean;
  showSenderHeader: boolean; // group, non-own messages only
  isMobile: boolean;
  isSelecting: boolean;
  isSelected: boolean;
  isEditable: boolean;
  formatTime: (dateString: string) => string;
  onReply: (msg: Message | GroupMessage) => void;
  onEdit: (msg: Message | GroupMessage) => void;
  onDelete: (msg: Message | GroupMessage) => void;
  onLongPress: (msg: Message | GroupMessage) => void;
  onToggleSelected: (id: string) => void;
}

export function MessageBubble({
  message: msg,
  isOwn,
  showSenderHeader,
  isMobile,
  isSelecting,
  isSelected,
  isEditable,
  formatTime,
  onReply,
  onEdit,
  onDelete,
  onLongPress,
  onToggleSelected,
}: MessageBubbleProps) {
  const gesture = useMessageGesture({
    isOwn,
    disabled: msg.is_deleted || !isMobile,
    isSelecting,
    onSwipeReply: () => onReply(msg),
    onLongPress: () => onLongPress(msg),
    onTap: () => onToggleSelected(msg.id),
  });

  return (
    <div className={cn("relative flex items-center gap-2", isOwn ? "justify-end" : "justify-start")}>
      {/* Reply-icon hint revealed behind the bubble while swiping */}
      <div
        className={cn(
          "pointer-events-none absolute top-1/2 -translate-y-1/2 text-primary",
          isOwn ? "right-0" : "left-0"
        )}
        style={{ opacity: gesture.dragProgress }}
      >
        <Reply className="h-4 w-4" />
      </div>

      {!isOwn && showSenderHeader && (
        <Avatar className="h-8 w-8 mr-2 shrink-0 self-end">
          <AvatarImage src={msg.sender_avatar || undefined} alt={msg.sender_name} />
          <AvatarFallback className="bg-primary/20 text-primary text-xs">
            {msg.sender_name.charAt(0)}
          </AvatarFallback>
        </Avatar>
      )}

      <div className="min-w-0 max-w-[85%] sm:max-w-[75%] md:max-w-[70%]">
        {!isOwn && showSenderHeader && (
          <p className="text-xs text-muted-foreground mb-1">{msg.sender_name}</p>
        )}
        <div
          {...gesture.handlers}
          style={gesture.style}
          className={cn(
            "group/bubble relative min-w-0 rounded-2xl px-3 py-2 sm:px-4",
            msg.is_deleted
              ? "border border-dashed border-border bg-transparent"
              : isOwn
                ? "bg-primary text-primary-foreground"
                : "bg-secondary text-foreground",
            isSelected && "ring-2 ring-primary ring-offset-2 ring-offset-background"
          )}
        >
          {isSelecting && (
            <div
              className={cn(
                "absolute -top-2 flex h-5 w-5 items-center justify-center rounded-full border shadow-sm",
                isOwn ? "-left-2" : "-right-2",
                isSelected ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background"
              )}
            >
              {isSelected && <Check className="h-3 w-3" />}
            </div>
          )}

          {!msg.is_deleted && !isMobile && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                <Button
                  size="icon"
                  variant="ghost"
                  className={cn(
                    "absolute -top-2 h-6 w-6 rounded-full bg-background border border-border shadow-sm opacity-100 transition-opacity sm:opacity-0 sm:group-hover/bubble:opacity-100",
                    isOwn ? "-left-8" : "-right-8"
                  )}
                >
                  <ArrowUp className="h-3 w-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align={isOwn ? "start" : "end"}>
                <DropdownMenuItem onClick={() => onReply(msg)}>
                  <Reply className="h-4 w-4 mr-2" />
                  Reply
                </DropdownMenuItem>
                {isOwn && isEditable && (
                  <DropdownMenuItem onClick={() => onEdit(msg)}>
                    <Pencil className="h-4 w-4 mr-2" />
                    Edit
                  </DropdownMenuItem>
                )}
                {isOwn && (
                  <DropdownMenuItem
                    onClick={() => onDelete(msg)}
                    className="text-destructive focus:text-destructive"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          {msg.is_deleted ? (
            <p className="text-sm italic text-muted-foreground">
              {isOwn ? "You deleted this message" : "This message was deleted"}
            </p>
          ) : (
            <>
              {msg.reply_to && (
                <div
                  className={cn(
                    "mb-2 rounded border-l-4 p-2",
                    isOwn
                      ? "border-primary-foreground/40 bg-primary-foreground/10"
                      : "border-primary/50 bg-secondary/30"
                  )}
                >
                  <p className={cn("text-xs font-medium", isOwn ? "text-primary-foreground" : "text-primary")}>
                    {msg.reply_to.sender_name}
                  </p>
                  <p className={cn("truncate text-xs", isOwn ? "text-primary-foreground/70" : "text-muted-foreground")}>
                    {msg.reply_to.content}
                  </p>
                </div>
              )}
              <p className="text-sm whitespace-pre-wrap break-words [overflow-wrap:anywhere]">{msg.content}</p>
            </>
          )}

          <div className="mt-1 flex items-center justify-end gap-1.5">
            {msg.is_edited && !msg.is_deleted && (
              <p className={cn("text-xs", isOwn ? "text-primary-foreground/70" : "text-muted-foreground")}>
                edited
              </p>
            )}
            <p className={cn("text-xs", isOwn ? "text-primary-foreground/70" : "text-muted-foreground")}>
              {formatTime(msg.created_at)}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
