import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAuth } from "@/contexts/AuthContext";
import { secureFetch } from "@/api/apiClient";

interface ReportItem {
  id: string;
  name: string;
  project_id: string | null;
  project_name: string;
  deadline: string | null;
  kind: "project" | "personal";
  reason?: string;
}

interface Report {
  local_date: string;
  counts: { overdue: number; today: number; this_week: number; needs_action: number };
  overdue: ReportItem[];
  today: ReportItem[];
  this_week: ReportItem[];
  needs_action: ReportItem[];
  scheduled_today: boolean;
}

const checkedKey = (userId: string, date: string) => `daily-report-checked:${userId}:${date}`;
const clientDate = () => new Date().toLocaleDateString("en-CA");

function Section({
  title,
  items,
  tone,
  onOpen,
}: {
  title: string;
  items: ReportItem[];
  tone: string;
  onOpen: (item: ReportItem) => void;
}) {
  if (items.length === 0) return null;
  return (
    <div>
      <h3 className={`mb-1.5 text-sm font-semibold ${tone}`}>
        {title} ({items.length})
      </h3>
      <ul className="space-y-1">
        {items.map((item) => (
          <li key={`${item.kind}-${item.id}-${item.reason ?? ""}`}>
            <button
              type="button"
              onClick={() => onOpen(item)}
              className="flex w-full items-center justify-between gap-3 rounded-md px-2 py-1.5 text-left hover:bg-muted/60"
            >
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium text-foreground">{item.name}</span>
                <span className="block truncate text-xs text-muted-foreground">
                  {item.project_name}
                  {item.reason ? ` · ${item.reason}` : item.deadline ? ` · due ${item.deadline}` : ""}
                </span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Shows the daily report once, the first time the app is opened on a scheduled day. */
export function DailyReportDialog() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [report, setReport] = useState<Report | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!user || user.role === "client") return;
    const key = checkedKey(user.id, clientDate());
    try {
      if (localStorage.getItem(key)) return;
    } catch {
      // Storage unavailable: fall through and check once per mount.
    }

    let cancelled = false;
    (async () => {
      try {
        const res = await secureFetch("/api/v2/reminders/report/");
        if (!res.ok || cancelled) return;
        const data: Report = await res.json();
        try {
          localStorage.setItem(key, "1");
        } catch {
          // ignore
        }
        const total = Object.values(data.counts).reduce((a, b) => a + b, 0);
        if (data.scheduled_today && total > 0) {
          setReport(data);
          setOpen(true);
        }
      } catch (error) {
        console.error("Error loading daily report:", error);
      }
    })();
    return () => { cancelled = true; };
  }, [user?.id, user?.role]);

  if (!report) return null;

  const openItem = (item: ReportItem) => {
    setOpen(false);
    navigate(item.project_id ? `/projects/${item.project_id}` : "/dashboard");
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Your report for today</DialogTitle>
          <DialogDescription>Here's what's left across your projects.</DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <Section title="Overdue" items={report.overdue} tone="text-destructive" onOpen={openItem} />
          <Section title="Due today" items={report.today} tone="text-warning" onOpen={openItem} />
          <Section title="Due this week" items={report.this_week} tone="text-foreground" onOpen={openItem} />
          <Section title="Needs your action" items={report.needs_action} tone="text-primary" onOpen={openItem} />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => { setOpen(false); navigate("/calendar"); }}>
            View all deadlines
          </Button>
          <Button onClick={() => setOpen(false)}>Got it</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
