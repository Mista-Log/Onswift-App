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

interface CompletionGateProps {
  open: boolean;
  onClose: () => void;
  /** "Yes, add attachment": go and submit the work; the creator's approval completes the task. */
  onHasAttachment: () => void;
  /** "No, request approval": tell the creator the task is ready. */
  onRequestApproval: () => void;
}

/**
 * Shown to a talent who tries to complete a task. Same wording as the My Tasks panel: a talent can't
 * complete a task themselves, so they either attach their work or ask the creator to approve it.
 */
export function CompletionGate({ open, onClose, onHasAttachment, onRequestApproval }: CompletionGateProps) {
  return (
    <AlertDialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Do you have an attachment for this task?</AlertDialogTitle>
          <AlertDialogDescription>
            Onswift is attachment-based. If you have work to submit along with this task, add it now.
            Otherwise we'll let your creator know it's ready for their approval.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onRequestApproval}>No, request approval</AlertDialogCancel>
          <AlertDialogAction onClick={onHasAttachment}>Yes, add attachment</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
