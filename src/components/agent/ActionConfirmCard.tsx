import { AlertCircle, Check, Loader2, X } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import type { ActionView } from "@/lib/agent/chatReducer";
import type { PreviewItem } from "@/lib/agent/sse";

interface ActionConfirmCardProps {
  action: ActionView;
  onResolve: (id: string, verb: "confirm" | "reject") => void;
  /** The Agent is still writing its reply: Confirm and Reject wait until it has finished. */
  locked?: boolean;
}

const FIELD_LABELS: Record<string, string> = {
  name: "Name",
  title: "Title",
  text: "Content",
  description: "Description",
  due_date: "Due",
  deadline: "Due",
  priority: "Priority",
  status: "Status",
  intro: "Welcome message",
  questions: "Questions",
};

const QUESTION_TYPES: Record<string, string> = {
  short_answer: "short answer",
  long_answer: "long answer",
  multiple_choice: "multiple choice",
  checkbox: "tick box",
  file_upload: "file upload",
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

// A soft tint per question type so a column of questions can be scanned by kind. Text keeps the
// normal foreground colour, so contrast does not depend on the tint.
const TYPE_TINTS: Record<string, string> = {
  short_answer: "bg-sky-500/15",
  long_answer: "bg-indigo-500/15",
  multiple_choice: "bg-violet-500/15",
  checkbox: "bg-fuchsia-500/15",
  file_upload: "bg-amber-500/20",
};

type Question = Record<string, unknown>;

/** The questions as table rows, or null when the list is not made of question-shaped items. */
function asQuestions(value: unknown): Question[] | null {
  return Array.isArray(value) && value.length > 0 && value.every(isRecord) ? value : null;
}

/** Lists of plain things read as lines, never as "[object Object]". */
function formatValue(value: unknown): string {
  if (Array.isArray(value)) return value.map((item) => (isRecord(item) ? JSON.stringify(item) : String(item))).join("\n");
  return String(value);
}

/** What the user is about to approve, field by field. Ids are plumbing, so they are left out. */
function detailRows(args: Record<string, unknown>): Array<[string, string]> {
  return Object.entries(args)
    .filter(([key, value]) => !key.endsWith("_id") && !key.endsWith("_ids") && value !== null && value !== undefined && value !== "")
    .filter(([key, value]) => !(key === "questions" && asQuestions(value)))
    .filter(([key]) => key !== "operations" && key !== "allow_duplicate") // plumbing: the preview says it in words
    .map(([key, value]) => [FIELD_LABELS[key] ?? key.replace(/_/g, " "), formatValue(value)]);
}

/** A form's questions as a table: number, question (with its choices), type, required. */
function QuestionTable({ questions }: { questions: Question[] }) {
  return (
    <div className="mt-3 max-h-64 overflow-auto rounded-lg border border-border/60">
      <table className="w-full min-w-[22rem] border-collapse text-left text-xs">
        <caption className="sr-only">Questions</caption>
        <thead className="sticky top-0 bg-background/80 text-muted-foreground backdrop-blur">
          <tr>
            <th scope="col" className="w-8 px-2 py-1.5 font-medium">#</th>
            <th scope="col" className="px-2 py-1.5 font-medium">Question</th>
            <th scope="col" className="px-2 py-1.5 font-medium">Type</th>
            <th scope="col" className="px-2 py-1.5 font-medium">Required</th>
          </tr>
        </thead>
        <tbody>
          {questions.map((q, i) => {
            const type = String(q.type ?? "");
            const options = Array.isArray(q.options) ? q.options.map(String) : [];
            return (
              <tr key={i} className="border-t border-border/60 align-top">
                <td className="px-2 py-1.5 text-muted-foreground">{i + 1}</td>
                <td className="px-2 py-1.5">
                  <span className="break-words">{String(q.label ?? "")}</span>
                  {options.length > 0 && (
                    <ul className="mt-1 flex flex-wrap gap-1" aria-label="Choices">
                      {options.map((o, j) => (
                        <li key={j} className="rounded border border-border/60 px-1.5 py-0.5 text-[11px]">{o}</li>
                      ))}
                    </ul>
                  )}
                </td>
                <td className="px-2 py-1.5">
                  <span className={`whitespace-nowrap rounded-full px-2 py-0.5 ${TYPE_TINTS[type] ?? "bg-muted"}`}>
                    {QUESTION_TYPES[type] ?? type}
                  </span>
                </td>
                <td className="whitespace-nowrap px-2 py-1.5">{q.required === false ? "Optional" : "Required"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// One tint per kind of change, like the question-type pills. Text stays the normal colour.
const CHANGE_TINTS: Record<string, string> = {
  Add: "bg-green-500/20",
  Change: "bg-sky-500/20",
  Remove: "bg-red-500/20",
  Move: "bg-violet-500/20",
};

/** What an edit will do, one row per change: the kind of change, which question, and the details. */
function ChangeTable({ items }: { items: PreviewItem[] }) {
  return (
    <div className="mt-3 max-h-64 overflow-auto rounded-lg border border-border/60">
      <table className="w-full min-w-[22rem] border-collapse text-left text-xs">
        <caption className="sr-only">Changes</caption>
        <thead className="sticky top-0 bg-background/80 text-muted-foreground backdrop-blur">
          <tr>
            <th scope="col" className="px-2 py-1.5 font-medium">Change</th>
            <th scope="col" className="px-2 py-1.5 font-medium">Question</th>
            <th scope="col" className="px-2 py-1.5 font-medium">Details</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, i) => (
            <tr key={i} className="border-t border-border/60 align-top">
              <td className="px-2 py-1.5">
                <span className={`whitespace-nowrap rounded-full px-2 py-0.5 ${CHANGE_TINTS[item.change] ?? "bg-muted"}`}>
                  {item.change}
                </span>
              </td>
              <td className="px-2 py-1.5">
                <span className="break-words">{item.label}</span>
                {item.type && (
                  <span className={`ml-1.5 whitespace-nowrap rounded-full px-2 py-0.5 ${TYPE_TINTS[item.type] ?? "bg-muted"}`}>
                    {QUESTION_TYPES[item.type] ?? item.type}
                  </span>
                )}
              </td>
              <td className="break-words px-2 py-1.5 text-muted-foreground">{item.detail}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Only in-app paths: the link comes from the server, but a card should never open anything else. */
const isAppPath = (link: unknown): link is string =>
  typeof link === "string" && link.startsWith("/") && !link.startsWith("//");

export function ActionConfirmCard({ action, onResolve, locked = false }: ActionConfirmCardProps) {
  const rows = detailRows(action.arguments);
  const questions = asQuestions(action.arguments.questions);
  const working = action.busy || action.status === "confirmed";
  const link = action.result?.link;
  const waiting = locked && !working;
  const hintId = `lock-hint-${action.id}`;

  return (
    <div className="agent-glass mt-3 p-3 text-sm" data-status={action.status} role="group" aria-label="Proposed change">
      <p className="break-words font-medium">{action.summary}</p>

      {rows.length > 0 && (
        <dl className="mt-2 grid grid-cols-[auto,1fr] gap-x-3 gap-y-1 text-xs">
          {rows.map(([label, value]) => (
            <div key={label} className="contents">
              <dt className="text-muted-foreground">{label}</dt>
              <dd className="max-h-40 overflow-y-auto whitespace-pre-wrap break-words">{value}</dd>
            </div>
          ))}
        </dl>
      )}

      {questions && <QuestionTable questions={questions} />}
      {action.preview && action.preview.length > 0 && <ChangeTable items={action.preview} />}

      {action.status === "pending" && (
        <div className="mt-3 flex items-center gap-2">
          <Button
            size="sm"
            disabled={working || locked}
            aria-describedby={waiting ? hintId : undefined}
            onClick={() => onResolve(action.id, "confirm")}
          >
            {working ? (
              <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" aria-hidden />
            ) : (
              <Check className="mr-1 h-3.5 w-3.5" aria-hidden />
            )}
            Confirm
          </Button>
          {/* Fixed red-600 with white text in both themes: the destructive token is only ~3.8:1 against white. */}
          <Button
            size="sm"
            disabled={working || locked}
            aria-describedby={waiting ? hintId : undefined}
            onClick={() => onResolve(action.id, "reject")}
            className="bg-red-600 text-white hover:bg-red-700 focus-visible:ring-red-500"
          >
            <X className="mr-1 h-3.5 w-3.5" aria-hidden /> Reject
          </Button>
        </div>
      )}

      {action.status === "pending" && waiting && (
        <p id={hintId} className="mt-2 text-xs text-muted-foreground">
          You can confirm once the Agent finishes.
        </p>
      )}

      {action.status === "confirmed" && (
        <p className="mt-3 flex items-center gap-2 text-muted-foreground" role="status">
          <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> Working on it…
        </p>
      )}

      {action.status === "executed" && (
        // White on green-700 (~5.0:1) and on the brand purple (~4.9:1), in both themes.
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <p
            className="inline-flex items-center gap-1.5 rounded-md bg-green-700 px-3 py-1.5 text-xs font-medium text-white"
            role="status"
          >
            <Check className="h-3.5 w-3.5" aria-hidden /> Done
          </p>
          {isAppPath(link) && (
            <Link
              to={link}
              className="inline-flex items-center rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              Open it
            </Link>
          )}
        </div>
      )}

      {action.status === "rejected" && (
        <p className="mt-3 text-muted-foreground" role="status">
          Rejected. Nothing was changed.
        </p>
      )}

      {action.status === "superseded" && (
        <p className="mt-3 text-muted-foreground" role="status">
          Replaced by a newer proposal. Nothing was changed.
        </p>
      )}

      {action.status === "expired" && (
        <p className="mt-3 text-muted-foreground" role="status">
          This proposal expired. Ask the Agent again if you still want it.
        </p>
      )}

      {action.status === "failed" && (
        <p className="mt-3 flex items-start gap-2 text-destructive" role="alert">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          Not done{action.error ? `: ${action.error}` : "."} Nothing was changed.
        </p>
      )}

      {action.problem && (
        <p className="mt-2 flex items-start gap-2 text-destructive" role="alert">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden /> {action.problem}
        </p>
      )}
    </div>
  );
}
