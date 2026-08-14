import { Button } from "@/components/ui/button";
import { Send, X } from "lucide-react";

interface SelectionToolbarProps {
  count: number;
  onCancel: () => void;
  onForward: () => void;
}

// Replaces the thread header while selecting messages to forward.
export function SelectionToolbar({ count, onCancel, onForward }: SelectionToolbarProps) {
  return (
    <div className="flex items-center justify-between gap-2 border-b border-border/50 p-4 sm:p-5">
      <div className="flex items-center gap-2">
        <Button size="icon" variant="ghost" onClick={onCancel} aria-label="Cancel selection">
          <X className="h-5 w-5" />
        </Button>
        <p className="text-sm font-medium text-foreground">{count} selected</p>
      </div>
      <Button size="sm" onClick={onForward} disabled={count === 0} className="gap-2">
        <Send className="h-4 w-4" />
        Forward
      </Button>
    </div>
  );
}
