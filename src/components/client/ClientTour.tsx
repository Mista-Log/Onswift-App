import { useCallback, useEffect } from "react";
import { driver, type DriveStep } from "driver.js";
import "driver.js/dist/driver.css";
import { Compass } from "lucide-react";
import { secureFetch } from "@/api/apiClient";

interface ClientTourProps {
  /** "auto" runs once per account (until client_tour_done_at is set); "link" is the replay button. */
  variant: "auto" | "link";
  /** The Portfolio tab only exists when the creator shares their profile. */
  hasPortfolio?: boolean;
}

// Only steps whose anchor is on screen are shown, so the tour adapts to an empty project.
function buildSteps(hasPortfolio: boolean): DriveStep[] {
  const steps: (DriveStep & { element: string })[] = [
    {
      element: '[data-tour="project-header"]',
      popover: {
        title: "Welcome to your project",
        description: "This is where you follow the work being done for you, from start to finish.",
      },
    },
    {
      element: '[data-tour="progress"]',
      popover: {
        title: "Track progress",
        description: "The bar fills up as tasks are completed and approved for you to see.",
      },
    },
    {
      element: '[data-tour="tasks"]',
      popover: {
        title: "Completed work",
        description: "Every task your creator finishes and approves appears here. You'll get a notification too.",
      },
    },
    {
      element: '[data-tour="first-task"]',
      popover: {
        title: "Open a task and give feedback",
        description:
          "Click any task to see the details, files and checklists, and leave feedback. Your creator replies right there.",
      },
    },
    {
      element: '[data-tour="deliverables"]',
      popover: {
        title: "Deliverables",
        description: "All the files delivered for this project, ready to download.",
      },
    },
    ...(hasPortfolio
      ? [
          {
            element: '[data-tour="portfolio"]',
            popover: {
              title: "Portfolio",
              description: "See more of your creator's work, and what else you could do together.",
            },
          },
        ]
      : []),
    {
      element: '[data-tour="chat"]',
      popover: {
        title: "Questions? Send a message",
        description: "Chat with your creator any time. You can replay this tour from the link below.",
      },
    },
  ];
  return steps.filter((s) => typeof document !== "undefined" && document.querySelector(s.element));
}

function markDone() {
  secureFetch("/api/v1/settings/", {
    method: "PATCH",
    body: JSON.stringify({ client_tour_done_at: new Date().toISOString() }),
  }).catch(() => {
    /* Not critical: worst case the tour shows once more. */
  });
}

export function ClientTour({ variant, hasPortfolio = false }: ClientTourProps) {
  const start = useCallback(
    (remember: boolean) => {
      const steps = buildSteps(hasPortfolio);
      if (!steps.length) return;
      const tour = driver({
        showProgress: true,
        allowClose: true,
        nextBtnText: "Next",
        prevBtnText: "Back",
        doneBtnText: "Got it",
        steps,
        // Finishing or closing early both count: the tour shouldn't nag.
        onDestroyed: () => {
          if (remember) markDone();
        },
      });
      tour.drive();
    },
    [hasPortfolio],
  );

  useEffect(() => {
    if (variant !== "auto") return;
    let cancelled = false;
    secureFetch("/api/v1/settings/")
      .then((res) => (res.ok ? res.json() : null))
      .then((settings) => {
        if (cancelled || !settings || settings.client_tour_done_at) return;
        // Let the page finish laying out so every anchor is in place.
        window.setTimeout(() => !cancelled && start(true), 400);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [variant, start]);

  if (variant === "auto") return null;

  return (
    <button
      type="button"
      onClick={() => start(false)}
      className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
    >
      <Compass className="h-3.5 w-3.5" />
      Take the tour
    </button>
  );
}
