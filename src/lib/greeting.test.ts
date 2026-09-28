import { describe, it, expect } from "vitest";
import { dayPart, greeting } from "./greeting";

const at = (hour: number, minute = 0, month = 8, day = 26) => new Date(2026, month, day, hour, minute);

describe("dayPart", () => {
  it("switches at the documented boundaries", () => {
    expect(dayPart(4)).toBe("night");
    expect(dayPart(5)).toBe("morning");
    expect(dayPart(11)).toBe("morning");
    expect(dayPart(12)).toBe("afternoon");
    expect(dayPart(16)).toBe("afternoon");
    expect(dayPart(17)).toBe("evening");
    expect(dayPart(20)).toBe("evening");
    expect(dayPart(21)).toBe("night");
    expect(dayPart(0)).toBe("night");
  });
});

describe("greeting", () => {
  it("uses the first name only", () => {
    expect(greeting("Ada Lovelace", at(9))).toContain("Ada");
    expect(greeting("Ada Lovelace", at(9))).not.toContain("Lovelace");
  });

  it("gives the same line for the same day and part of day", () => {
    expect(greeting("Ada", at(9, 0))).toBe(greeting("Ada", at(10, 59)));
  });

  it("can differ from one day to the next", () => {
    const lines = new Set(Array.from({ length: 8 }, (_, i) => greeting("Ada", at(9, 0, 8, 10 + i))));
    expect(lines.size).toBeGreaterThan(1);
  });

  it("changes with the part of the day", () => {
    const parts = [at(9), at(14), at(19), at(23)].map((d) => greeting("Ada", d));
    expect(new Set(parts).size).toBe(4);
  });

  it("leaves the name out cleanly when there isn't one", () => {
    for (const name of [undefined, null, "", "   "]) {
      for (let hour = 0; hour < 24; hour++) {
        const line = greeting(name, at(hour));
        expect(line).not.toContain("{name}");
        expect(line).not.toContain("undefined");
        expect(line).not.toMatch(/,\s*[?.]/); // no dangling ", ?"
        expect(line.length).toBeGreaterThan(3);
      }
    }
  });

  it("keeps every line short, even with a very long first name", () => {
    const longName = "Bartholomewmaximilian Something";
    for (let day = 0; day < 366; day++) {
      for (const hour of [2, 9, 14, 19]) {
        const line = greeting(longName, new Date(2026, 0, 1 + day, hour));
        expect(line.length).toBeLessThanOrEqual(45);
      }
    }
  });
});
