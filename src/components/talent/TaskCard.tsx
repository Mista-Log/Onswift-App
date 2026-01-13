import { cn } from "@/lib/utils";
import { Check, Circle, Clock, PlayCircle, CheckCircle2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface TaskCardProps {
  id: string;
  name: string;
  description?: string;
  deadline?: string | null;
  projectName: string;
  status: "planning" | "in-progress" | "completed";
  onStatusChange?: (id: string, status: "planning" | "in-progress" | "completed") => void;
  onClick?: () => void;
}

export function TaskCard({
  id,
  name,
  description,
  deadline,
  projectName,
  status,
  onStatusChange,
  onClick
}: TaskCardProps) {
  const isCompleted = status === "completed";

  const getStatusIcon = () => {
    switch (status) {
      case "completed":
        return <CheckCircle2 className="h-5 w-5 text-green-500" />;
      case "in-progress":
        return <PlayCircle className="h-5 w-5 text-primary" />;
      default:
        return <Circle className="h-5 w-5 text-muted-foreground" />;
    }
  };

  const getStatusLabel = () => {
    switch (status) {
      case "completed":
        return "Completed";
      case "in-progress":
        return "In Progress";
      default:
        return "Planning";
    }
  };

  const formatDeadline = (date: string | null | undefined) => {
    if (!date) return null;
    const d = new Date(date);
    const now = new Date();
    const diffDays = Math.ceil((d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays < 0) return "Overdue";
    if (diffDays === 0) return "Due Today";
    if (diffDays === 1) return "Due Tomorrow";
    if (diffDays <= 7) return `Due in ${diffDays} days`;
    return `Due: ${d.toLocaleDateString()}`;
  };

  return (
    <div
      className={cn(
        "flex items-center gap-4 p-4 rounded-lg border border-border/50 transition-all duration-200",
        "hover:border-primary/40 hover:shadow-[0_0_20px_hsl(250_76%_63%/0.15)]",
        isCompleted && "opacity-60"
      )}
    >
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="flex-shrink-0 hover:scale-110 transition-transform">
            {getStatusIcon()}
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          <DropdownMenuItem onClick={() => onStatusChange?.(id, "planning")}>
            <Circle className="h-4 w-4 mr-2 text-muted-foreground" />
            Planning
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => onStatusChange?.(id, "in-progress")}>
            <PlayCircle className="h-4 w-4 mr-2 text-primary" />
            In Progress
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => onStatusChange?.(id, "completed")}>
            <CheckCircle2 className="h-4 w-4 mr-2 text-green-500" />
            Completed
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <div className="flex-1 min-w-0" onClick={onClick}>
        <p className={cn(
          "font-medium text-foreground truncate",
          isCompleted && "line-through"
        )}>
          {name}
        </p>
        {description && (
          <p className="text-xs text-muted-foreground truncate mt-0.5">{description}</p>
        )}
        <div className="flex items-center gap-3 mt-1">
          {deadline && (
            <div className="flex items-center gap-1">
              <Clock className="h-3 w-3 text-muted-foreground" />
              <span className={cn(
                "text-xs",
                formatDeadline(deadline) === "Overdue" ? "text-destructive" : "text-muted-foreground"
              )}>
                {formatDeadline(deadline)}
              </span>
            </div>
          )}
          <Badge variant="outline" className="text-xs">
            {getStatusLabel()}
          </Badge>
        </div>
      </div>

      <Badge variant="secondary" className="flex-shrink-0 text-xs">
        {projectName}
      </Badge>
    </div>
  );
}
