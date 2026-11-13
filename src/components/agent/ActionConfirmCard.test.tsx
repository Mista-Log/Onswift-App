import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { ActionConfirmCard } from "./ActionConfirmCard";
import { ThreadView } from "./ThreadView";
import { toolLabel } from "@/lib/agent/toolLabels";
import type { ActionView, ChatMessage } from "@/lib/agent/chatReducer";

const action = (over: Partial<ActionView> = {}): ActionView => ({
  id: "a1",
  tool: "create_task",
  summary: 'Add the task "Write copy" to "Alpha site", due 2026-12-01',
  arguments: { project_id: "11111111-1111-4111-8111-111111111111", name: "Write copy", deadline: "2026-12-01" },
  status: "pending",
  result: null,
  error: "",
  expires_at: null,
  ...over,
});

const card = (a: ActionView, onResolve = vi.fn()) => (
  <MemoryRouter>
    <ActionConfirmCard action={a} onResolve={onResolve} />
  </MemoryRouter>
);

describe("ActionConfirmCard", () => {
  it("shows exactly what will be created, without ids", () => {
    render(card(action()));
    expect(screen.getByText(/Add the task "Write copy"/)).toBeInTheDocument();
    expect(screen.getByText("Write copy", { selector: "dd" })).toBeInTheDocument();
    expect(screen.getByText("2026-12-01", { selector: "dd" })).toBeInTheDocument();
    expect(screen.queryByText(/11111111/)).not.toBeInTheDocument();
  });

  it("confirm and reject report the action id and the verb", async () => {
    const onResolve = vi.fn();
    render(card(action(), onResolve));
    await userEvent.click(screen.getByRole("button", { name: /confirm/i }));
    await userEvent.click(screen.getByRole("button", { name: /reject/i }));
    expect(onResolve).toHaveBeenNthCalledWith(1, "a1", "confirm");
    expect(onResolve).toHaveBeenNthCalledWith(2, "a1", "reject");
  });

  it("disables both buttons while a request is in flight", () => {
    render(card(action({ busy: true })));
    expect(screen.getByRole("button", { name: /confirm/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /reject/i })).toBeDisabled();
  });

  it("offers no buttons once the action is settled", () => {
    for (const status of ["executed", "rejected", "failed", "expired"] as const) {
      const { unmount } = render(card(action({ status })));
      expect(screen.queryByRole("button", { name: /confirm/i })).not.toBeInTheDocument();
      unmount();
    }
  });

  it("says it is done and links to the result", () => {
    render(card(action({ status: "executed", result: { link: "/projects/p1" } })));
    expect(screen.getByRole("link", { name: /open it/i })).toHaveAttribute("href", "/projects/p1");
  });

  it("never links outside the app, whatever the server sends", () => {
    for (const link of ["https://evil.example", "//evil.example", "javascript:alert(1)"]) {
      const { unmount } = render(card(action({ status: "executed", result: { link } })));
      expect(screen.queryByRole("link")).not.toBeInTheDocument();
      unmount();
    }
  });

  it("says nothing was changed when rejected", () => {
    render(card(action({ status: "rejected" })));
    expect(screen.getByText(/nothing was changed/i)).toBeInTheDocument();
  });

  it("shows why a change failed", () => {
    render(card(action({ status: "failed", error: "Project not found." })));
    expect(screen.getByRole("alert")).toHaveTextContent("Project not found.");
  });

  it("shows a proposed doc's title and its full multi-line content, without the project id", () => {
    render(
      card(
        action({
          tool: "create_doc",
          summary: 'Create the doc "Kickoff"',
          arguments: { title: "Kickoff", text: "# Goals\n- ship it", project_id: "22222222-2222-4222-8222-222222222222" },
        }),
      ),
    );
    expect(screen.getByText("Title")).toBeInTheDocument();
    expect(screen.getByText("Content")).toBeInTheDocument();
    const content = screen.getByText(/ship it/, { selector: "dd" });
    expect(content.textContent).toBe("# Goals\n- ship it");
    expect(content.className).toContain("whitespace-pre-wrap");
    expect(screen.queryByText(/22222222/)).not.toBeInTheDocument();
  });

  it("says a proposal expired", () => {
    render(card(action({ status: "expired" })));
    expect(screen.getByText(/expired/i)).toBeInTheDocument();
  });

  it("shows a problem from the last attempt and keeps the buttons usable", () => {
    render(card(action({ problem: "Couldn't reach the Agent." })));
    expect(screen.getByRole("alert")).toHaveTextContent("Couldn't reach the Agent.");
    expect(screen.getByRole("button", { name: /confirm/i })).toBeEnabled();
  });

  it("renders hostile text from the model as plain text", () => {
    const hostile = '<img src=x onerror="alert(1)">';
    const { container } = render(card(action({ summary: hostile, arguments: { name: hostile } })));
    expect(container.querySelector("img")).toBeNull();
  });
});

