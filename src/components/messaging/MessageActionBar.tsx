import { Button } from "@/components/ui/button";
import { Reply, Copy, CheckSquare, Pencil, Trash2, X } from "lucide-react";

interface MessageActionBarProps {
  isOwn: boolean;
  isEditable: boolean;
  onReply: () => void;
  onCopy: () => void;
  onSelect: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onClose: () => void;
}

// Replaces the thread header on long-press (mobile only) — the desktop
// hover dropdown's Reply/Edit/Delete plus Copy and Select, since there's no
// hover state on touch to reveal a per-bubble menu.
export function MessageActionBar({
  isOwn,
  isEditable,
  onReply,
  onCopy,
  onSelect,
  onEdit,
  onDelete,
  onClose,
}: MessageActionBarProps) {
  return (
    <div className="flex items-center justify-between gap-2 border-b border-border/50 p-4 sm:p-5">
      <div className="flex items-center gap-1">
        <Button size="icon" variant="ghost" onClick={onReply} aria-label="Reply" title="Reply">
          <Reply className="h-5 w-5" />
        </Button>
        <Button size="icon" variant="ghost" onClick={onCopy} aria-label="Copy" title="Copy">
          <Copy className="h-5 w-5" />
        </Button>
        <Button size="icon" variant="ghost" onClick={onSelect} aria-label="Select" title="Select">
          <CheckSquare className="h-5 w-5" />
        </Button>
      </div>
      <div className="flex items-center gap-1">
        {isOwn && isEditable && (
          <Button size="icon" variant="ghost" onClick={onEdit} aria-label="Edit" title="Edit">
            <Pencil className="h-5 w-5" />
          </Button>
        )}
        {isOwn && (
          <Button
            size="icon"
            variant="ghost"
            onClick={onDelete}
            aria-label="Delete"
            title="Delete"
            className="text-destructive hover:text-destructive"
          >
            <Trash2 className="h-5 w-5" />
          </Button>
        )}
        <Button size="icon" variant="ghost" onClick={onClose} aria-label="Close">
          <X className="h-5 w-5" />
        </Button>
      </div>
    </div>
  );
}
