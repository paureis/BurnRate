import { describe, expect, it } from "vitest";
import {
  applyDuePriceChanges,
  buildPriceChange,
  expandPriceChangeTimeline,
  projectMonthlyBurnWithChanges,
  validatePriceChange,
} from "../price-changes";
import { buildFxContext } from "../currency";
import type { Subscription } from "../burnrate";

function makeSub(overrides: Partial<Subscription> = {}): Subscription {
  return {
    id: "sub-1",
    name: "Netflix",
    costCents: 1500,
    billingCycle: "monthly",
    category: "entertainment",
    nextBillingDate: "2026-06-01",
    notes: "",
    createdAt: "2026-01-01T00:00:00.000Z",
    currency: "USD",
    ...overrides,
  };
}

describe("applyDuePriceChanges", () => {
  it("is a no-op when no subs have planned changes", () => {
    const subs = [makeSub()];
    const result = applyDuePriceChanges(subs, new Date("2026-05-15"));
    expect(result.applied).toEqual([]);
    expect(result.next).toBe(subs);
  });

  it("applies a single due change and removes it from the queue", () => {
    const subs = [
      makeSub({
        priceChanges: [
          { id: "pc-1", effectiveDate: "2026-05-01", newCostCents: 1799, addedAt: "2026-04-01T00:00:00.000Z" },
        ],
      }),
    ];
    const result = applyDuePriceChanges(subs, new Date("2026-05-15"));
    expect(result.applied.length).toBe(1);
    expect(result.next[0].costCents).toBe(1799);
    expect(result.next[0].priceChanges).toBeUndefined();
  });

  it("leaves future changes in place", () => {
    const subs = [
      makeSub({
        priceChanges: [
          { id: "pc-1", effectiveDate: "2026-07-01", newCostCents: 1999, addedAt: "2026-04-01T00:00:00.000Z" },
        ],
      }),
    ];
    const result = applyDuePriceChanges(subs, new Date("2026-05-15"));
    expect(result.applied).toEqual([]);
    expect(result.next[0].priceChanges?.length).toBe(1);
  });

  it("applies multiple due changes in date order", () => {
    const subs = [
      makeSub({
        priceChanges: [
          { id: "pc-2", effectiveDate: "2026-05-01", newCostCents: 1799, addedAt: "2026-04-01T00:00:00.000Z" },
          { id: "pc-1", effectiveDate: "2026-04-01", newCostCents: 1699, addedAt: "2026-03-01T00:00:00.000Z" },
        ],
      }),
    ];
    const result = applyDuePriceChanges(subs, new Date("2026-05-15"));
    expect(result.applied.map((a) => a.effectiveDate)).toEqual(["2026-04-01", "2026-05-01"]);
    expect(result.next[0].costCents).toBe(1799);
  });

  it("is idempotent on the same now", () => {
    const subs = [
      makeSub({
        priceChanges: [
          { id: "pc-1", effectiveDate: "2026-05-01", newCostCents: 1799, addedAt: "2026-04-01T00:00:00.000Z" },
        ],
      }),
    ];
    const first = applyDuePriceChanges(subs, new Date("2026-05-15"));
    const second = applyDuePriceChanges(first.next, new Date("2026-05-15"));
    expect(second.applied).toEqual([]);
    expect(second.next[0].costCents).toBe(1799);
  });
});

describe("projectMonthlyBurnWithChanges", () => {
  const fx = buildFxContext("USD", {});

  it("equals the current monthly cost when no changes exist", () => {
    const sub = makeSub({ costCents: 1500 });
    expect(projectMonthlyBurnWithChanges(sub, 0, fx, new Date("2026-05-15"))).toBe(1500);
    expect(projectMonthlyBurnWithChanges(sub, 6, fx, new Date("2026-05-15"))).toBe(1500);
  });

  it("reflects a planned change at the target month", () => {
    const sub = makeSub({
      costCents: 1500,
      priceChanges: [
        { id: "pc-1", effectiveDate: "2026-08-01", newCostCents: 1799, addedAt: "2026-04-01T00:00:00.000Z" },
      ],
    });
    const now = new Date("2026-05-15");
    expect(projectMonthlyBurnWithChanges(sub, 0, fx, now)).toBe(1500);
    expect(projectMonthlyBurnWithChanges(sub, 3, fx, now)).toBe(1799);
  });
});

describe("expandPriceChangeTimeline", () => {
  it("produces horizonMonths entries with event-tagged months", () => {
    const subs = [
      makeSub({
        priceChanges: [
          { id: "pc-1", effectiveDate: "2026-08-15", newCostCents: 2000, addedAt: "2026-04-01T00:00:00.000Z" },
        ],
      }),
    ];
    const fx = buildFxContext("USD", {});
    const timeline = expandPriceChangeTimeline(subs, 6, fx, new Date("2026-05-15"));
    expect(timeline.length).toBe(6);
    expect(timeline.find((row) => row.eventsAtThisMonth.length > 0)?.month).toBe("2026-08");
  });
});

describe("validatePriceChange", () => {
  it("rejects past dates", () => {
    const result = validatePriceChange(
      { effectiveDate: "2026-05-01", newCostCents: 1000 },
      new Date("2026-05-15"),
    );
    expect(result.ok).toBe(false);
  });

  it("rejects non-positive cost", () => {
    const result = validatePriceChange(
      { effectiveDate: "2026-06-15", newCostCents: 0 },
      new Date("2026-05-15"),
    );
    expect(result.ok).toBe(false);
  });

  it("accepts a well-formed draft", () => {
    expect(
      validatePriceChange({ effectiveDate: "2026-06-15", newCostCents: 1799 }, new Date("2026-05-15")).ok,
    ).toBe(true);
  });
});

describe("buildPriceChange", () => {
  it("assigns ID and addedAt", () => {
    const pc = buildPriceChange({ effectiveDate: "2026-08-01", newCostCents: 1799 });
    expect(pc.id).toMatch(/^pc-/);
    expect(pc.addedAt).toMatch(/T/);
  });
});