describe("ThreadView with proposals", () => {
  const reply = (actions: ActionView[]): ChatMessage => ({
    id: "m", role: "assistant", content: "Please confirm.", tools: [], actions,
  });

  it("shows a card under the reply that proposed it", () => {
    render(
      <MemoryRouter>
        <ThreadView streaming={false} messages={[reply([action()])]} onResolveAction={vi.fn()} />
      </MemoryRouter>,
    );
    expect(screen.getByRole("group", { name: /proposed change/i })).toBeInTheDocument();
  });

  it("shows no card when nothing can act on it", () => {
    render(
      <MemoryRouter>
        <ThreadView streaming={false} messages={[reply([action()])]} />
      </MemoryRouter>,
    );
    expect(screen.queryByRole("group", { name: /proposed change/i })).not.toBeInTheDocument();
  });

  it("locks the card while the reply is still streaming, and frees it when the reply ends", () => {
    const view = (streaming: boolean) => (
      <MemoryRouter>
        <ThreadView streaming={streaming} messages={[reply([action()])]} onResolveAction={vi.fn()} />
      </MemoryRouter>
    );
    const { rerender } = render(view(true));
    expect(screen.getByRole("button", { name: /confirm/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /reject/i })).toBeDisabled();
    rerender(view(false));
    expect(screen.getByRole("button", { name: /confirm/i })).toBeEnabled();
    expect(screen.getByRole("button", { name: /reject/i })).toBeEnabled();
  });
});

describe("ActionConfirmCard for a form or survey", () => {
  const form = (over: Record<string, unknown> = {}) =>
    action({
      tool: "create_form",
      summary: 'Create the form "Client feedback" with 3 questions',
      arguments: {
        title: "Client feedback",
        intro: "Thanks for working with us.",
        questions: [
          { label: "How would you rate the project?", type: "multiple_choice", options: ["1 - Poor", "5 - Excellent"] },
          { label: "What went well?", type: "long_answer", required: false },
          { label: "Your name", type: "short_answer" },
        ],
        ...over,
      },
    });

  it("shows the questions as a table with number, question, type and required columns", () => {
    render(card(form()));
    const table = screen.getByRole("table", { name: "Questions" });
    expect(within(table).getAllByRole("columnheader").map((h) => h.textContent)).toEqual(["#", "Question", "Type", "Required"]);
    const rows = within(table).getAllByRole("row").slice(1);
    expect(rows).toHaveLength(3);
    expect(rows[0]).toHaveTextContent("1How would you rate the project?");
    expect(rows[0]).toHaveTextContent("multiple choice");
    expect(rows[0]).toHaveTextContent("Required");
    expect(rows[1]).toHaveTextContent("long answer");
    expect(rows[1]).toHaveTextContent("Optional");
    expect(rows[2]).toHaveTextContent("short answer");
  });

  it("lists a multiple-choice question's options as choices", () => {
    render(card(form()));
    const choices = within(screen.getByRole("list", { name: "Choices" })).getAllByRole("listitem");
    expect(choices.map((c) => c.textContent)).toEqual(["1 - Poor", "5 - Excellent"]);
  });

  it("tints each type differently so kinds can be told apart", () => {
    render(card(form()));
    const tint = (name: string) => screen.getByText(name).className.match(/bg-\S+/)?.[0];
    expect(new Set([tint("multiple choice"), tint("long answer"), tint("short answer")]).size).toBe(3);
  });

  it("falls back to plain lines when questions are not question-shaped", () => {
    render(card(form({ questions: ["one", "two"] })));
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    expect(screen.getByText(/one/, { selector: "dd" })).toHaveTextContent("one two");
  });

  it("never shows [object Object]", () => {
    const { container } = render(card(form()));
    expect(container).not.toHaveTextContent("[object Object]");
  });

  it("labels the intro and questions rows", () => {
    render(card(form()));
    expect(screen.getByText("Welcome message")).toBeInTheDocument();
    expect(screen.getByText("Questions")).toBeInTheDocument();
    expect(screen.getByText("Thanks for working with us.", { selector: "dd" })).toBeInTheDocument();
  });

  it("shows hostile question text as plain text", () => {
    const { container } = render(
      card(form({ questions: [{ label: "<img src=x onerror=alert(1)>", type: "short_answer" }] })),
    );
    expect(container.querySelector("img")).toBeNull();
    expect(screen.getByText(/<img src=x onerror=alert\(1\)>/)).toBeInTheDocument();
  });

  it("opens the new form after it is created", () => {
    render(card({ ...form(), status: "executed", result: { link: "/forms/abc" } }));
    expect(screen.getByRole("link", { name: /open it/i })).toHaveAttribute("href", "/forms/abc");
  });
});

