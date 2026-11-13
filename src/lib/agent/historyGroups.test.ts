import { describe, expect, it } from "vitest";
import { groupByDay, whenLabel, type ConversationSummary } from "./historyGroups";

// Friday 6 November 2026, 2:30 PM on the machine's own clock (month is 0-based).
const NOW = new Date(2026, 10, 6, 14, 30);
const at = (month: number, day: number, hour = 12, minute = 0) => new Date(2026, month, day, hour, minute).toISOString();
const chat = (id: string, updated: string): ConversationSummary => ({ id, title: id, created_at: updated, updated_at: updated });
const ids = (group: { items: ConversationSummary[] }) => group.items.map((c) => c.id);

describe("groupByDay", () => {
  it("returns nothing for no chats", () => {
    expect(groupByDay([], NOW)).toEqual([]);
  });

  it("groups into Today, Yesterday, Previous 7 days and Older, in that order", () => {
    const groups = groupByDay(
      [chat("old", at(9, 1)), chat("week", at(10, 2)), chat("yday", at(10, 5)), chat("today", at(10, 6, 9))],
      NOW,
    );
    expect(groups.map((g) => g.label)).toEqual(["Today", "Yesterday", "Previous 7 days", "Older"]);
    expect(groups.map(ids)).toEqual([["today"], ["yday"], ["week"], ["old"]]);
  });

  it("splits at local midnight, not at 24 hours", () => {
    const groups = groupByDay([chat("just-after-midnight", at(10, 6, 0, 1)), chat("just-before-midnight", at(10, 5, 23, 59))], NOW);
    expect(groups.map((g) => [g.label, ids(g)])).toEqual([
      ["Today", ["just-after-midnight"]],
      ["Yesterday", ["just-before-midnight"]],
    ]);
  });

  it("keeps seven days back in 'Previous 7 days' and eight in 'Older'", () => {
    const groups = groupByDay([chat("seven", at(9, 30)), chat("eight", at(9, 29))], NOW);
    expect(groups.map((g) => [g.label, ids(g)])).toEqual([
      ["Previous 7 days", ["seven"]],
      ["Older", ["eight"]],
    ]);
  });

  it("puts the newest first inside a group, whatever order the list arrived in", () => {
    const groups = groupByDay([chat("a", at(10, 6, 8)), chat("c", at(10, 6, 13)), chat("b", at(10, 6, 10))], NOW);
    expect(ids(groups[0])).toEqual(["c", "b", "a"]);
  });

  it("leaves out groups with nothing in them", () => {
    expect(groupByDay([chat("only", at(10, 6))], NOW).map((g) => g.label)).toEqual(["Today"]);
  });

  it("treats a time slightly in the future (a fast clock) as today", () => {
    expect(groupByDay([chat("ahead", at(10, 7, 1))], NOW)[0].label).toBe("Today");
  });

  it("does not throw on a bad date and files it under Older", () => {
    const groups = groupByDay([chat("bad", "not a date")], NOW);
    expect(groups.map((g) => [g.label, ids(g)])).toEqual([["Older", ["bad"]]]);
  });

  it("does not change the list it was given", () => {
    const input = [chat("a", at(10, 6, 8)), chat("b", at(10, 6, 10))];
    groupByDay(input, NOW);
    expect(input.map((c) => c.id)).toEqual(["a", "b"]);
  });
});

describe("whenLabel", () => {
  it("shows a clock time for today and yesterday", () => {
    expect(whenLabel(at(10, 6, 9, 5), NOW)).toMatch(/\d{1,2}:\d{2}/);
    expect(whenLabel(at(10, 5, 9, 5), NOW)).toMatch(/\d{1,2}:\d{2}/);
  });

  it("shows a date for anything older", () => {
    const label = whenLabel(at(10, 3), NOW);
    expect(label).not.toMatch(/:/);
    expect(label).toMatch(/3/);
  });

  it("is empty for a bad date", () => {
    expect(whenLabel("nope", NOW)).toBe("");
  });
});
