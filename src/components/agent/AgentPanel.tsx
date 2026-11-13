import { useRef, type KeyboardEvent, type PointerEvent } from "react";
import { useNavigate } from "react-router-dom";
import { Maximize2, Sparkles, X } from "lucide-react";
import { Composer } from "./Composer";
import { HistoryMenu } from "./HistoryMenu";
import { NewChatButton } from "./NewChatButton";
import { SUGGESTIONS } from "./AskHome";
import { ThreadView } from "./ThreadView";
import { useAgent } from "@/contexts/AgentContext";
import { PANEL_MAX_WIDTH, PANEL_MIN_WIDTH } from "@/lib/agent/panel";

const KEY_STEP = 24;

/** Right-hand Agent panel. Desktop: a resizable column. Mobile: a full-screen sheet. */
export function AgentPanel() {
  const agent = useAgent();
  const navigate = useNavigate();
  const dragStart = useRef<{ x: number; width: number } | null>(null);

  if (!agent.enabled || !agent.panelOpen) return null;

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture?.(e.pointerId);
    dragStart.current = { x: e.clientX, width: agent.panelWidth };
  };
  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    if (!dragStart.current) return;
    // The panel is on the right, so dragging left makes it wider.
    agent.setPanelWidth(dragStart.current.width + (dragStart.current.x - e.clientX));
  };
  const onPointerUp = () => {
    dragStart.current = null;
  };
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "ArrowLeft") agent.setPanelWidth(agent.panelWidth + KEY_STEP);
    if (e.key === "ArrowRight") agent.setPanelWidth(agent.panelWidth - KEY_STEP);
  };

  const expand = () => {
    agent.setPanelOpen(false);
    navigate("/chat"); // same provider, so the conversation carries over
  };

  const empty = agent.messages.length === 0;

  return (
    <>
    {/* Desktop: the panel is fixed to the right edge (it never scrolls with the page), so this
        invisible spacer keeps the page content from sliding underneath it. */}
    <div aria-hidden style={{ width: agent.panelWidth }} className="hidden shrink-0 md:block" />
    <aside
      aria-label="Agent"
      style={{ ["--agent-w" as string]: `${agent.panelWidth}px` }}
      className="fixed inset-0 z-40 flex flex-col bg-background md:inset-y-0 md:left-auto md:right-0 md:z-30 md:h-[100dvh] md:w-[var(--agent-w)] md:border-l"
    >
      <div
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize Agent panel"
        aria-valuemin={PANEL_MIN_WIDTH}
        aria-valuemax={PANEL_MAX_WIDTH}
        aria-valuenow={agent.panelWidth}
        tabIndex={0}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onKeyDown={onKeyDown}
        className="absolute -left-1 top-0 z-10 hidden h-full w-2 cursor-col-resize touch-none hover:bg-primary/30 focus-visible:bg-primary/40 md:block"
      />

      <header className="flex items-center justify-between border-b px-4 py-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          {/* <Sparkles className="h-4 w-4 text-primary" aria-hidden /> Agent */}
        </h2>
        <div className="flex items-center gap-1">
          <HistoryMenu />
          <NewChatButton onClick={agent.reset} />
          <button type="button" onClick={expand} aria-label="Open full page" className="hidden rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-primary/15 hover:text-primary md:block">
            <Maximize2 className="h-4 w-4" />
          </button>
          <button type="button" onClick={() => agent.setPanelOpen(false)} aria-label="Close Agent" className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-primary/15 hover:text-primary">
            <X className="h-4 w-4" />
          </button>
        </div>
      </header>

      {/* The faint tint gives the glass proposal cards something to blur. */}
      <div className="flex-1 overflow-y-auto bg-gradient-to-b from-primary/5 to-transparent px-4 py-4">
        {empty ? (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">Ask about your projects, tasks and deadlines.</p>
            <div className="hidden flex-wrap gap-2 md:flex" role="group" aria-label="Suggestions">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => agent.send(s)}
                  className="rounded-full border bg-card px-3 py-1.5 text-xs hover:border-primary/50 hover:bg-primary/5"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <ThreadView
            messages={agent.messages}
            streaming={agent.streaming}
            onResolveAction={agent.resolveAction}
            onRetry={agent.retry}
            onEdit={agent.editLast}
            onRate={agent.rate}
          />
        )}
      </div>

      <div className="border-t p-3">
        <Composer onSend={agent.send} onStop={agent.stop} streaming={agent.streaming} placeholder="Ask the Agent…" />
      </div>
    </aside>
    </>
  );
}
