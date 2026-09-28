import { Loader2, WifiOff } from "lucide-react";
import { useSyncStatus } from "@/lib/syncQueue";

/**
 * Shows when task changes are still being saved, or when the device is offline (changes made
 * offline are stored on the device and sent automatically once the connection returns).
 * Renders nothing when everything is saved and online.
 */
export function SyncStatusPill() {
  const { pending, syncing, online } = useSyncStatus();

  if (online && pending === 0) return null;

  const offline = !online;
  const label = offline
    ? pending > 0
      ? `Offline · ${pending} change${pending === 1 ? "" : "s"} saved on this device`
      : "Offline"
    : syncing || pending > 0
    ? "Saving…"
    : "";

  return (
    <div
      role="status"
      aria-live="polite"
      title={label}
      className="flex max-w-[11rem] items-center gap-1.5 rounded-full border border-border/60 bg-secondary/60 px-2.5 py-1 text-xs text-muted-foreground sm:max-w-none"
    >
      {offline ? (
        <WifiOff className="h-3.5 w-3.5 flex-shrink-0 text-warning" />
      ) : (
        <Loader2 className="h-3.5 w-3.5 flex-shrink-0 animate-spin text-primary" />
      )}
      <span className="hidden truncate sm:inline">{label}</span>
      {pending > 0 && <span className="sm:hidden">{pending}</span>}
    </div>
  );
}
