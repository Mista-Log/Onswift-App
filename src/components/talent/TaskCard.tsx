import { cn } from "@/lib/utils";
import { Check, ChevronDown, Circle, Clock, Grip, PlayCircle, CheckCircle2 } from "lucide-react";
import { useSwipeStatus } from "@/hooks/use-swipe-status";
import { success as feedbackSuccess } from "@/lib/feedback";
import type { Stage, StageAction } from "@/lib/taskStages";

const STAGE_LABELS = { planning: "Planning", "in-progress": "In Progress", completed: "Completed" } as const;
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
  /** What moving this card to a stage does for the signed-in user (see lib/taskStages). Omit = any stage. */
  stageRule?: (to: Stage) => StageAction;
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
  stageRule,
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

  // Which stages this user may move the card to (default: any). Shown/handled per the role's rule.
  const isLocked = (to: Stage) => to !== status && stageRule?.(to) === "locked";
  const stageOrder: Stage[] = ["planning", "in-progress", "completed"];
  const neighbours = [stageOrder[stageOrder.indexOf(status) - 1], stageOrder[stageOrder.indexOf(status) + 1]];
  const swipeable = !!onStatusChange && neighbours.some((n) => n && !isLocked(n));
  const menuStages = stageOrder.filter((s) => s === status || !isLocked(s));

  const swipe = useSwipeStatus({
    status,
    onChange: (next) => {
      onStatusChange?.(id, next);
      if (next === "completed") feedbackSuccess();
    },
    // A move that needs the completion gate is handed to the same handler, which opens the gate.
    onGate: (next) => onStatusChange?.(id, next),
    actionFor: stageRule,
    disabled: !onStatusChange,
  });

  return (
    <div className="relative">
      {swipe.target && (
        <div
          aria-hidden
          className={cn(
            "absolute inset-0 flex items-center rounded-lg border border-border/50 bg-secondary/60 px-4 text-xs font-medium text-muted-foreground",
            swipe.offset > 0 ? "justify-start" : "justify-end"
          )}
        >
          {STAGE_LABELS[swipe.target]}
        </div>
      )}
    <div
      {...swipe.handlers}
      style={swipe.style}
      className={cn(
        "relative flex items-center gap-2 p-3 rounded-lg border border-border/50 bg-background transition-colors duration-200 sm:gap-4 sm:p-4",
        "hover:border-primary/40 hover:shadow-[0_0_20px_hsl(250_76%_63%/0.15)] dark:hover:shadow-[0_0_20px_hsl(0_0%_100%/0.08)]",
        isCompleted && "opacity-60"
      )}
    >
      {swipeable && (
        <span
          aria-hidden
          title="Swipe left or right to change stage"
          className="-ml-1 flex-shrink-0 text-muted-foreground/60"
        >
          <Grip className="h-4 w-4" />
        </span>
      )}
      {menuStages.length > 1 ? (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            aria-label={`Change stage (now ${getStatusLabel()})`}
            title={`${getStatusLabel()} - change stage`}
            className="flex-shrink-0 hover:scale-110 transition-transform"
          >
            {/* Colour still hints at the stage: grey planning, purple in progress, green completed */}
            <ChevronDown
              className={cn(
                "h-5 w-5",
                status === "completed" ? "text-green-500" : status === "in-progress" ? "text-primary" : "text-muted-foreground"
              )}
            />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          {menuStages.includes("planning") && (
          <DropdownMenuItem onClick={() => onStatusChange?.(id, "planning")}>
            <Circle className="h-4 w-4 mr-2 text-muted-foreground" />
            Planning
          </DropdownMenuItem>
          )}
          {menuStages.includes("in-progress") && (
          <DropdownMenuItem onClick={() => onStatusChange?.(id, "in-progress")}>
            <PlayCircle className="h-4 w-4 mr-2 text-primary" />
            In Progress
          </DropdownMenuItem>
          )}
          {menuStages.includes("completed") && (
          <DropdownMenuItem onClick={() => onStatusChange?.(id, "completed")}>
            <CheckCircle2 className="h-4 w-4 mr-2 text-green-500" />
            Completed
          </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
      ) : (
        <span className="flex-shrink-0">{getStatusIcon()}</span>
      )}

      <div className="flex-1 min-w-0" onClick={() => { if (!swipe.wasDragged()) onClick?.(); }}>
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
            <Badge variant="outline" className="text-xs border-yellow-400/50 bg-yellow-500/10 text-yellow-600 dark:border-yellow-400/40 dark:bg-yellow-500/15 dark:text-yellow-400">
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
    </div>
  );
}
