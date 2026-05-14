import { describe, expect, it } from "vitest";
import {
  HISTORY_LIMIT,
  append,
  buildSummary,
  dropEntry,
  isUndoable,
  normalizeHistory,
  prune,
  record,
  type HistoryEntry,
} from "../history";

describe("record", () => {
  it("assigns a unique id and ISO timestamp", () => {
    const now = new Date("2026-05-14T12:00:00.000Z");
    const entry = record({ op: "addSubscription", summary: "x", before: null, after: { name: "X" } }, now);
    expect(entry.id).toMatch(/^[a-z0-9]+-[a-z0-9]{4}-[A-Z0-9]+$/);
    expect(entry.ts).toBe("2026-05-14T12:00:00.000Z");
  });

  it("flags oversized payloads", () => {
    const big = { blob: "x".repeat(10 * 1024) };
    const entry = record({ op: "bulkUpdate", summary: "x", before: big, after: big });
    expect(entry.oversized).toBe(true);
    expect(entry.before).toBeNull();
    expect(entry.after).toBeNull();
    expect(isUndoable(entry)).toBe(false);
  });

  it("creates 1000 unique ids across rapid calls", () => {
    const ids = new Set<string>();
    for (let i = 0; i < 1000; i += 1) {
      ids.add(record({ op: "addSubscription", summary: "x", before: null, after: null }).id);
    }
    expect(ids.size).toBe(1000);
  });
});

describe("prune", () => {
  it("keeps the latest entries when the buffer overflows", () => {
    const entries: HistoryEntry[] = [];
    for (let i = 0; i < HISTORY_LIMIT + 5; i += 1) {
      entries.push({
        id: String(i),
        ts: new Date(i * 1000).toISOString(),
        op: "addSubscription",
        summary: `entry-${i}`,
        before: null,
        after: { name: `n${i}` },
      });
    }
    const pruned = prune(entries);
    expect(pruned.length).toBe(HISTORY_LIMIT);
    expect(pruned[0].summary).toBe("entry-5");
    expect(pruned[pruned.length - 1].summary).toBe(`entry-${HISTORY_LIMIT + 4}`);
  });

  it("respects a custom limit", () => {
    const entries = [
      { id: "a", ts: "", op: "addSubscription" as const, summary: "a", before: null, after: null },
      { id: "b", ts: "", op: "addSubscription" as const, summary: "b", before: null, after: null },
    ];
    expect(prune(entries, 1).length).toBe(1);
  });
});

describe("append", () => {
  it("adds and prunes", () => {
    let entries: HistoryEntry[] = [];
    for (let i = 0; i < 25; i += 1) {
      entries = append(entries, {
        op: "addSubscription",
        summary: `s${i}`,
        before: null,
        after: { name: `n${i}` },
      });
    }
    expect(entries.length).toBe(HISTORY_LIMIT);
  });
});

describe("buildSummary", () => {
  it("names the subject for add/update/delete", () => {
    expect(buildSummary("addSubscription", null, { name: "Netflix" })).toBe("Added Netflix.");
    expect(buildSummary("updateSubscription", { name: "old" }, { name: "Netflix" })).toBe(
      "Updated Netflix.",
    );
    expect(buildSummary("deleteSubscription", { name: "Netflix" }, null)).toBe("Deleted Netflix.");
  });

  it("counts bulk operations", () => {
    expect(buildSummary("bulkDelete", [{ name: "A" }, { name: "B" }, { name: "C" }], null)).toBe(
      "Deleted 3 subscriptions: A, B, C.",
    );
    expect(buildSummary("bulkUpdate", null, [{ name: "A" }, { name: "B" }])).toBe("Updated 2 subscriptions.");
  });

  it("handles each op without throwing", () => {
    const ops: Parameters<typeof buildSummary>[0][] = [
      "addSubscription",
      "updateSubscription",
      "deleteSubscription",
      "bulkUpdate",
      "bulkDelete",
      "addTrial",
      "updateTrial",
      "deleteTrial",
      "convertTrial",
      "setCancellingOn",
      "undoCancellation",
      "applyDueCancellation",
      "addLedger",
      "deleteLedger",
      "updateBudget",
      "updatePreferences",
      "addView",
      "updateView",
      "deleteView",
      "addCategory",
      "updateCategory",
      "deleteCategory",
      "importProfile",
      "importCsv",
    ];
    for (const op of ops) {
      expect(typeof buildSummary(op, null, null)).toBe("string");
    }
  });
});

describe("dropEntry", () => {
  it("removes the matching id", () => {
    const entries: HistoryEntry[] = [
      { id: "a", ts: "", op: "addSubscription", summary: "a", before: null, after: null },
      { id: "b", ts: "", op: "addSubscription", summary: "b", before: null, after: null },
    ];
    expect(dropEntry(entries, "a").map((e) => e.id)).toEqual(["b"]);
  });
});

describe("normalizeHistory", () => {
  it("drops malformed rows and caps to the ring size", () => {
    const stored: unknown[] = [];
    for (let i = 0; i < 30; i += 1) {
      stored.push({ id: String(i), ts: "", op: "addSubscription", summary: `s${i}`, before: null, after: null });
    }
    stored.push("not an object");
    stored.push({ id: "missing-fields" });
    const out = normalizeHistory(stored);
    expect(out.length).toBe(HISTORY_LIMIT);
  });

  it("dedupes by id", () => {
    const stored = [
      { id: "x", ts: "", op: "addSubscription", summary: "s", before: null, after: null },
      { id: "x", ts: "", op: "addSubscription", summary: "s", before: null, after: null },
    ];
    expect(normalizeHistory(stored).length).toBe(1);
  });
});
