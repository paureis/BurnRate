import { describe, expect, it } from "vitest";
import {
  BUILT_IN_CATEGORY_IDS,
  buildBuiltInCategories,
  deriveUserCategoriesFromRecords,
  isReferenced,
  loadCategories,
  mergeOnImport,
  resolveCategoryId,
  slugifyCategoryLabel,
} from "../categories";
import type { Subscription } from "../burnrate";

function makeSub(category: string): Subscription {
  return {
    id: `sub-${Math.random()}`,
    name: "x",
    costCents: 1000,
    billingCycle: "monthly",
    category,
    nextBillingDate: "2026-06-01",
    notes: "",
    createdAt: "2026-01-01T00:00:00.000Z",
  };
}

describe("buildBuiltInCategories", () => {
  it("seeds 9 built-ins in canonical order", () => {
    const built = buildBuiltInCategories();
    expect(built.length).toBe(9);
    expect(built[0].id).toBe("entertainment");
    expect(built[built.length - 1].id).toBe("other");
    expect(built.every((cat) => cat.builtIn)).toBe(true);
  });
});

describe("loadCategories", () => {
  it("returns built-ins when storage is empty", () => {
    expect(loadCategories(undefined).length).toBe(9);
    expect(loadCategories([]).length).toBe(9);
  });

  it("preserves stored ids and appends missing built-ins", () => {
    const stored = [
      { id: "custom", label: "Custom", color: "#abcdef", icon: "wallet", builtIn: false, order: 0 },
    ];
    const result = loadCategories(stored);
    expect(result.length).toBe(10);
    expect(result[0].id).toBe("custom");
  });

  it("drops malformed entries", () => {
    const result = loadCategories([null, { id: "ok", label: "ok" }, { not: "valid" }]);
    expect(result.find((c) => c.id === "ok")).toBeDefined();
  });
});

describe("isReferenced", () => {
  it("matches subscriptions by category string", () => {
    const subs = [makeSub("entertainment")];
    expect(isReferenced("entertainment", subs)).toBe(true);
    expect(isReferenced("music", subs)).toBe(false);
  });

  it("tolerates slugified mismatches", () => {
    const subs = [makeSub("Entertainment")];
    expect(isReferenced("entertainment", subs)).toBe(true);
  });
});

describe("resolveCategoryId", () => {
  it("matches by id or label", () => {
    const registry = buildBuiltInCategories();
    expect(resolveCategoryId("Entertainment", registry)).toBe("entertainment");
    expect(resolveCategoryId("entertainment", registry)).toBe("entertainment");
  });

  it("falls back to a slugified id", () => {
    expect(resolveCategoryId("Side Hustle", buildBuiltInCategories())).toBe("side-hustle");
  });
});

describe("deriveUserCategoriesFromRecords", () => {
  it("creates a user category for unknown subscription labels", () => {
    const existing = buildBuiltInCategories();
    const subs = [makeSub("Side Hustle"), makeSub("entertainment"), makeSub("side hustle")];
    const created = deriveUserCategoriesFromRecords(subs, [], existing);
    expect(created.length).toBe(1);
    expect(created[0].id).toBe("side-hustle");
    expect(created[0].builtIn).toBe(false);
    expect(created[0].color.startsWith("#")).toBe(true);
  });

  it("color is deterministic for a given label", () => {
    const a = deriveUserCategoriesFromRecords([makeSub("Beanie Babies")], [], buildBuiltInCategories());
    const b = deriveUserCategoriesFromRecords([makeSub("Beanie Babies")], [], buildBuiltInCategories());
    expect(a[0].color).toBe(b[0].color);
  });
});

describe("mergeOnImport", () => {
  it("adds new categories and updates existing labels/colors", () => {
    const existing = buildBuiltInCategories();
    const incoming = [
      { id: "entertainment", label: "Streaming", color: "#000000", icon: "tv", builtIn: true, order: 0 },
      { id: "new-cat", label: "New", color: "#abcdef", icon: "wallet", builtIn: false, order: 99 },
    ];
    const merged = mergeOnImport(existing, incoming);
    expect(merged.find((c) => c.id === "entertainment")?.label).toBe("Streaming");
    expect(merged.find((c) => c.id === "new-cat")).toBeDefined();
  });
});

describe("BUILT_IN_CATEGORY_IDS", () => {
  it("matches the seed list", () => {
    expect(BUILT_IN_CATEGORY_IDS).toContain("entertainment");
    expect(BUILT_IN_CATEGORY_IDS).toContain("other");
  });
});

describe("slugifyCategoryLabel", () => {
  it("kebab-cases and strips non-alphanum/slash", () => {
    expect(slugifyCategoryLabel("Side Hustle!")).toBe("side-hustle");
    expect(slugifyCategoryLabel("cloud/storage")).toBe("cloud/storage");
  });
});