describe("ActionConfirmCard while the Agent is still writing", () => {
  it("disables Confirm and Reject and says why", () => {
    render(<MemoryRouter><ActionConfirmCard action={action()} onResolve={vi.fn()} locked /></MemoryRouter>);
    expect(screen.getByRole("button", { name: /confirm/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /reject/i })).toBeDisabled();
    expect(screen.getByText("You can confirm once the Agent finishes.")).toBeInTheDocument();
  });

  it("points both buttons at the explanation for assistive tech", () => {
    render(<MemoryRouter><ActionConfirmCard action={action()} onResolve={vi.fn()} locked /></MemoryRouter>);
    const hint = screen.getByText("You can confirm once the Agent finishes.");
    expect(screen.getByRole("button", { name: /confirm/i })).toHaveAttribute("aria-describedby", hint.id);
    expect(screen.getByRole("button", { name: /reject/i })).toHaveAttribute("aria-describedby", hint.id);
  });

  it("does nothing when a disabled button is clicked", async () => {
    const onResolve = vi.fn();
    render(<MemoryRouter><ActionConfirmCard action={action()} onResolve={onResolve} locked /></MemoryRouter>);
    await userEvent.click(screen.getByRole("button", { name: /confirm/i }));
    await userEvent.click(screen.getByRole("button", { name: /reject/i }));
    expect(onResolve).not.toHaveBeenCalled();
  });

  it("enables both buttons, with no hint, once the Agent has finished", () => {
    render(<MemoryRouter><ActionConfirmCard action={action()} onResolve={vi.fn()} locked={false} /></MemoryRouter>);
    expect(screen.getByRole("button", { name: /confirm/i })).toBeEnabled();
    expect(screen.getByRole("button", { name: /reject/i })).toBeEnabled();
    expect(screen.queryByText("You can confirm once the Agent finishes.")).not.toBeInTheDocument();
  });

  it("shows no hint on a card that is already resolved", () => {
    render(<MemoryRouter><ActionConfirmCard action={action({ status: "executed", result: { link: "/projects/p1" } })} onResolve={vi.fn()} locked /></MemoryRouter>);
    expect(screen.queryByText("You can confirm once the Agent finishes.")).not.toBeInTheDocument();
  });
});

