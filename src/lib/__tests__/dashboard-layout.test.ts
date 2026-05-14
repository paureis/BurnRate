import { describe, expect, it } from "vitest";
import {
  DASHBOARD_MODULE_IDS,
  defaultDashboardLayout,
  moveLayoutEntry,
  resolveDashboardLayout,
  toggleLayoutVisibility,
} from "../dashboard-layout";

describe("resolveDashboardLayout", () => {
  it("returns the default layout when storage is missing", () => {
    const layout = resolveDashboardLayout(undefined);
    expect(layout.length).toBe(DASHBOARD_MODULE_IDS.length);
    expect(layout[0].moduleId).toBe("hero");
  });

  it("preserves a stored partial order and appends new modules at the end", () => {
    const stored = [
      { moduleId: "trends" as const, visible: true },
      { moduleId: "budget" as const, visible: false },
    ];
    const layout = resolveDashboardLayout(stored, ["hero", "budget", "trends"]);
    expect(layout.map((e) => e.moduleId)).toEqual(["trends", "budget", "hero"]);
    expect(layout.find((e) => e.moduleId === "budget")?.visible).toBe(false);
  });

  it("drops modules no longer in the canonical set", () => {
    const stored = [{ moduleId: "removed-id" as unknown as "trends", visible: true }];
    const layout = resolveDashboardLayout(stored, ["hero"]);
    expect(layout.map((e) => e.moduleId)).toEqual(["hero"]);
  });

  it("ignores duplicate entries in storage", () => {
    const stored = [
      { moduleId: "hero" as const, visible: true },
      { moduleId: "hero" as const, visible: false },
    ];
    const layout = resolveDashboardLayout(stored, ["hero", "budget"]);
    expect(layout.length).toBe(2);
    expect(layout[0].visible).toBe(true);
  });
});

describe("moveLayoutEntry", () => {
  it("moves up", () => {
    const layout = defaultDashboardLayout();
    const moved = moveLayoutEntry(layout, "trends", -2);
    const trendsIndex = layout.findIndex((e) => e.moduleId === "trends");
    expect(moved.findIndex((e) => e.moduleId === "trends")).toBe(trendsIndex - 2);
  });

  it("clamps to the start", () => {
    const layout = defaultDashboardLayout();
    const moved = moveLayoutEntry(layout, "hero", -5);
    expect(moved[0].moduleId).toBe("hero");
  });

  it("clamps to the end", () => {
    const layout = defaultDashboardLayout();
    const moved = moveLayoutEntry(layout, layout[0].moduleId, layout.length + 10);
    expect(moved[moved.length - 1].moduleId).toBe("hero");
  });

  it("is a no-op for unknown ids", () => {
    const layout = defaultDashboardLayout();
    expect(moveLayoutEntry(layout, "ghost" as unknown as "hero", 1)).toBe(layout);
  });
});

describe("toggleLayoutVisibility", () => {
  it("flips visibility for one module only", () => {
    const layout = defaultDashboardLayout();
    const result = toggleLayoutVisibility(layout, "hero");
    expect(result.find((e) => e.moduleId === "hero")?.visible).toBe(false);
    expect(result.find((e) => e.moduleId === "budget")?.visible).toBe(true);
  });
});
