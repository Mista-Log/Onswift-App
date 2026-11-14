import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { ArrowUp, Sparkles, Square } from "lucide-react";
import { cn } from "@/lib/utils";
import { loadDraft, saveDraft } from "@/lib/agent/draft";

export const MAX_MESSAGE_LENGTH = 4000; // mirrors the server limit

interface ComposerProps {
  onSend: (text: string) => void;
  onStop: () => void;
  streaming: boolean;
  placeholder?: string;
  /** Larger pill used on the full-page home. */
  large?: boolean;
}

export function Composer({ onSend, onStop, streaming, placeholder, large }: ComposerProps) {
  // Starts from whatever was left unsent, and saves every change, so the text is still here after
  // opening another section or reloading (see lib/agent/draft).
  const [text, setTextState] = useState(loadDraft);
  const setText = (value: string) => {
    setTextState(value);
    saveDraft(value);
  };
  const ref = useRef<HTMLTextAreaElement>(null);
  const canSend = text.trim().length > 0 && text.length <= MAX_MESSAGE_LENGTH && !streaming;

  // Grow with the text, up to a cap, then scroll.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [text]);

  const submit = () => {
    if (!canSend) return;
    onSend(text.trim());
    setText("");
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    // Enter sends; Shift+Enter is a newline. Ignore Enter while an IME is composing.
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      submit();
    }
  };

  return (
    <div className="w-full">
      <div
        className={cn(
          "flex items-end gap-2 border bg-card shadow-sm transition-shadow focus-within:border-primary/60 focus-within:shadow-md",
          large ? "rounded-[28px] px-4 py-3" : "rounded-2xl px-3 py-2",
        )}
      >
        {/* <Sparkles className="mb-2 h-5 w-5 shrink-0 text-primary" aria-hidden /> */}
        <textarea
          ref={ref}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={onKeyDown}
          rows={1}
          aria-label="Message the Agent"
          placeholder={placeholder ?? "Ask anything about your projects, tasks..."}
          className="max-h-40 min-h-[2.25rem] flex-1 resize-none bg-transparent py-1.5 text-sm outline-none placeholder:text-muted-foreground"
        />
        {streaming ? (
          <button
            type="button"
            onClick={onStop}
            aria-label="Stop response"
            className="mb-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground"
          >
            <Square className="h-3.5 w-3.5 fill-current" />
          </button>
        ) : (
          <button
            type="button"
            onClick={submit}
            disabled={!canSend}
            aria-label="Send message"
            className={cn(
              "mb-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-colors",
              canSend ? "bg-primary text-primary-foreground" : "bg-primary/20 text-primary/60",
            )}
          >
            <ArrowUp className="h-4 w-4" />
          </button>
        )}
      </div>
      {text.length > MAX_MESSAGE_LENGTH - 200 && (
        <p className={cn("mt-1 px-3 text-xs", text.length > MAX_MESSAGE_LENGTH ? "text-destructive" : "text-muted-foreground")}>
          {text.length} / {MAX_MESSAGE_LENGTH}
        </p>
      )}
      <p className="mt-2 text-center text-xs text-muted-foreground">AI can make mistakes. Double-check replies.</p>
    </div>
  );
}
