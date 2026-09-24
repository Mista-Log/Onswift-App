import { useState } from "react";
import { X } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

const storageKey = (userId: string) => `creator-upsell-dismissed:${userId}`;

function readDismissed(userId: string): boolean {
  try {
    return localStorage.getItem(storageKey(userId)) === "1";
  } catch {
    return false;
  }
}

export function CreatorUpsellBar() {
  const { user } = useAuth();
  const [dismissedFor, setDismissedFor] = useState<string | null>(null);

  if (!user || user.role === "creator") return null;
  if (dismissedFor === user.id || readDismissed(user.id)) return null;

  const dismiss = () => {
    try {
      localStorage.setItem(storageKey(user.id), "1");
    } catch {
      // Storage unavailable: hide for this session only.
    }
    setDismissedFor(user.id);
  };

  return (
    <div className="relative w-full bg-primary text-white px-10 py-2 text-center text-sm">
      <span>
        Unlock the full Creator features on OnSwift.
      </span>{" "}
      <a
        href="/signup/creator"
        target="_blank"
        rel="noopener noreferrer"
        className="font-semibold underline underline-offset-2 whitespace-nowrap"
      >
        Get Started
      </a>
      <button
        type="button"
        aria-label="Dismiss"
        onClick={dismiss}
        className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-white/20 transition-colors"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
