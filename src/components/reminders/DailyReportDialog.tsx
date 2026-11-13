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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  /** The account has already been shown today's report (on any browser). */
  seen_today?: boolean;
}

const checkedKey = (userId: string, date: string) => `daily-report-checked:${userId}:${date}`;
const clientDate = () => new Date().toLocaleDateString("en-CA");

function ItemList({ items, onOpen }: { items: ReportItem[]; onOpen: (item: ReportItem) => void }) {
  return (
    <div>
      <ul className="space-y-1">
        {items.map((item) => (
          <li key={`${item.kind}-${item.id}-${item.reason ?? ""}`}>
            <button
              type="button"
              onClick={() => onOpen(item)}
              className="flex w-full min-w-0 items-center justify-between gap-3 rounded-md px-2 py-1.5 text-left hover:bg-muted/60"
            >
              <span className="min-w-0 flex-1">
                <span className="block whitespace-normal break-words text-sm font-medium text-foreground [overflow-wrap:anywhere]">{item.name}</span>
                <span className="block whitespace-normal break-words text-xs text-muted-foreground [overflow-wrap:anywhere]">
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
        // "Seen today" lives on the account. The browser note above only saves a request; if the browser
        // can't keep it (storage cleared, full, or a different browser), the account still says no.
        if (data.scheduled_today && total > 0 && !data.seen_today) {
          setReport(data);
          setOpen(true);
          secureFetch("/api/v2/reminders/report/", { method: "POST" }).catch(() => {
            // Not recorded: it may show once more on the next load.
          });
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

  // Each group that has something in it becomes a tab.
  const tabs = [
    { value: "overdue", title: "Overdue", items: report.overdue, tone: "text-destructive" },
    { value: "today", title: "Due today", items: report.today, tone: "text-warning" },
    { value: "week", title: "Due this week", items: report.this_week, tone: "text-foreground" },
    { value: "urgent", title: "Urgent", items: report.needs_action, tone: "text-primary" },
  ].filter((t) => t.items.length > 0);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="w-[calc(100vw-2rem)] max-w-lg max-h-[85vh] overflow-y-auto overflow-x-hidden">
        <DialogHeader>
          <DialogTitle>Your report for today</DialogTitle>
          <DialogDescription>Here's what's left across your projects.</DialogDescription>
        </DialogHeader>

        {tabs.length > 0 && (
          <Tabs defaultValue={tabs[0].value} className="w-full">
            <TabsList className="h-auto w-full flex-wrap justify-start">
              {tabs.map((t) => (
                <TabsTrigger key={t.value} value={t.value} className={t.tone}>
                  {t.title} ({t.items.length})
                </TabsTrigger>
              ))}
            </TabsList>
            {tabs.map((t) => (
              <TabsContent key={t.value} value={t.value} className="mt-3">
                <ItemList items={t.items} onOpen={openItem} />
              </TabsContent>
            ))}
          </Tabs>
        )}

        <DialogFooter className="flex-col-reverse gap-2 sm:flex-row">
          <Button variant="outline" className="w-full sm:w-auto" onClick={() => { setOpen(false); navigate("/calendar"); }}>
            View all deadlines
          </Button>
          <Button className="w-full sm:w-auto" onClick={() => setOpen(false)}>Got it</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
