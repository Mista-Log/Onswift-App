import { Eye } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface ShareWithClientDialogProps {
  /** The task being completed; null keeps the dialog closed. */
  taskName: string | null;
  onCompleteAndShare: () => void;
  onCompleteOnly: () => void;
  onCancel: () => void;
}

/**
 * Asked when a creator completes a task in a project that has clients. Clients only ever see tasks
 * the creator approves here (or later with the "Visible to client" switch in the task).
 */
export function ShareWithClientDialog({
  taskName,
  onCompleteAndShare,
  onCompleteOnly,
  onCancel,
}: ShareWithClientDialogProps) {
  return (
    <Dialog open={taskName !== null} onOpenChange={(open) => !open && onCancel()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Is this task complete?</DialogTitle>
          <DialogDescription>
            <span className="font-medium text-foreground">"{taskName}"</span> will be marked as completed. Your
            clients only see tasks you approve. Do you want to show this one to them?
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex flex-col gap-2 sm:flex-row sm:justify-center">
          <Button variant="outline" onClick={onCompleteOnly}>
            Complete only
          </Button>
          <Button className="gap-1.5" onClick={onCompleteAndShare}>
            Complete & show client
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
