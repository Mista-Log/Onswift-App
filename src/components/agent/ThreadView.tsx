import { useEffect, useRef, useState } from "react";
import { AlertCircle, Check, Loader2, Pencil, RotateCw, ThumbsDown, ThumbsUp } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ChatMessage, Rating } from "@/lib/agent/chatReducer";
import { toolLabel } from "@/lib/agent/toolLabels";
import { ActionConfirmCard } from "./ActionConfirmCard";
import { MessageText } from "./MessageText";

type OnResolve = (id: string, verb: "confirm" | "reject") => void;

/** Steps are progress, so they show while the reply is being written. Afterwards only failures stay, since those are news. */
function ToolSteps({ message, working }: { message: ChatMessage; working: boolean }) {
  const steps = working ? message.tools : message.tools.filter((t) => t.status === "failed");
  if (steps.length === 0) return null;
  return (
    <ul className="mb-2 space-y-1" aria-label="What the Agent looked at">
      {steps.map((t) => (
        <li key={t.id} className="flex items-center gap-2 text-xs text-muted-foreground">
          {t.status === "running" && <Loader2 className="h-3 w-3 animate-spin" aria-hidden />}
          {t.status === "done" && <Check className="h-3 w-3 text-primary" aria-hidden />}
          {t.status === "failed" && <AlertCircle className="h-3 w-3 text-destructive" aria-hidden />}
          <span>{toolLabel(t.name, t.status)}</span>
        </li>
      ))}
    </ul>
  );
}

const MAX_EDIT_LENGTH = 4000; // mirrors the server limit
const LOCKED_REASON = "You already confirmed a change in this reply, so it can't be redone.";

const iconButton =
  "inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-40";

/** The newest message, being rewritten. Saving replaces it and the reply to it. */
function EditBox({ initial, onSave, onCancel }: { initial: string; onSave: (text: string) => void; onCancel: () => void }) {
  const [draft, setDraft] = useState(initial);
  const ref = useRef<HTMLTextAreaElement>(null);
  const canSave = draft.trim().length > 0 && draft.length <= MAX_EDIT_LENGTH;

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.focus();
    el.setSelectionRange(el.value.length, el.value.length);
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  }, [draft]);

  const save = () => {
    if (canSave) onSave(draft.trim());
  };

  return (
    <div className="w-full max-w-[85%] rounded-2xl border bg-card p-2 shadow-sm">
      <textarea
        ref={ref}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Escape") onCancel();
          else if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
            e.preventDefault();
            save();
          }
        }}
        rows={1}
        aria-label="Edit your message"
        className="max-h-52 min-h-[2.25rem] w-full resize-none bg-transparent px-2 py-1.5 text-sm outline-none"
      />
      <div className="flex items-center justify-between gap-2 px-1 pt-1">
        <span className={cn("text-xs", draft.length > MAX_EDIT_LENGTH ? "text-destructive" : "text-muted-foreground")}>
          {draft.length > MAX_EDIT_LENGTH - 200 ? `${draft.length} / ${MAX_EDIT_LENGTH}` : "Replaces this message and its reply"}
        </span>
        <div className="flex gap-2">
          <button type="button" onClick={onCancel} className="rounded-md px-3 py-1 text-xs text-muted-foreground hover:bg-muted hover:text-foreground">
            Cancel
          </button>
          <button
            type="button"
            onClick={save}
            disabled={!canSave}
            className="rounded-md bg-primary px-3 py-1 text-xs font-medium text-primary-foreground disabled:opacity-50"
          >
            Save &amp; send
          </button>
        </div>
      </div>
    </div>
  );
}

interface BubbleProps {
  message: ChatMessage;
  isLast: boolean;
  /** The newest message from the user: the only one that can be edited. */
  isLastUser: boolean;
  streaming: boolean;
  /** The newest turn holds a change the user already confirmed, so it can't be redone. */
  locked: boolean;
  onResolve?: OnResolve;
  onRetry?: () => void;
  onEdit?: (text: string) => void;
  onRate?: (id: string, rating: Rating) => void;
}

