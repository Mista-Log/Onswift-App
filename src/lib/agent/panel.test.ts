import { afterEach, describe, expect, it, vi } from "vitest";
import {
  PANEL_DEFAULT_WIDTH, PANEL_MAX_WIDTH, PANEL_MIN_WIDTH, PANEL_OPEN_KEY, PANEL_WIDTH_KEY,
  clampWidth, contextForPath, readStoredOpen, readStoredWidth,
} from "./panel";

afterEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

describe("clampWidth", () => {
  it("keeps a valid width", () => expect(clampWidth(450)).toBe(450));
  it("raises a too-small width to the minimum", () => expect(clampWidth(10)).toBe(PANEL_MIN_WIDTH));
  it("lowers a too-large width to the maximum", () => expect(clampWidth(5000)).toBe(PANEL_MAX_WIDTH));
  it("accepts a numeric string, as read from storage", () => expect(clampWidth("500")).toBe(500));
  it.each([["abc"], [NaN], [undefined], [null], [""], [Infinity]])("falls back to the default for %s", (v) => {
    expect(clampWidth(v)).toBe(PANEL_DEFAULT_WIDTH);
  });
});

describe("stored panel state", () => {
  it("defaults to closed and the default width", () => {
    expect(readStoredOpen()).toBe(false);
    expect(readStoredWidth()).toBe(PANEL_DEFAULT_WIDTH);
  });
  it("reads back what was saved", () => {
    localStorage.setItem(PANEL_OPEN_KEY, "true");
    localStorage.setItem(PANEL_WIDTH_KEY, "520");
    expect(readStoredOpen()).toBe(true);
    expect(readStoredWidth()).toBe(520);
  });
  it("clamps a tampered stored width", () => {
    localStorage.setItem(PANEL_WIDTH_KEY, "99999");
    expect(readStoredWidth()).toBe(PANEL_MAX_WIDTH);
  });
  it("survives blocked storage", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    expect(readStoredOpen()).toBe(false);
    expect(readStoredWidth()).toBe(PANEL_DEFAULT_WIDTH);
  });
});

describe("contextForPath", () => {
  const id = "3f2b8c1e-5a4d-4e6f-9a1b-2c3d4e5f6a7b";
  it("includes the project id on a project page", () => {
    expect(contextForPath(`/projects/${id}`)).toEqual({ route: `/projects/${id}`, project_id: id });
  });
  it("includes the project id on a sub-page of a project", () => {
    expect(contextForPath(`/projects/${id}/messages`).project_id).toBe(id);
  });
  it("has no project id on the projects list", () => {
    expect(contextForPath("/projects")).toEqual({ route: "/projects" });
  });
  it("does not forward a non-UUID segment as an id", () => {
    expect(contextForPath("/projects/not-an-id")).toEqual({ route: "/projects/not-an-id" });
  });
  it("has only the route elsewhere", () => {
    expect(contextForPath("/calendar")).toEqual({ route: "/calendar" });
  });

  it("names the form on a form's own page", () => {
    const id = "3f2b8c1e-5a4d-4e6f-9a1b-2c3d4e5f6a7b";
    expect(contextForPath(`/forms/${id}`)).toEqual({ route: `/forms/${id}`, form_id: id });
    expect(contextForPath(`/forms/${id}/`).form_id).toBe(id);
  });

  it("does not name a form on its responses, on the new-form page, or for a bad id", () => {
    const id = "3f2b8c1e-5a4d-4e6f-9a1b-2c3d4e5f6a7b";
    expect(contextForPath(`/forms/${id}/responses`)).toEqual({ route: `/forms/${id}/responses` });
    expect(contextForPath("/forms/new")).toEqual({ route: "/forms/new" });
    expect(contextForPath("/forms/not-an-id")).toEqual({ route: "/forms/not-an-id" });
    expect(contextForPath("/forms")).toEqual({ route: "/forms" });
  });
});
