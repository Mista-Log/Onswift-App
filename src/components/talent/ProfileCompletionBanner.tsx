import { X } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";

interface ProfileCompletionBannerProps {
  completionPercentage: number;
  /**
   * "card" (default): the ring with a short label, shown from tablet width up.
   * "header": just the ring, for the top bar beside the notification bell, shown on phones only.
   * Both can be on the page at once (CSS picks one), so closing either closes both.
   */
  variant?: "card" | "header";
}

const DISMISSED_EVENT = "onswift:profile-ring-dismissed";

// The card ring is 56px. The header ring is 36px: the same height as the other controls in the
// top bar (the bell's button is 40px around a 20px icon), so it sits in proportion beside them.
const RING = {
  card: { size: 56, stroke: 5, text: "text-xs", badge: "h-5 w-5", badgeIcon: "h-3 w-3" },
  header: { size: 36, stroke: 4, text: "text-[10px]", badge: "h-4 w-4", badgeIcon: "h-2.5 w-2.5" },
} as const;

// Remembered per user in this browser, so closing it sticks across reloads.
const dismissKey = (userId?: string) => `onswift_profile_ring_dismissed:${userId ?? "anon"}`;

function wasDismissed(userId?: string) {
  try {
    return localStorage.getItem(dismissKey(userId)) === "1";
  } catch {
    return false;
  }
}

/** A small progress ring nudging the talent to finish their profile. Links to the editor; closable for good. */
export function ProfileCompletionBanner({ completionPercentage, variant = "card" }: ProfileCompletionBannerProps) {
  const { user } = useAuth();
  const [dismissed, setDismissed] = useState(() => wasDismissed(user?.id));

  // The other copy on the page (the one hidden at this screen size) was just closed.
  useEffect(() => {
    const onDismissed = (e: Event) => {
      if ((e as CustomEvent<string | undefined>).detail === user?.id) setDismissed(true);
    };
    window.addEventListener(DISMISSED_EVENT, onDismissed);
    return () => window.removeEventListener(DISMISSED_EVENT, onDismissed);
  }, [user?.id]);

  if (dismissed || completionPercentage >= 100) return null;

  const pct = Math.max(0, Math.min(100, Math.round(completionPercentage)));
  const ring = RING[variant];
  const radius = (ring.size - ring.stroke) / 2;
  const circumference = 2 * Math.PI * radius;

  const close = () => {
    try {
      localStorage.setItem(dismissKey(user?.id), "1");
    } catch {
      // Storage blocked: it still closes for this visit.
    }
    setDismissed(true);
    window.dispatchEvent(new CustomEvent(DISMISSED_EVENT, { detail: user?.id }));
  };

  return (
    <div className={cn("items-center justify-end gap-3", variant === "header" ? "flex md:hidden" : "hidden md:flex")}>
      {variant === "card" && <p className="text-xs text-muted-foreground">Complete your profile</p>}
      <div className="relative shrink-0">
        <Link
          to="/profile/edit"
          aria-label={`Profile ${pct}% complete. Complete your profile`}
          className="block rounded-full transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          <svg width={ring.size} height={ring.size} viewBox={`0 0 ${ring.size} ${ring.size}`} className="-rotate-90" aria-hidden>
            <circle cx={ring.size / 2} cy={ring.size / 2} r={radius} fill="none" strokeWidth={ring.stroke} className="stroke-border" />
            <circle
              cx={ring.size / 2}
              cy={ring.size / 2}
              r={radius}
              fill="none"
              strokeWidth={ring.stroke}
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={circumference * (1 - pct / 100)}
              className="stroke-primary transition-[stroke-dashoffset] duration-500"
            />
          </svg>
          <span className={cn("absolute inset-0 flex items-center justify-center font-semibold text-foreground", ring.text)}>
            {pct}%
          </span>
        </Link>
        <button
          type="button"
          onClick={close}
          aria-label="Dismiss profile reminder"
          className={cn(
            "absolute -right-1 -top-1 flex items-center justify-center rounded-full border border-border bg-background text-muted-foreground shadow-sm transition-colors hover:text-foreground",
            ring.badge,
          )}
        >
          <X className={ring.badgeIcon} />
        </button>
      </div>
    </div>
  );
}
