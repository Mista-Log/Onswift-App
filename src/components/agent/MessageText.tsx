import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Renders a model reply: **bold**, *italic*, `code`, # headings, - / * bullets, 1. lists and | tables |.
 * Status words in table cells (Completed, In Progress, Overdue, Planning) get a coloured pill.
 *
 * It builds React elements directly and never parses or injects HTML, so a reply (or client text that
 * ends up in one) can only ever appear as text. Links and images are deliberately not supported:
 * `[x](url)` stays as typed. An unfinished marker, as seen mid-stream, also stays as typed.
 */

const INLINE = /(\*\*[^*\n]+\*\*|`[^`\n]+`|\*[^*\s][^*\n]*\*)/g;

export function renderInline(text: string): ReactNode[] {
  return text
    .split(INLINE)
    .filter((part) => part !== "")
    .map((part, i) => {
      if (part.length > 4 && part.startsWith("**") && part.endsWith("**")) {
        return <strong key={i} className="font-semibold">{part.slice(2, -2)}</strong>;
      }
      if (part.length > 2 && part.startsWith("`") && part.endsWith("`")) {
        return <code key={i} className="rounded bg-muted px-1 py-0.5 text-[0.85em]">{part.slice(1, -1)}</code>;
      }
      if (part.length > 2 && part.startsWith("*") && !part.startsWith("**") && part.endsWith("*")) {
        return <em key={i}>{part.slice(1, -1)}</em>;
      }
      return part;
    });
}

type Block =
  | { kind: "p"; lines: string[] }
  | { kind: "h"; text: string }
  | { kind: "ul" | "ol"; items: string[] }
  | { kind: "table"; head: string[]; rows: string[][] };

const SEPARATOR = /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/;

/** Split a table row on unescaped pipes, ignoring one leading and one trailing pipe. */
export function splitRow(line: string): string[] {
  const cells: string[] = [];
  let current = "";
  const text = line.trim();
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === "\\" && text[i + 1] === "|") {
      current += "|";
      i++;
    } else if (ch === "|") {
      cells.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  cells.push(current);
  if (text.startsWith("|")) cells.shift();
  if (text.endsWith("|") && !text.endsWith("\\|")) cells.pop();
  return cells.map((c) => c.trim());
}

const fit = (cells: string[], width: number) =>
  Array.from({ length: width }, (_, i) => cells[i] ?? "");

export function parseBlocks(text: string): Block[] {
  const blocks: Block[] = [];
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  let paragraph: Extract<Block, { kind: "p" }> | null = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trimEnd();
    if (!line.trim()) {
      paragraph = null;
      continue;
    }

    if (line.includes("|") && i + 1 < lines.length && SEPARATOR.test(lines[i + 1])) {
      const head = splitRow(line);
      if (head.length === splitRow(lines[i + 1]).length) {
        const rows: string[][] = [];
        i += 2;
        while (i < lines.length && lines[i].trim() && lines[i].includes("|")) {
          rows.push(fit(splitRow(lines[i]), head.length));
          i++;
        }
        i--; // the for loop steps past the last table line
        blocks.push({ kind: "table", head, rows });
        paragraph = null;
        continue;
      }
    }

    const heading = /^\s*#{1,3}\s+(.*)$/.exec(line);
    const bullet = /^\s*[*\-•]\s+(.*)$/.exec(line);
    const numbered = /^\s*\d+[.)]\s+(.*)$/.exec(line);

    if (heading) {
      blocks.push({ kind: "h", text: heading[1] });
      paragraph = null;
    } else if (bullet || numbered) {
      const kind = bullet ? "ul" : "ol";
      const item = (bullet ?? numbered)![1];
      const last = blocks[blocks.length - 1];
      if (last && last.kind === kind) last.items.push(item);
      else blocks.push({ kind, items: [item] });
      paragraph = null;
    } else if (paragraph) {
      paragraph.lines.push(line.trim());
    } else {
      paragraph = { kind: "p", lines: [line.trim()] };
      blocks.push(paragraph);
    }
  }
  return blocks;
}

const PILLS: Record<string, string> = {
  completed: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300",
  "in progress": "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300",
  "in-progress": "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300",
  overdue: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300",
  planning: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
};

const plain = (s: string) => s.replace(/[*_`]/g, "").trim();

/** "In Progress / Overdue" -> two pills. Returns null unless every part is a known status. */
function statusParts(cell: string): string[] | null {
  const parts = plain(cell).split("/").map((p) => p.trim()).filter(Boolean);
  return parts.length > 0 && parts.every((p) => PILLS[p.toLowerCase()]) ? parts : null;
}

function Cell({ text }: { text: string }) {
  const statuses = statusParts(text);
  if (!statuses) return <>{renderInline(text)}</>;
  return (
    <span className="flex flex-wrap gap-1">
      {statuses.map((s, i) => (
        <span
          key={i}
          className={cn("inline-block whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-medium", PILLS[s.toLowerCase()])}
        >
          {s}
        </span>
      ))}
    </span>
  );
}

export function MessageText({ text }: { text: string }) {
  return (
    <div className="space-y-2 break-words leading-relaxed">
      {parseBlocks(text).map((block, i) => {
        if (block.kind === "h") {
          return <p key={i} className="pt-1 font-semibold">{renderInline(block.text)}</p>;
        }
        if (block.kind === "table") {
          return (
            <div key={i} className="overflow-x-auto rounded-lg border">
              <table className="w-full border-collapse text-left text-xs">
                <thead className="bg-muted/60">
                  <tr>
                    {block.head.map((h, j) => (
                      <th key={j} scope="col" className="whitespace-nowrap px-3 py-2 font-semibold text-muted-foreground">
                        {renderInline(h)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {block.rows.map((row, k) => (
                    <tr key={k} className="border-t">
                      {row.map((cell, j) => (
                        <td key={j} className="px-3 py-2 align-top"><Cell text={cell} /></td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        }
        if ("items" in block) {
          const List = block.kind;
          return (
            <List key={i} className={block.kind === "ul" ? "list-disc space-y-1 pl-5" : "list-decimal space-y-1 pl-5"}>
              {block.items.map((item, j) => <li key={j}>{renderInline(item)}</li>)}
            </List>
          );
        }
        return (
          <p key={i}>
            {block.lines.map((line, j) => (
              <span key={j}>
                {j > 0 && <br />}
                {renderInline(line)}
              </span>
            ))}
          </p>
        );
      })}
    </div>
  );
}
