import { SquarePen } from "lucide-react";
import { cn } from "@/lib/utils";

/** A purple rounded square showing a compose icon, which smoothly widens to show "New chat" on hover or keyboard focus. */
export function NewChatButton({ onClick, className }: { onClick: () => void; className?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="New chat"
      className={cn(
        "group inline-flex h-8 items-center justify-center rounded-lg bg-primary px-2 text-primary-foreground shadow-sm",
        "transition-colors duration-200 hover:bg-primary/90",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        className,
      )}
    >
      <SquarePen className="h-4 w-4 shrink-0" aria-hidden />
      <span
        className={cn(
          "max-w-0 overflow-hidden whitespace-nowrap text-xs font-medium opacity-0",
          "transition-all duration-200 ease-out motion-reduce:transition-none",
          "group-hover:ml-1.5 group-hover:max-w-[5rem] group-hover:opacity-100",
          "group-focus-visible:ml-1.5 group-focus-visible:max-w-[5rem] group-focus-visible:opacity-100",
        )}
      >
        New chat
      </span>
    </button>
  );
}
