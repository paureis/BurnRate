import { describe, expect, it } from "vitest";
import { applyBulkDelete, applyBulkPatch } from "../bulk";
import type { Subscription } from "../burnrate";

function makeSub(id: string, overrides: Partial<Subscription> = {}): Subscription {
  return {
    id,
    name: `Sub ${id}`,
    costCents: 1000,
    billingCycle: "monthly",
    category: "entertainment",
    nextBillingDate: "2026-06-01",
    notes: "",
    createdAt: "2026-01-01T00:00:00.000Z",
    currency: "USD",
    ...overrides,
  };
}

describe("applyBulkPatch", () => {
  it("is a no-op when the selection is empty", () => {
    const subs = [makeSub("a"), makeSub("b")];
    const result = applyBulkPatch(subs, new Set(), { category: "music" });
    expect(result.changedCount).toBe(0);
    expect(result.next).toBe(subs);
  });

  it("only patches selected records", () => {
    const subs = [makeSub("a"), makeSub("b"), makeSub("c")];
    const result = applyBulkPatch(subs, new Set(["a", "c"]), { category: "music" });
    expect(result.changedCount).toBe(2);
    expect(result.next[0].category).toBe("music");
    expect(result.next[1].category).toBe("entertainment");
    expect(result.next[2].category).toBe("music");
  });

  it("applies multiple fields in one patch", () => {
    const subs = [makeSub("a")];
    const result = applyBulkPatch(subs, new Set(["a"]), {
      billingCycle: "yearly",
      currency: "EUR",
    });
    expect(result.next[0].billingCycle).toBe("yearly");
    expect(result.next[0].currency).toBe("EUR");
  });

  it("ignores id and createdAt patches", () => {
    const subs = [makeSub("a")];
    const result = applyBulkPatch(subs, new Set(["a"]), {
      id: "evil",
      createdAt: "1970-01-01T00:00:00.000Z",
      category: "music",
    });
    expect(result.next[0].id).toBe("a");
    expect(result.next[0].createdAt).toBe("2026-01-01T00:00:00.000Z");
  });

  it("merges tags via tagsAdd and dedupes case-insensitively", () => {
    const subs = [makeSub("a", { tags: ["work"] })];
    const result = applyBulkPatch(subs, new Set(["a"]), { tagsAdd: ["Work", "couple"] });
    expect(result.next[0].tags).toEqual(["work", "couple"]);
    expect(result.changedCount).toBe(1);
  });

  it("removes tags via tagsRemove and is a no-op when the tag is absent", () => {
    const subs = [makeSub("a", { tags: ["work", "couple"] }), makeSub("b", { tags: ["work"] })];
    const result = applyBulkPatch(subs, new Set(["a", "b"]), { tagsRemove: ["work"] });
    expect(result.next[0].tags).toEqual(["couple"]);
    expect(result.next[1].tags).toBeUndefined();
    expect(result.changedCount).toBe(2);

    const second = applyBulkPatch(result.next, new Set(["b"]), { tagsRemove: ["nonexistent"] });
    expect(second.changedCount).toBe(0);
  });

  it("counts a record as changed only when something actually changes", () => {
    const subs = [makeSub("a", { category: "music" })];
    const result = applyBulkPatch(subs, new Set(["a"]), { category: "music" });
    expect(result.changedCount).toBe(0);
    expect(result.next[0]).toBe(subs[0]);
  });
});

describe("applyBulkDelete", () => {
  it("is a no-op when the selection is empty", () => {
    const subs = [makeSub("a"), makeSub("b")];
    const result = applyBulkDelete(subs, new Set());
    expect(result.next).toBe(subs);
    expect(result.deleted).toEqual([]);
  });

  it("removes only selected records and returns them in deleted", () => {
    const subs = [makeSub("a"), makeSub("b"), makeSub("c")];
    const result = applyBulkDelete(subs, new Set(["b"]));
    expect(result.next.map((sub) => sub.id)).toEqual(["a", "c"]);
    expect(result.deleted.map((sub) => sub.id)).toEqual(["b"]);
  });

  it("handles a full sweep", () => {
    const subs = [makeSub("a"), makeSub("b")];
    const result = applyBulkDelete(subs, new Set(["a", "b"]));
    expect(result.next).toEqual([]);
    expect(result.deleted.length).toBe(2);
  });
});
