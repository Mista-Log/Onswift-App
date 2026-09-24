import { Clock, Lock, MoreVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { PersonalTask } from "@/components/tasks/PersonalTaskDialog";

type Status = PersonalTask["status"];

const STATUS_COLORS: Record<Status, string> = {
  planning: "!bg-orange-100 border-orange-400",
  "in-progress": "!bg-yellow-100 border-yellow-400",
  completed: "!bg-green-100 border-green-400",
};

const STATUS_LABELS: Record<Status, string> = {
  planning: "Planning",
  "in-progress": "In Progress",
  completed: "Completed",
};

function formatDeadline(date: string): string {
  // Bare "YYYY-MM-DD": build a local date so the day never shifts with the timezone.
  const [y, m, d] = date.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString();
}

interface PersonalTaskCardProps {
  task: PersonalTask;
  onStatusChange: (status: Status) => void;
  onOpen: () => void;
}

/** A private personal task shown inside a project it is linked to. Only its owner ever sees this. */
export function PersonalTaskCard({ task, onStatusChange, onOpen }: PersonalTaskCardProps) {
  return (
    <div
      className={`glass-card p-4 rounded-lg border space-y-2 cursor-pointer select-none ${STATUS_COLORS[task.status]}`}
      onClick={(e) => {
        if ((e.target as HTMLElement).closest("[data-radix-popper-content-wrapper]")) return;
        onOpen();
      }}
    >
      <div className="flex items-start justify-between gap-2">
        <h4 className="min-w-0 flex-1 truncate text-sm font-medium">{task.name}</h4>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 shrink-0"
              aria-label="Change status"
              onClick={(e) => e.stopPropagation()}
            >
              <MoreVertical className="h-3 w-3" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {(Object.keys(STATUS_LABELS) as Status[])
              .filter((s) => s !== task.status)
              .map((s) => (
                <DropdownMenuItem key={s} onClick={() => onStatusChange(s)}>
                  Move to {STATUS_LABELS[s]}
                </DropdownMenuItem>
              ))}
            <DropdownMenuItem onClick={onOpen}>Edit</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {task.description && (
        <p className="line-clamp-2 text-xs text-muted-foreground">{task.description}</p>
      )}

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 font-medium text-primary" title="Only you can see this task">
          <Lock className="h-3 w-3" />
          Personal
        </span>
        {task.deadline && (
          <span className="inline-flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {formatDeadline(task.deadline)}
          </span>
        )}
      </div>
    </div>
  );
}
