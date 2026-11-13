import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MessageText, parseBlocks } from "./MessageText";

const html = (text: string) => render(<MessageText text={text} />).container;

describe("MessageText", () => {
  it("renders **bold**, *italic* and `code`", () => {
    const c = html("a **strong** and *slanted* and `mono` word");
    expect(c.querySelector("strong")).toHaveTextContent("strong");
    expect(c.querySelector("em")).toHaveTextContent("slanted");
    expect(c.querySelector("code")).toHaveTextContent("mono");
    expect(c).not.toHaveTextContent("**");
  });

  it("renders bullets as a list, with inline formatting inside items", () => {
    const c = html("**October 1, 2026**\n* **Logo** — *Acme* (Completed)\n* **Banner** — *Acme* (Planning)");
    const items = c.querySelectorAll("ul > li");
    expect(items).toHaveLength(2);
    expect(items[0].querySelector("strong")).toHaveTextContent("Logo");
    expect(items[0].querySelector("em")).toHaveTextContent("Acme");
    expect(c).not.toHaveTextContent("*");
  });

  it("keeps one list together across blank lines between items", () => {
    expect(html("- one\n\n- two\n\n- three").querySelectorAll("ul")).toHaveLength(1);
  });

  it("renders numbered lists", () => {
    const c = html("1. first\n2. second");
    expect(c.querySelectorAll("ol > li")).toHaveLength(2);
  });

  it("renders headings as emphasised text, not raw hashes", () => {
    const c = html("## This week\nSome text");
    expect(c).not.toHaveTextContent("#");
    expect(screen.getByText("This week")).toHaveClass("font-semibold");
  });

  it("separates paragraphs at blank lines and keeps single line breaks", () => {
    const c = html("line one\nline two\n\nnext paragraph");
    expect(c.querySelectorAll("p")).toHaveLength(2);
    expect(c.querySelector("br")).not.toBeNull();
  });

  it("shows UTF-8 text such as dashes and accents untouched", () => {
    expect(html("Logo — Café")).toHaveTextContent("Logo — Café");
  });

  it("leaves an unfinished marker as typed while a reply is still streaming", () => {
    expect(html("Here is **bold that has not clo")).toHaveTextContent("**bold that has not clo");
  });

  it("does not treat maths or a lone asterisk as italics", () => {
    const c = html("2 * 3 * 4 = 24");
    expect(c.querySelector("em")).toBeNull();
    expect(c).toHaveTextContent("2 * 3 * 4 = 24");
  });

  it("never turns text into HTML elements", () => {
    const hostile = '<img src=x onerror="alert(1)"><script>alert(1)</script><b>bold</b>';
    const c = html(hostile);
    expect(c.querySelector("img")).toBeNull();
    expect(c.querySelector("script")).toBeNull();
    expect(c.querySelector("b")).toBeNull();
    expect(c).toHaveTextContent(hostile);
  });

  it("hostile text inside bold or a list item is still only text", () => {
    const c = html("* **<img src=x onerror=alert(1)>**");
    expect(c.querySelector("img")).toBeNull();
    expect(c.querySelector("strong")).toHaveTextContent("<img src=x onerror=alert(1)>");
  });

  it("does not make links: markdown link syntax stays as typed", () => {
    const c = html("[click](https://evil.test) and <a href='https://evil.test'>x</a>");
    expect(c.querySelector("a")).toBeNull();
    expect(c).toHaveTextContent("[click](https://evil.test)");
  });

  it("handles Windows line endings and empty input", () => {
    expect(html("one\r\n\r\ntwo").querySelectorAll("p")).toHaveLength(2);
    expect(parseBlocks("")).toEqual([]);
  });
});

describe("MessageText tables", () => {
  const TABLE = [
    "Here are your tasks:",
    "",
    "| Task | Project | Due | Status |",
    "|---|---|---|---|",
    "| **Logo** | Acme | 1 Oct | Completed |",
    "| Banner | Acme | 16 Oct | In Progress / Overdue |",
    "",
    "Anything else?",
  ].join("\n");

  it("renders a pipe table as a real table with headers and rows", () => {
    const c = html(TABLE);
    expect(c.querySelectorAll("th")).toHaveLength(4);
    expect(c.querySelectorAll("tbody tr")).toHaveLength(2);
    expect(screen.getByRole("columnheader", { name: "Due" })).toBeInTheDocument();
    expect(c.querySelector("tbody td strong")).toHaveTextContent("Logo");
    expect(c).not.toHaveTextContent("|---");
  });

  it("keeps the text before and after the table as paragraphs", () => {
    const c = html(TABLE);
    expect(c.querySelectorAll(":scope > div > p")).toHaveLength(2);
    expect(c).toHaveTextContent("Here are your tasks:");
    expect(c).toHaveTextContent("Anything else?");
  });

  it("shows status words as pills, including a combined 'In Progress / Overdue'", () => {
    html(TABLE);
    expect(screen.getByText("Completed")).toHaveClass("rounded-full");
    expect(screen.getByText("In Progress")).toHaveClass("rounded-full");
    expect(screen.getByText("Overdue")).toHaveClass("rounded-full");
  });

  it("does not turn ordinary words into pills", () => {
    html("| Task | Note |\n|---|---|\n| Logo | Completed the draft |");
    expect(screen.getByText("Completed the draft")).not.toHaveClass("rounded-full");
  });

  it("works without outer pipes and pads short rows", () => {
    const c = html("Task | Due\n--- | ---\nLogo |");
    expect(c.querySelectorAll("th")).toHaveLength(2);
    expect(c.querySelectorAll("tbody tr td")).toHaveLength(2);
  });

  it("keeps an escaped pipe inside a cell", () => {
    expect(html("| A | B |\n|---|---|\n| x \\| y | z |").querySelectorAll("tbody td")[0]).toHaveTextContent("x | y");
  });

  it("scrolls sideways instead of overflowing on narrow screens", () => {
    expect(html(TABLE).querySelector("table")!.parentElement).toHaveClass("overflow-x-auto");
  });

  it("leaves a header with no separator row as ordinary text while streaming", () => {
    const c = html("| Task | Due |");
    expect(c.querySelector("table")).toBeNull();
    expect(c).toHaveTextContent("| Task | Due |");
  });

  it("does not make a table from prose that merely contains a pipe", () => {
    expect(html("use a | b to split\n--- ").querySelector("table")).toBeNull();
  });

  it("needs a separator row: two lines that both contain pipes are not a table", () => {
    const c = html("Option a | option b\nOption c | option d");
    expect(c.querySelector("table")).toBeNull();
    expect(c).toHaveTextContent("Option a | option b");
  });

  it("hostile HTML in a table cell is only text", () => {
    const c = html("| A |\n|---|\n| <img src=x onerror=alert(1)> |");
    expect(c.querySelector("img")).toBeNull();
    expect(c.querySelector("td")).toHaveTextContent("<img src=x onerror=alert(1)>");
  });
});