describe("ActionConfirmCard look", () => {
  it("Reject is a red fill with white text, the same in light and dark mode", () => {
    render(card(action()));
    const reject = screen.getByRole("button", { name: /reject/i });
    expect(reject).toHaveClass("bg-red-600", "text-white");
    expect(reject.className).not.toMatch(/dark:bg-/); // no theme-specific colour that could differ
  });

  it("Confirm stays the brand purple, not red", () => {
    render(card(action()));
    const confirm = screen.getByRole("button", { name: /confirm/i });
    expect(confirm).toHaveClass("bg-primary");
    expect(confirm).not.toHaveClass("bg-red-600");
  });

  it("is a glass card that reports its state for the status edge", () => {
    render(card(action()));
    const group = screen.getByRole("group", { name: "Proposed change" });
    expect(group).toHaveClass("agent-glass");
    expect(group).toHaveAttribute("data-status", "pending");
  });

  it("shows 'Done' as a green badge and 'Open it' as a purple button, both with white text", () => {
    render(card(action({ status: "executed", result: { link: "/projects/p1" } })));
    expect(screen.getByRole("status")).toHaveClass("bg-green-700", "text-white");
    expect(screen.getByRole("status")).toHaveTextContent("Done");
    expect(screen.getByRole("link", { name: /open it/i })).toHaveClass("bg-primary", "text-white");
  });

  it("shows no 'Open it' button when the result has no in-app link", () => {
    render(card(action({ status: "executed", result: { link: "https://evil.example" } })));
    expect(screen.getByRole("status")).toHaveTextContent("Done");
    expect(screen.queryByRole("link", { name: /open it/i })).not.toBeInTheDocument();
  });

  it("shows an edit as a table of changes and hides the raw operations and ids", () => {
    const edit = action({
      tool: "update_form",
      summary: 'Change the form "Intake": add 1 question, remove 1 question',
      arguments: {
        form_id: "11111111-1111-4111-8111-111111111111",
        operations: [{ op: "add_question", label: "Budget?" }],
      },
      preview: [
        { change: "Add", label: "Budget?", type: "multiple_choice", detail: "$500 / $1,000" },
        { change: "Remove", label: "Old question" },
      ],
    });
    render(card(edit));
    const table = screen.getByRole("table", { name: "Changes" });
    expect(within(table).getAllByRole("row")).toHaveLength(3); // header + 2 changes
    expect(within(table).getByText("Add")).toBeInTheDocument();
    expect(within(table).getByText("Remove")).toBeInTheDocument();
    expect(within(table).getByText("multiple choice")).toBeInTheDocument();
    expect(within(table).getByText("$500 / $1,000")).toBeInTheDocument();
    expect(screen.queryByText(/add_question/)).not.toBeInTheDocument();
    expect(screen.queryByText(/11111111/)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /confirm/i })).toBeEnabled();
  });

  it("shows no changes table when there is no preview", () => {
    render(card(action()));
    expect(screen.queryByRole("table", { name: "Changes" })).not.toBeInTheDocument();
  });

  it("says a replaced proposal was replaced and offers no buttons", () => {
    render(card(action({ status: "superseded" })));
    expect(screen.getByRole("status")).toHaveTextContent("Replaced by a newer proposal. Nothing was changed.");
    expect(screen.queryByRole("button", { name: /confirm/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /reject/i })).not.toBeInTheDocument();
  });

  it("tracks the status as it changes", () => {
    render(card(action({ status: "executed", result: { link: "/projects/p1" } })));
    expect(screen.getByRole("group", { name: "Proposed change" })).toHaveAttribute("data-status", "executed");
  });
});

describe("toolLabel for changes", () => {
  it("says a write was prepared for approval, and words a failed one as a change not a read", () => {
    for (const name of ["create_project", "create_task", "update_task"]) {
      expect(toolLabel(name, "done")).toMatch(/for your approval/);
      expect(toolLabel(name, "failed")).toBe("Couldn't prepare that change");
    }
    expect(toolLabel("list_tasks", "failed")).toBe("Couldn't read that");
    expect(toolLabel("create_doc", "failed")).toBe("Couldn't prepare that change");
    expect(toolLabel("create_form", "done")).toMatch(/for your approval/);
    expect(toolLabel("create_form", "failed")).toBe("Couldn't prepare that change");
  });

  it("labels create_form while it works", () => {
    expect(toolLabel("create_form", "running")).toBe("Preparing a new form");
  });

  it("labels the newer tools instead of showing the raw name", () => {
    for (const name of ["get_analytics", "search_docs", "search_library", "create_doc", "list_notifications", "list_clients", "get_client"]) {
      for (const status of ["running", "done"] as const) {
        expect(toolLabel(name, status)).not.toBe(name.replace(/_/g, " "));
      }
    }
  });
});
