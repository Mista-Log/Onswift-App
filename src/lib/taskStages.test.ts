import { describe, it, expect } from "vitest";
import { stageAction } from "./taskStages";

describe("stageAction", () => {
  it("lets a creator move a task anywhere", () => {
    expect(stageAction("creator", "planning", "in-progress")).toBe("apply");
    expect(stageAction("creator", "in-progress", "completed")).toBe("apply");
    expect(stageAction("creator", "completed", "planning")).toBe("apply");
    expect(stageAction("creator", "planning", "completed", true)).toBe("apply");
  });

  it("lets a talent start and pause their own task", () => {
    expect(stageAction("talent", "planning", "in-progress")).toBe("apply");
    expect(stageAction("talent", "in-progress", "planning")).toBe("apply");
  });

  it("sends a talent's completion through the gate", () => {
    expect(stageAction("talent", "in-progress", "completed")).toBe("gate");
    expect(stageAction("talent", "planning", "completed")).toBe("gate");
  });

  it("locks completed tasks and tasks awaiting approval for a talent", () => {
    expect(stageAction("talent", "completed", "in-progress")).toBe("locked");
    expect(stageAction("talent", "in-progress", "planning", true)).toBe("locked");
    expect(stageAction("talent", "in-progress", "completed", true)).toBe("locked");
  });

  it("treats staying put as nothing to do", () => {
    expect(stageAction("talent", "planning", "planning")).toBe("locked");
    expect(stageAction("creator", "planning", "planning")).toBe("locked");
  });

  it("gives other roles the talent rules", () => {
    expect(stageAction(undefined, "planning", "completed")).toBe("gate");
  });
});
