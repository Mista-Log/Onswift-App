import { render, screen } from "@testing-library/react";
import { Folder } from "lucide-react";
import { describe, expect, it } from "vitest";
import { TalentStatCard } from "./TalentStatCard";

const card = (tone?: "purple" | "yellow" | "green") => {
  render(<TalentStatCard title="Things" value={3} icon={Folder} tone={tone} />);
  return screen.getByText("Things").closest(".glass-card-hover") as HTMLElement;
};

describe("TalentStatCard tones", () => {
  it.each([
    ["purple", "!bg-purple-200", "border-purple-500", "dark:!bg-[hsl(270_40%_13%)]"],
    ["yellow", "!bg-yellow-100", "border-yellow-400", "dark:!bg-[hsl(45_45%_12%)]"],
    ["green", "!bg-green-100", "border-green-400", "dark:!bg-[hsl(150_40%_11%)]"],
  ] as const)("%s uses the task-card recipe in light and dark", (tone, ...classes) => {
    expect(card(tone)).toHaveClass(...classes);
  });

  it("without a tone it keeps the plain glass look", () => {
    const el = card();
    expect(el.className).not.toMatch(/!bg-/);
    expect(el).not.toHaveClass("border");
  });

  it("shows no icon chip (it was taken out of the card)", () => {
    render(<TalentStatCard title="Done" value={1} icon={Folder} tone="green" />);
    expect(document.querySelector("svg")).toBeNull();
  });
});
