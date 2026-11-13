import { cn } from "@/lib/utils";

// Fixed colours on purpose: a status keeps the same colour in light and dark mode, and the
// purple is the brand purple itself rather than the theme token.
const DOTS: Record<string, { label: string; color: string }> = {
  planning: { label: "Planning", color: "bg-red-500" },
  "in-progress": { label: "In Progress", color: "bg-[hsl(250_76%_63%)]" },
  completed: { label: "Completed", color: "bg-emerald-500" },
};

const UNKNOWN = { label: "Unknown", color: "bg-gray-400" };

/** A traffic-light circle for a project's status. The text lives in aria-label and the hover tooltip. */
export function StatusDot({ status, className }: { status: string; className?: string }) {
  const { label, color } = DOTS[status] ?? { ...UNKNOWN, label: status || UNKNOWN.label };
  return (
    <span
      role="img"
      aria-label={`Status: ${label}`}
      title={label}
      className={cn(
        "inline-block h-3.5 w-3.5 shrink-0 rounded-full shadow-sm ring-1 ring-black/10 dark:ring-white/25",
        color,
        className,
      )}
    />
  );
}
