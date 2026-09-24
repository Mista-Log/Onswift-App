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
  awaitingApproval?: boolean;
  assignedToMe?: boolean;
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
  awaitingApproval,
  assignedToMe,
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
    // `date` is a bare "YYYY-MM-DD" string. new Date(date) parses that as UTC
    // midnight, which shifts a day earlier once rendered in a timezone behind
    // UTC — build it as local midnight instead, and compare local calendar
    // days so a task stays "Due Today" until its actual day is over.
    const [year, month, day] = date.split("-").map(Number);
    const d = new Date(year, month - 1, day);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const diffDays = Math.round((d.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays < 0) return "Overdue";
    if (diffDays === 0) return "Due Today";
    if (diffDays === 1) return "Due Tomorrow";
    if (diffDays <= 7) return `Due in ${diffDays} days`;
    return `Due: ${d.toLocaleDateString()}`;
  };

  return (
    <div
      className={cn(
        "flex items-center gap-2 p-3 rounded-lg border border-border/50 transition-all duration-200 sm:gap-4 sm:p-4",
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
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1">
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
          <Badge variant="outline" className="hidden text-xs sm:inline-flex">
            {getStatusLabel()}
          </Badge>
          {awaitingApproval && (
            <Badge variant="outline" className="text-xs border-yellow-400/50 bg-yellow-500/10 text-yellow-600">
              Pending approval
            </Badge>
          )}
          {assignedToMe && (
            <Badge variant="outline" className="hidden text-xs text-muted-foreground sm:inline-flex">
              Assigned to you
            </Badge>
          )}
        </div>
      </div>

      <Badge
        variant="secondary"
        title={projectName}
        className="flex-shrink-0 block max-w-[84px] truncate text-xs sm:inline-flex sm:max-w-none"
      >
        {projectName}
      </Badge>
    </div>
  );
}
