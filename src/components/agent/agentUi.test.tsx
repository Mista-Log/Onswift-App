import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { clearDraft } from "@/lib/agent/draft";
import { AskHome, SUGGESTIONS } from "./AskHome";
import { Composer, MAX_MESSAGE_LENGTH } from "./Composer";
import { ThreadView } from "./ThreadView";
import { toolLabel } from "@/lib/agent/toolLabels";
import type { ChatMessage } from "@/lib/agent/chatReducer";

const noop = () => {};

describe("Composer", () => {
  // Unsent text is now remembered between visits, so each test starts from an empty box.
  beforeEach(() => {
    clearDraft();
  });

  it("disables send until there is text", async () => {
    render(<Composer onSend={noop} onStop={noop} streaming={false} />);
    const send = screen.getByRole("button", { name: /send message/i });
    expect(send).toBeDisabled();
    await userEvent.type(screen.getByLabelText(/message the agent/i), "hello");
    expect(send).toBeEnabled();
  });

  it("does not send blank text", async () => {
    const onSend = vi.fn();
    render(<Composer onSend={onSend} onStop={noop} streaming={false} />);
    await userEvent.type(screen.getByLabelText(/message the agent/i), "   {Enter}");
    expect(onSend).not.toHaveBeenCalled();
  });

  it("sends trimmed text on Enter and clears the box", async () => {
    const onSend = vi.fn();
    render(<Composer onSend={onSend} onStop={noop} streaming={false} />);
    const box = screen.getByLabelText(/message the agent/i);
    await userEvent.type(box, "  what is due?  {Enter}");
    expect(onSend).toHaveBeenCalledWith("what is due?");
    expect(box).toHaveValue("");
  });

  it("Shift+Enter adds a new line instead of sending", async () => {
    const onSend = vi.fn();
    render(<Composer onSend={onSend} onStop={noop} streaming={false} />);
    const box = screen.getByLabelText(/message the agent/i);
    await userEvent.type(box, "line one{Shift>}{Enter}{/Shift}line two");
    expect(onSend).not.toHaveBeenCalled();
    expect(box).toHaveValue("line one\nline two");
  });

  it("refuses text over the server limit and shows the count", () => {
    const onSend = vi.fn();
    render(<Composer onSend={onSend} onStop={noop} streaming={false} />);
    const box = screen.getByLabelText(/message the agent/i);
    fireEvent.change(box, { target: { value: "x".repeat(MAX_MESSAGE_LENGTH + 1) } });
    expect(screen.getByRole("button", { name: /send message/i })).toBeDisabled();
    expect(screen.getByText(new RegExp(`${MAX_MESSAGE_LENGTH + 1} / ${MAX_MESSAGE_LENGTH}`))).toBeInTheDocument();
  });

  it("shows a stop button while streaming, and it calls onStop", async () => {
    const onStop = vi.fn();
    render(<Composer onSend={noop} onStop={onStop} streaming />);
    expect(screen.queryByRole("button", { name: /send message/i })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /stop response/i }));
    expect(onStop).toHaveBeenCalled();
  });
});

