import { useNavigate } from "react-router-dom";
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";

interface CelebrationCTA {
  label: string;
  href: string;
}

interface CelebrationModalProps {
  open: boolean;
  onClose: () => void;
  emoji: string;
  title: string;
  description: string;
  cta?: CelebrationCTA;
  secondaryLabel?: string;
}

const CONFETTI_COLORS = [
  "#6366f1", "#f59e0b", "#10b981", "#ef4444",
  "#8b5cf6", "#ec4899", "#3b82f6", "#f97316",
  "#06b6d4", "#84cc16",
];

function ConfettiField() {
  const pieces = Array.from({ length: 20 }, (_, i) => {
    const color = CONFETTI_COLORS[i % CONFETTI_COLORS.length];
    const left = `${4 + (i * 13) % 92}%`;
    const delay = `${((i * 0.11) % 1.8).toFixed(2)}s`;
    const width = i % 3 === 0 ? "10px" : "7px";
    const height = i % 3 === 0 ? "7px" : "10px";
    const isCircle = i % 4 === 0;

    return (
      <div
        key={i}
        className="confetti-piece"
        style={{
          left,
          top: "-12px",
          width,
          height,
          backgroundColor: color,
          borderRadius: isCircle ? "50%" : "2px",
          animationDelay: delay,
        }}
      />
    );
  });

  return (
    <div className="absolute inset-x-0 top-0 h-40 overflow-hidden pointer-events-none">
      {pieces}
    </div>
  );
}

export function CelebrationModal({
  open,
  onClose,
  emoji,
  title,
  description,
  cta,
  secondaryLabel = "I'll explore on my own",
}: CelebrationModalProps) {
  const navigate = useNavigate();

  const handleCTA = () => {
    onClose();
    if (cta?.href) navigate(cta.href);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-sm p-0 overflow-hidden gap-0 border-border/60">
        {/* Header with confetti */}
        <div className="relative bg-gradient-to-br from-primary/15 via-purple-500/5 to-pink-500/10 pt-10 pb-6 text-center overflow-hidden">
          <ConfettiField />
          <span className="relative z-10 text-6xl leading-none animate-bounce inline-block">
            {emoji}
          </span>
        </div>

        {/* Body */}
        <div className="px-6 pb-6 pt-4 text-center space-y-2">
          <h2 className="text-xl font-bold text-foreground">{title}</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">{description}</p>

          <div className="pt-3 space-y-3">
            {cta && (
              <Button onClick={handleCTA} className="w-full gap-2">
                {cta.label}
                <ArrowRight className="h-4 w-4" />
              </Button>
            )}
            <button
              onClick={onClose}
              className="block w-full text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              {secondaryLabel}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
