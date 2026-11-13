import { useEffect, useMemo, useState } from "react";
import { History } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { useAgent } from "@/contexts/AgentContext";
import { useIsMobile } from "@/hooks/use-mobile";
import { useConversationHistory } from "@/hooks/useConversationHistory";
import { groupByDay, whenLabel } from "@/lib/agent/historyGroups";
import { cn } from "@/lib/utils";

const TRIGGER_CLASS =
  "rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-primary/15 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

/** Past conversations, grouped by day. Picking one reopens it so the user can carry on. */
export function HistoryMenu({ className }: { className?: string }) {
  const agent = useAgent();
  const isMobile = useIsMobile();
  const history = useConversationHistory();
  const [open, setOpen] = useState(false);
  const [openFailed, setOpenFailed] = useState(false);
  const { refresh } = history;

  // Fresh every time it opens, so a chat started a moment ago (and its title) is there.
  useEffect(() => {
    if (open) {
      setOpenFailed(false);
      refresh();
    }
  }, [open, refresh]);

  const groups = useMemo(() => groupByDay(history.items), [history.items]);

  const choose = async (id: string) => {
    if (id === agent.conversationId) {
      setOpen(false);
      return;
    }
    setOpenFailed(false);
    const opened = await agent.load(id);
    if (opened) setOpen(false);
    else setOpenFailed(true);
  };

  const list = (
    <div className="max-h-[60vh] overflow-y-auto p-2" aria-label="Past chats">
      {openFailed && (
        <p className="mb-2 rounded-md bg-destructive/10 px-3 py-2 text-xs text-destructive" role="alert">
          Couldn't open that chat. Please try again.
        </p>
      )}

      {history.loading && history.items.length === 0 && (
        <div className="space-y-2 p-1" role="status" aria-label="Loading chats">
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-9 w-full" />
        </div>
      )}

      {history.error && (
        <div className="space-y-2 p-3 text-sm" role="alert">
          <p className="text-muted-foreground">Couldn't load your chats.</p>
          <button type="button" onClick={() => refresh()} className="text-primary underline underline-offset-2 dark:text-purple-300">
            Try again
          </button>
        </div>
      )}

      {!history.loading && !history.error && history.items.length === 0 && (
        <p className="p-3 text-sm text-muted-foreground">No past chats yet.</p>
      )}

      {groups.map((group) => (
        <section key={group.label} aria-label={group.label} className="mb-2">
          <h3 className="px-3 py-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">{group.label}</h3>
          <ul>
            {group.items.map((c) => {
              const active = c.id === agent.conversationId;
              return (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => choose(c.id)}
                    aria-current={active ? "true" : undefined}
                    className={cn(
                      "flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left text-sm transition-colors hover:bg-primary/10",
                      active && "bg-primary/15 font-medium text-primary dark:text-purple-300",
                    )}
                  >
                    <span className="min-w-0 flex-1 truncate">{c.title.trim() || "Untitled chat"}</span>
                    <span className="shrink-0 text-xs text-muted-foreground">{whenLabel(c.updated_at)}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );

  if (isMobile) {
    return (
      <>
        <button type="button" aria-label="Chat history" onClick={() => setOpen(true)} className={cn(TRIGGER_CLASS, className)}>
          <History className="h-4 w-4" />
        </button>
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetContent side="left" className="w-[85vw] max-w-sm p-0">
            <SheetHeader className="border-b px-4 py-3 text-left">
              <SheetTitle className="text-base">Chat history</SheetTitle>
            </SheetHeader>
            {list}
          </SheetContent>
        </Sheet>
      </>
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button type="button" aria-label="Chat history" className={cn(TRIGGER_CLASS, className)}>
          <History className="h-4 w-4" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="border-b px-4 py-3 text-sm font-semibold">Chat history</div>
        {list}
      </PopoverContent>
    </Popover>
  );
}
