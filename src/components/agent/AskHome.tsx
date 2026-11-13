import { Sparkles } from "lucide-react";
import { greeting } from "@/lib/greeting";
import { Composer } from "./Composer";

/** Each chip maps to a tool the Agent really has, so they double as a first-run tour. */
export const SUGGESTIONS = [
  "Summarize my workspace",
  "What's due this week?",
  "Any overdue tasks?",
  "Draft a task for review",
] as const;

interface AskHomeProps {
  firstName?: string;
  onSend: (text: string) => void;
  onStop: () => void;
  streaming: boolean;
}

export function AskHome({ firstName, onSend, onStop, streaming }: AskHomeProps) {
  return (
    // Mobile: a full-height column, greeting centred in the free space and the input pinned to the bottom.
    // From md up: the original centred stack.
    <div className="mx-auto flex min-h-[calc(100dvh-6rem)] w-full max-w-2xl flex-col items-center gap-8 px-2 md:min-h-[70vh] md:justify-center">
      <div className="flex w-full flex-1 flex-col items-center justify-center text-center md:flex-none">
        {/* Mobile only. Both logos are in the page and CSS picks one, so there is no flash when the theme loads. */}
        <div className="mb-6 flex justify-center md:hidden">
          <img src="/onswift-purple-logo.png" alt="OnSwift" className="h-10 w-auto dark:hidden" />
          <img src="/onswift%20logo.png" alt="OnSwift" className="hidden h-10 w-auto dark:block" />
        </div>
        <p className="mb-3 inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.2em] text-primary">
          {/* <Sparkles className="h-3.5 w-3.5" aria-hidden /> Ask OnSwift */}
        </p>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          {greeting(firstName)}
        </h1>
      </div>

      <div className="w-full pb-[max(0.5rem,env(safe-area-inset-bottom))] md:pb-0">
        <Composer large onSend={onSend} onStop={onStop} streaming={streaming} />
      </div>

      <div className="hidden flex-wrap justify-center gap-2 md:flex" role="group" aria-label="Suggestions">
        {SUGGESTIONS.map((s) => (
          <button
            key={s}
            type="button"
            disabled={streaming}
            onClick={() => onSend(s)}
            className="rounded-full border bg-card px-4 py-2 text-sm text-foreground/80 shadow-sm transition-colors hover:border-primary/50 hover:bg-primary/5 disabled:opacity-50"
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}