describe("AskHome", () => {
  it("shows the four suggestion chips", () => {
    render(<AskHome onSend={noop} onStop={noop} streaming={false} />);
    expect(SUGGESTIONS).toHaveLength(4);
    SUGGESTIONS.forEach((s) => expect(screen.getByRole("button", { name: s })).toBeInTheDocument());
  });

  it("sends the chip's text when clicked", async () => {
    const onSend = vi.fn();
    render(<AskHome onSend={onSend} onStop={noop} streaming={false} />);
    await userEvent.click(screen.getByRole("button", { name: "What's due this week?" }));
    expect(onSend).toHaveBeenCalledWith("What's due this week?");
  });

  it("disables the chips while a reply is streaming", () => {
    render(<AskHome onSend={noop} onStop={noop} streaming />);
    expect(screen.getByRole("button", { name: "Any overdue tasks?" })).toBeDisabled();
  });

  describe("on a phone", () => {
    const home = () => render(<AskHome onSend={noop} onStop={noop} streaming={false} />);

    it("shows the logo in a mobile-only block, with a light and a dark version so CSS can pick by theme", () => {
      const { container } = home();
      const [light, dark] = Array.from(container.querySelectorAll("img"));
      expect(container.querySelectorAll("img")).toHaveLength(2);
      expect(light).toHaveAttribute("src", "/onswift-purple-logo.png");
      expect(light).toHaveClass("dark:hidden");
      expect(dark).toHaveAttribute("src", "/onswift%20logo.png");
      expect(dark).toHaveClass("hidden", "dark:block");
      expect(light.parentElement).toBe(dark.parentElement);
      expect(light.parentElement).toHaveClass("md:hidden");
    });

    it("puts the logo above the greeting", () => {
      const { container } = home();
      const logo = container.querySelector("img")!;
      const heading = screen.getByRole("heading", { level: 1 });
      expect(logo.compareDocumentPosition(heading) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    });

    it("hides the suggestion chips on mobile and keeps them from medium screens up", () => {
      home();
      const chips = screen.getByRole("group", { name: "Suggestions" });
      expect(chips).toHaveClass("hidden", "md:flex");
    });

    it("centres the greeting in the free space and pins the input to the bottom", () => {
      const { container } = home();
      const root = container.firstElementChild!;
      const [greeting, composer] = Array.from(root.children);
      expect(root).toHaveClass("flex-col", "min-h-[calc(100dvh-6rem)]");
      expect(greeting).toHaveClass("flex-1", "justify-center");
      expect(greeting).toContainElement(screen.getByRole("heading", { level: 1 }));
      expect(composer).toContainElement(screen.getByRole("textbox", { name: "Message the Agent" }));
      expect(composer.className).toContain("env(safe-area-inset-bottom)");
      expect(screen.getByText("AI can make mistakes. Double-check replies.")).toBeInTheDocument();
    });

    it("keeps the centred stack from medium screens up", () => {
      const { container } = home();
      expect(container.firstElementChild).toHaveClass("md:min-h-[70vh]", "md:justify-center");
      expect(container.firstElementChild!.children[0]).toHaveClass("md:flex-none");
    });
  });

  describe("greeting", () => {
    afterEach(() => vi.useRealTimers());

    it("shows the time-of-day greeting with the first name", () => {
      vi.useFakeTimers({ now: new Date(2026, 9, 14, 14, 0) }); // 2pm: an "afternoon" line
      render(<AskHome firstName="Ada" onSend={noop} onStop={noop} streaming={false} />);
      expect(screen.getByRole("heading")).toHaveTextContent("Ada");
      expect(screen.getByRole("heading")).not.toHaveTextContent("What can I help with");
    });

    it("changes with the part of the day", () => {
      vi.useFakeTimers({ now: new Date(2026, 9, 14, 9, 0) });
      const { unmount } = render(<AskHome firstName="Ada" onSend={noop} onStop={noop} streaming={false} />);
      const morning = screen.getByRole("heading").textContent;
      unmount();
      vi.setSystemTime(new Date(2026, 9, 14, 19, 0));
      render(<AskHome firstName="Ada" onSend={noop} onStop={noop} streaming={false} />);
      expect(screen.getByRole("heading").textContent).not.toBe(morning);
    });

    it("works without a name", () => {
      vi.useFakeTimers({ now: new Date(2026, 9, 14, 14, 0) });
      render(<AskHome onSend={noop} onStop={noop} streaming={false} />);
      expect(screen.getByRole("heading").textContent).not.toMatch(/\{name\}|undefined/);
    });
  });
});

describe("ThreadView", () => {
  const msg = (over: Partial<ChatMessage>): ChatMessage => ({ id: "m", role: "assistant", content: "", tools: [], ...over });

  it("renders text as plain text, never as HTML", () => {
    const hostile = '<img src=x onerror="alert(1)"><b>bold</b>';
    const { container } = render(<ThreadView streaming={false} messages={[msg({ content: hostile })]} />);
    expect(container.querySelector("img")).toBeNull();
    expect(container.querySelector("b")).toBeNull();
    expect(screen.getByText(hostile)).toBeInTheDocument();
  });

  it("shows the user's message in a purple bubble with white text in dark mode", () => {
    render(<ThreadView streaming={false} messages={[msg({ role: "user", id: "u", content: "what is due?" })]} />);
    const bubble = screen.getByText("what is due?");
    expect(bubble).toHaveClass("dark:bg-primary", "dark:text-primary-foreground");
    expect(bubble).toHaveClass("bg-primary/10"); // light mode keeps its soft tint
  });

  it("shows Thinking… on an empty reply that is streaming", () => {
    render(<ThreadView streaming messages={[msg({ role: "user", id: "u", content: "hi" }), msg({ id: "a" })]} />);
    expect(screen.getByRole("status")).toHaveTextContent(/thinking/i);
  });

  it("does not show Thinking… once text has arrived", () => {
    render(<ThreadView streaming messages={[msg({ content: "Here you go" })]} />);
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("shows tool steps in plain language, running then done", () => {
    const { rerender } = render(
      <ThreadView streaming messages={[msg({ tools: [{ id: "t", name: "list_deadlines", status: "running" }] })]} />,
    );
    expect(screen.getByText("Checking your deadlines")).toBeInTheDocument();
    rerender(<ThreadView streaming messages={[msg({ tools: [{ id: "t", name: "list_deadlines", status: "done" }] })]} />);
    expect(screen.getByText("Checked your deadlines")).toBeInTheDocument();
  });

  it("clears the steps away once the reply has finished", () => {
    const steps = [{ id: "t", name: "list_deadlines", status: "done" as const }];
    const { rerender } = render(<ThreadView streaming messages={[msg({ content: "Here you go.", tools: steps })]} />);
    expect(screen.getByText("Checked your deadlines")).toBeInTheDocument();
    rerender(<ThreadView streaming={false} messages={[msg({ content: "Here you go.", tools: steps })]} />);
    expect(screen.queryByText("Checked your deadlines")).not.toBeInTheDocument();
    expect(screen.getByText("Here you go.")).toBeInTheDocument();
  });

  it("only the reply being written shows its steps; earlier replies stay tidy", () => {
    const done = [{ id: "t", name: "list_deadlines", status: "done" as const }];
    const running = [{ id: "u", name: "list_projects", status: "running" as const }];
    render(
      <ThreadView
        streaming
        messages={[msg({ id: "old", content: "Earlier answer.", tools: done }), msg({ id: "new", tools: running })]}
      />,
    );
    expect(screen.queryByText("Checked your deadlines")).not.toBeInTheDocument();
    expect(screen.getByText("Looking through your projects")).toBeInTheDocument();
  });

  it("keeps a step that failed, because that is news the user may need", () => {
    const tools = [
      { id: "a", name: "list_deadlines", status: "done" as const },
      { id: "b", name: "list_projects", status: "failed" as const },
    ];
    render(<ThreadView streaming={false} messages={[msg({ content: "Partly done.", tools })]} />);
    expect(screen.getByText("Couldn't read that")).toBeInTheDocument();
    expect(screen.queryByText("Checked your deadlines")).not.toBeInTheDocument();
  });

  it("shows an error as an alert and keeps any partial text", () => {
    render(<ThreadView streaming={false} messages={[msg({ content: "partial", error: "That took too long." })]} />);
    expect(screen.getByText("partial")).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("That took too long.");
  });
});

describe("toolLabel", () => {
  it("has wording for each state", () => {
    expect(toolLabel("list_projects", "running")).toBe("Looking through your projects");
    expect(toolLabel("list_projects", "done")).toBe("Looked through your projects");
    expect(toolLabel("list_projects", "failed")).toBe("Couldn't read that");
  });
  it("has wording for the form tools", () => {
    expect(toolLabel("list_forms", "running")).toBe("Looking through your forms");
    expect(toolLabel("get_form", "done")).toBe("Opened a form");
    expect(toolLabel("update_form", "running")).toBe("Preparing a form change");
    expect(toolLabel("update_form", "done")).toBe("Prepared a form change for your approval");
    expect(toolLabel("update_form", "failed")).toBe("Couldn't prepare that change");
    expect(toolLabel("get_form", "failed")).toBe("Couldn't read that");
  });
  it("reads sensibly for a tool with no label yet", () => {
    expect(toolLabel("list_widgets", "running")).toBe("list widgets");
  });
});
