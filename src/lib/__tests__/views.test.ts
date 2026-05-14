import { describe, expect, it } from "vitest";
import { applyView, buildBuiltinViews, isBuiltinView, normalizeViews, type SavedView } from "../views";
import type { Subscription } from "../burnrate";
import { buildFxContext } from "../currency";

function makeSub(over: Partial<Subscription> = {}): Subscription {
  return {
    id: over.id ?? `sub-${Math.random().toString(36).slice(2)}`,
    name: "Netflix",
    costCents: 1599,
    billingCycle: "monthly",
    category: "entertainment",
    nextBillingDate: "2026-06-15",
    notes: "",
    createdAt: "2026-01-01T00:00:00.000Z",
    currency: "USD",
    ...over,
  };
}

const view = (overrides: Partial<SavedView>): SavedView => ({
  id: "test",
  name: "Test",
  scope: "subscriptions",
  filter: {},
  sort: { by: "nextBillingDate", dir: "asc" },
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  ...overrides,
});

describe("buildBuiltinViews", () => {
  it("seeds the three documented built-in views", () => {
    const built = buildBuiltinViews();
    expect(built.map((v) => v.id)).toEqual(["all-subs", "yearly-only", "cancelling-soon"]);
    expect(built.every((v) => v.builtIn === true)).toBe(true);
  });
});

describe("isBuiltinView", () => {
  it("flags built-ins by id even when the builtIn property is absent", () => {
    expect(isBuiltinView({ id: "yearly-only" })).toBe(true);
    expect(isBuiltinView({ id: "made-up" })).toBe(false);
  });
});

describe("applyView", () => {
  it("returns all subs for an empty filter", () => {
    const subs = [makeSub({ id: "a" }), makeSub({ id: "b" })];
    expect(applyView(subs, view({})).length).toBe(2);
  });

  it("matches free-text query against name+notes+category", () => {
    const subs = [
      makeSub({ id: "a", name: "Netflix" }),
      makeSub({ id: "b", name: "Spotify", notes: "Family plan" }),
      makeSub({ id: "c", name: "Hulu", category: "entertainment" }),
    ];
    expect(applyView(subs, view({ filter: { query: "family" } })).length).toBe(1);
    expect(applyView(subs, view({ filter: { query: "ent" } })).length).toBe(3);
  });

  it("requires every filter tag (AND semantics)", () => {
    const subs = [
      makeSub({ id: "a", tags: ["work"] }),
      makeSub({ id: "b", tags: ["work", "couple"] }),
      makeSub({ id: "c", tags: ["couple"] }),
    ];
    expect(applyView(subs, view({ filter: { tags: ["work"] } })).length).toBe(2);
    expect(applyView(subs, view({ filter: { tags: ["work", "couple"] } })).length).toBe(1);
  });

  it("filters by category (OR within the list)", () => {
    const subs = [
      makeSub({ id: "a", category: "entertainment" }),
      makeSub({ id: "b", category: "music" }),
      makeSub({ id: "c", category: "productivity" }),
    ];
    expect(applyView(subs, view({ filter: { categories: ["music", "productivity"] } })).length).toBe(2);
  });

  it("filters by cycle", () => {
    const subs = [
      makeSub({ id: "a", billingCycle: "monthly" }),
      makeSub({ id: "b", billingCycle: "yearly" }),
    ];
    expect(applyView(subs, view({ filter: { cycles: ["yearly"] } })).length).toBe(1);
  });

  it("filters by min/max monthly cents in base currency", () => {
    const fx = buildFxContext("USD", {});
    const subs = [
      makeSub({ id: "a", costCents: 500 }),
      makeSub({ id: "b", costCents: 2000 }),
      makeSub({ id: "c", costCents: 5000 }),
    ];
    expect(applyView(subs, view({ filter: { minMonthlyCents: 1000 } }), fx).length).toBe(2);
    expect(applyView(subs, view({ filter: { maxMonthlyCents: 1000 } }), fx).length).toBe(1);
    expect(
      applyView(subs, view({ filter: { minMonthlyCents: 1000, maxMonthlyCents: 3000 } }), fx).length,
    ).toBe(1);
  });

  it("filters cancellingOnly correctly", () => {
    const subs = [makeSub({ id: "a" }), makeSub({ id: "b", cancellingOn: "2026-06-01" })];
    expect(applyView(subs, view({ filter: { cancellingOnly: true } })).length).toBe(1);
  });

  it("sorts by cost desc", () => {
    const fx = buildFxContext("USD", {});
    const subs = [
      makeSub({ id: "a", costCents: 500 }),
      makeSub({ id: "b", costCents: 2000 }),
      makeSub({ id: "c", costCents: 5000 }),
    ];
    const result = applyView(subs, view({ sort: { by: "cost", dir: "desc" } }), fx);
    expect(result.map((s) => s.id)).toEqual(["c", "b", "a"]);
  });

  it("combines filter + sort", () => {
    const fx = buildFxContext("USD", {});
    const subs = [
      makeSub({ id: "a", costCents: 500, category: "music" }),
      makeSub({ id: "b", costCents: 2000, category: "music" }),
      makeSub({ id: "c", costCents: 5000, category: "entertainment" }),
    ];
    const result = applyView(
      subs,
      view({ filter: { categories: ["music"] }, sort: { by: "cost", dir: "desc" } }),
      fx,
    );
    expect(result.map((s) => s.id)).toEqual(["b", "a"]);
  });
});

describe("normalizeViews", () => {
  it("seeds built-ins when storage is empty", () => {
    const result = normalizeViews(undefined);
    expect(result.length).toBe(3);
    expect(result.every((v) => v.builtIn)).toBe(true);
  });

  it("preserves stored user views and adds missing built-ins", () => {
    const stored = [
      {
        id: "user-1",
        name: "My view",
        scope: "subscriptions",
        filter: { tags: ["work"] },
        sort: { by: "cost", dir: "desc" },
        createdAt: "2026-04-01T00:00:00.000Z",
        updatedAt: "2026-04-01T00:00:00.000Z",
      },
    ];
    const result = normalizeViews(stored);
    expect(result.length).toBe(4);
    expect(result[0].id).toBe("user-1");
    expect(result.find((v) => v.id === "all-subs")?.builtIn).toBe(true);
  });

  it("drops malformed entries silently", () => {
    const stored = [null, { id: "x" /* missing name */ }, { id: "y", name: "OK", scope: "subscriptions" }];
    const result = normalizeViews(stored);
    expect(result.find((v) => v.id === "y")).toBeDefined();
    expect(result.find((v) => v.id === "x")).toBeUndefined();
  });
});
