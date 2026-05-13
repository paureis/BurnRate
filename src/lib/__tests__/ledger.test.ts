import { describe, it, expect } from "vitest";
import type { Subscription } from "../burnrate";
import {
  applyDueCancellations,
  buildManualLedgerRecord,
  earliestCancelledOn,
  isUndoEligible,
  ledgerCsvRow,
  ledgerFromCsvRow,
  normalizeLedger,
  totalSavedMonthlyCents,
  totalSavedYearlyCents,
} from "../ledger";

function sub(overrides: Partial<Subscription> = {}): Subscription {
  return {
    id: overrides.id ?? "sub-1",
    name: overrides.name ?? "Netflix",
    costCents: overrides.costCents ?? 1599,
    billingCycle: overrides.billingCycle ?? "monthly",
    category: overrides.category ?? "entertainment",
    nextBillingDate: overrides.nextBillingDate ?? "2026-06-01",
    notes: "",
    createdAt: "2026-01-01T00:00:00.000Z",
    currency: "USD",
    ...overrides,
  };
}

describe("applyDueCancellations", () => {
  it("does nothing when no subscription has a due cancellation", () => {
    const subs = [sub({ id: "a" }), sub({ id: "b" })];
    const result = applyDueCancellations(subs, new Date("2026-05-12"));
    expect(result.remaining).toEqual(subs);
    expect(result.added).toEqual([]);
  });

  it("moves a sub with cancellingOn ≤ today to the ledger", () => {
    const due = sub({ id: "due", cancellingOn: "2026-05-10" });
    const future = sub({ id: "future", cancellingOn: "2030-01-01" });
    const result = applyDueCancellations([due, future], new Date("2026-05-12"));
    expect(result.remaining).toHaveLength(1);
    expect(result.remaining[0].id).toBe("future");
    expect(result.added).toHaveLength(1);
    expect(result.added[0].subscriptionName).toBe("Netflix");
    expect(result.added[0].auto).toBe(true);
  });

  it("is idempotent", () => {
    const subs = [sub({ id: "a", cancellingOn: "2026-05-01" })];
    const first = applyDueCancellations(subs, new Date("2026-05-12"));
    const second = applyDueCancellations(first.remaining, new Date("2026-05-12"));
    expect(second.added).toEqual([]);
    expect(second.remaining).toEqual(first.remaining);
  });
});

describe("ledger math", () => {
  it("sums monthly and yearly totals", () => {
    const records = [
      buildManualLedgerRecord({
        subscriptionName: "A",
        category: "x",
        monthlyCostCents: 1000,
        currency: "USD",
        cancelledOn: "2026-01-01",
      }),
      buildManualLedgerRecord({
        subscriptionName: "B",
        category: "x",
        monthlyCostCents: 500,
        currency: "USD",
        cancelledOn: "2026-02-01",
      }),
    ];
    expect(totalSavedMonthlyCents(records)).toBe(1500);
    expect(totalSavedYearlyCents(records)).toBe(18000);
    expect(earliestCancelledOn(records)).toBe("2026-01-01");
  });

  it("earliestCancelledOn returns null when empty", () => {
    expect(earliestCancelledOn([])).toBeNull();
  });
});

describe("isUndoEligible", () => {
  it("returns true within 7 days for auto entries", () => {
    const record = buildManualLedgerRecord({
      subscriptionName: "A",
      category: "x",
      monthlyCostCents: 100,
      currency: "USD",
      cancelledOn: "2026-05-12",
      now: new Date("2026-05-12T12:00:00Z"),
    });
    // Force auto flag for the test
    const auto = { ...record, auto: true };
    expect(isUndoEligible(auto, new Date("2026-05-15T12:00:00Z"))).toBe(true);
  });

  it("returns false after 7 days", () => {
    const record = buildManualLedgerRecord({
      subscriptionName: "A",
      category: "x",
      monthlyCostCents: 100,
      currency: "USD",
      cancelledOn: "2026-01-01",
      now: new Date("2026-01-01T00:00:00Z"),
    });
    const auto = { ...record, auto: true };
    expect(isUndoEligible(auto, new Date("2026-02-01T00:00:00Z"))).toBe(false);
  });

  it("never returns true for manual entries", () => {
    const record = buildManualLedgerRecord({
      subscriptionName: "A",
      category: "x",
      monthlyCostCents: 100,
      currency: "USD",
      cancelledOn: "2026-05-12",
      now: new Date("2026-05-12T00:00:00Z"),
    });
    expect(isUndoEligible(record, new Date("2026-05-12T01:00:00Z"))).toBe(false);
  });
});

describe("CSV round-trip", () => {
  it("round-trips a record", () => {
    const record = buildManualLedgerRecord({
      subscriptionName: "Netflix",
      category: "entertainment",
      monthlyCostCents: 1599,
      currency: "USD",
      cancelledOn: "2026-05-01",
      note: "Forgot to cancel trial",
    });
    const row = ledgerCsvRow(record);
    const restored = ledgerFromCsvRow(row);
    expect(restored.subscriptionName).toBe(record.subscriptionName);
    expect(restored.monthlyCostCents).toBe(record.monthlyCostCents);
    expect(restored.currency).toBe(record.currency);
    expect(restored.cancelledOn).toBe(record.cancelledOn);
    expect(restored.auto).toBe(false);
  });
});

describe("normalizeLedger", () => {
  it("ignores malformed entries", () => {
    expect(normalizeLedger([null, {}, { id: 1 }])).toEqual([]);
  });

  it("hydrates valid entries", () => {
    const restored = normalizeLedger([
      {
        id: "x",
        subscriptionName: "Hulu",
        category: "entertainment",
        monthlyCostCents: 999,
        currency: "usd",
        cancelledOn: "2026-04-01",
        recordedAt: "2026-04-01T00:00:00.000Z",
        auto: true,
      },
    ]);
    expect(restored).toHaveLength(1);
    expect(restored[0].currency).toBe("USD");
    expect(restored[0].auto).toBe(true);
  });
});
