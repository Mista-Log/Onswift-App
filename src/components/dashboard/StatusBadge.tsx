import { cn } from "@/lib/utils";

type StatusType = "in-progress" | "planning" | "completed" | "pending" | "approved" | "revision";

interface StatusBadgeProps {
  status: StatusType;
  className?: string;
}

const statusConfig: Record<StatusType, { label: string; className: string }> = {
  "in-progress": {
    label: "In Progress",
    className: "bg-primary/20 text-primary border-primary/30",
  },
  planning: {
    label: "Planning",
    className: "bg-warning/20 text-warning border-warning/30",
  },
  completed: {
    label: "Completed",
    className: "bg-success/20 text-success border-success/30",
  },
  pending: {
    label: "Pending",
    className: "bg-muted text-muted-foreground border-muted",
  },
  approved: {
    label: "Approved",
    className: "bg-success/20 text-success border-success/30",
  },
  revision: {
    label: "Revision",
    className: "bg-warning/20 text-warning border-warning/30",
  },
};

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const config = statusConfig[status];

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium",
        config.className,
        className
      )}
    >
      {config.label}
    </span>
  );
}
