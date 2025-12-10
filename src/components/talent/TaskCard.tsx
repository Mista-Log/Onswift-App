import { cn } from "@/lib/utils";
import { Check, Circle, Clock, Coins } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface TaskCardProps {
  id: string;
  name: string;
  dueDate: string;
  projectName: string;
  points: number;
  completed?: boolean;
  onToggleComplete?: (id: string) => void;
  onClick?: () => void;
}

export function TaskCard({
  id,
  name,
  dueDate,
  projectName,
  points,
  completed = false,
  onToggleComplete,
  onClick
}: TaskCardProps) {
  return (
    <div 
      className={cn(
        "flex items-center gap-4 p-4 rounded-lg border border-border/50 transition-all duration-200 cursor-pointer",
        "hover:border-primary/40 hover:shadow-[0_0_20px_hsl(250_76%_63%/0.15)]",
        completed && "opacity-60"
      )}
      onClick={onClick}
    >
      <button
        onClick={(e) => {
          e.stopPropagation();
          onToggleComplete?.(id);
        }}
        className={cn(
          "flex-shrink-0 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors",
          completed 
            ? "bg-primary border-primary" 
            : "border-muted-foreground hover:border-primary"
        )}
      >
        {completed && <Check className="h-4 w-4 text-primary-foreground" />}
      </button>

      <div className="flex-1 min-w-0">
        <p className={cn(
          "font-medium text-foreground truncate",
          completed && "line-through"
        )}>
          {name}
        </p>
        <div className="flex items-center gap-2 mt-1">
          <Clock className="h-3 w-3 text-muted-foreground" />
          <span className="text-xs text-muted-foreground">{dueDate}</span>
        </div>
      </div>

      <Badge variant="secondary" className="flex-shrink-0 text-xs">
        {projectName}
      </Badge>

      <div className="flex items-center gap-1 text-warning">
        <Coins className="h-4 w-4" />
        <span className="text-sm font-medium">{points}</span>
      </div>
    </div>
  );
}
