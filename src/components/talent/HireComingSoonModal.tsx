import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface HireComingSoonModalProps {
  open: boolean;
  onClose: () => void;
  talentName?: string;
}

export function HireComingSoonModal({ open, onClose, talentName }: HireComingSoonModalProps) {
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-sm text-center">
        <DialogHeader>
          <DialogTitle className="sr-only">Hire {talentName}</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col items-center gap-4 py-6">
          <span className="text-6xl select-none" aria-hidden>🚀</span>

          <div>
            <h2 className="text-xl font-extrabold text-foreground">
              Something exciting is coming!
            </h2>
            <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
              Direct hiring for{" "}
              <span className="font-semibold text-foreground">{talentName}</span>{" "}
              is almost ready. We're putting the final touches on it. You'll be the first to know.
            </p>
          </div>

          <Button className="w-full" onClick={onClose}>
            Notify me when it's live 🎉
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