function Bubble({ message, isLast, isLastUser, streaming, locked, onResolve, onRetry, onEdit, onRate }: BubbleProps) {
  const [editing, setEditing] = useState(false);

  if (message.role === "user") {
    if (editing && onEdit) {
      return (
        <div className="flex justify-end">
          <EditBox
            initial={message.content}
            onCancel={() => setEditing(false)}
            onSave={(text) => {
              setEditing(false);
              onEdit(text);
            }}
          />
        </div>
      );
    }
    return (
      <div className="group flex items-end justify-end gap-1">
        {onEdit && isLastUser && !streaming && (
          <button
            type="button"
            onClick={() => setEditing(true)}
            disabled={locked}
            title={locked ? LOCKED_REASON : "Edit message"}
            aria-label={locked ? `Edit message (unavailable: ${LOCKED_REASON})` : "Edit message"}
            className={cn(iconButton, "mb-1")}
          >
            <Pencil className="h-3.5 w-3.5" aria-hidden />
          </button>
        )}
        <div className="max-w-[85%] whitespace-pre-wrap break-words rounded-2xl rounded-br-md bg-primary/10 px-4 py-2.5 text-sm dark:bg-primary dark:text-primary-foreground">
          {message.content}
        </div>
      </div>
    );
  }

  const thinking = streaming && isLast && !message.content && message.tools.every((t) => t.status !== "running");
  // Controls wait until the reply is finished (or stopped, or failed): there is nothing to rate or redo before.
  const settled = !(streaming && isLast) && (!!message.content || !!message.error);
  const canRate = !!onRate && settled && !!message.content && !message.error && !message.id.startsWith("local-");
  const canRetry = !!onRetry && settled && isLast;
  const rating = message.rating ?? 0;
  const rate = (value: 1 | -1) => onRate?.(message.id, rating === value ? 0 : value);
  return (
    <div className="flex gap-3">
      
      <div className="min-w-0 flex-1 text-sm">
        <ToolSteps message={message} working={streaming && isLast} />
        {/* Markdown-style formatting, built as React elements: model and client text is never interpreted as HTML. */}
        {message.content && <MessageText text={message.content} />}
        {onResolve && message.actions?.map((a) => <ActionConfirmCard key={a.id} action={a} onResolve={onResolve} locked={streaming} />)}
        {thinking && (
          <p className="flex items-center gap-2 text-muted-foreground" role="status">
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> Thinking…
          </p>
        )}
        {message.error && (
          <p className={cn("flex items-start gap-2 text-destructive", message.content && "mt-2")} role="alert">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden /> {message.error}
          </p>
        )}
        {(canRate || canRetry) && (
          <div className="-ml-1.5 mt-2 flex items-center gap-0.5" role="group" aria-label="Reply actions">
            {canRate && (
              <>
                <button
                  type="button"
                  onClick={() => rate(1)}
                  aria-pressed={rating === 1}
                  aria-label="Good response"
                  title="Good response"
                  className={cn(iconButton, rating === 1 && "bg-primary/10 text-primary")}
                >
                  <ThumbsUp className={cn("h-3.5 w-3.5", rating === 1 && "fill-current")} aria-hidden />
                </button>
                <button
                  type="button"
                  onClick={() => rate(-1)}
                  aria-pressed={rating === -1}
                  aria-label="Bad response"
                  title="Bad response"
                  className={cn(iconButton, rating === -1 && "bg-destructive/10 text-destructive")}
                >
                  <ThumbsDown className={cn("h-3.5 w-3.5", rating === -1 && "fill-current")} aria-hidden />
                </button>
              </>
            )}
            {canRetry && (
              <button
                type="button"
                onClick={onRetry}
                disabled={locked}
                title={locked ? LOCKED_REASON : "Try again"}
                aria-label={locked ? `Try again (unavailable: ${LOCKED_REASON})` : "Try again"}
                className={iconButton}
              >
                <RotateCw className="h-3.5 w-3.5" aria-hidden />
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

interface ThreadViewProps {
  messages: ChatMessage[];
  streaming: boolean;
  /** Confirm or reject a proposed change. Without it, proposals are not shown (nothing could act on them). */
  onResolveAction?: OnResolve;
  /** Run the newest message again. Without it there is no Try again button. */
  onRetry?: () => void;
  /** Replace the newest user message with new text. Without it there is no Edit button. */
  onEdit?: (text: string) => void;
  /** Thumbs up / down on a reply. Without it there are no thumbs. */
  onRate?: (id: string, rating: Rating) => void;
  className?: string;
}

/** A change the user already confirmed cannot be undone, so that turn is not redone. */
function newestTurnIsLocked(messages: ChatMessage[], lastUserIndex: number): boolean {
  return messages
    .slice(lastUserIndex + 1)
    .some((m) => m.actions?.some((a) => a.status === "executed" || a.status === "confirmed" || a.busy));
}

export function ThreadView({ messages, streaming, onResolveAction, onRetry, onEdit, onRate, className }: ThreadViewProps) {
  const endRef = useRef<HTMLDivElement>(null);
  const lastUserIndex = messages.map((m) => m.role).lastIndexOf("user");
  const locked = lastUserIndex >= 0 && newestTurnIsLocked(messages, lastUserIndex);

  // Follow the newest text as it streams in.
  useEffect(() => {
    endRef.current?.scrollIntoView?.({ block: "end" });
  }, [messages]);

  return (
    <div className={cn("space-y-5", className)} role="log" aria-live="polite" aria-label="Conversation with the Agent">
      {messages.map((m, i) => (
        <Bubble
          key={m.id}
          message={m}
          isLast={i === messages.length - 1}
          isLastUser={i === lastUserIndex}
          streaming={streaming}
          locked={locked}
          onResolve={onResolveAction}
          onRetry={onRetry}
          onEdit={onEdit}
          onRate={onRate}
        />
      ))}
      <div ref={endRef} />
    </div>
  );
}
