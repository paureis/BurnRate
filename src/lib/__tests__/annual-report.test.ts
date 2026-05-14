import { describe, expect, it } from "vitest";
import { buildAnnualReport, isReportReady } from "../annual-report";
import { buildFxContext } from "../currency";
import type { MonthlySnapshot } from "../snapshots";
import type { Subscription } from "../burnrate";
import type { CancellationRecord } from "../ledger";

function makeSnap(month: string, monthlyBurnCents: number): MonthlySnapshot {
  return {
    snapshotMonth: month,
    capturedAt: `${month}-01T00:00:00.000Z`,
    monthlyBurnCents,
    yearlyBurnCents: monthlyBurnCents * 12,
    subscriptionCount: 1,
    trialCount: 0,
    categoryBreakdown: { entertainment: monthlyBurnCents },
    baseCurrency: "USD",
  };
}

function makeSub(overrides: Partial<Subscription> = {}): Subscription {
  return {
    id: `sub-${Math.random().toString(36).slice(2)}`,
    name: "Netflix",
    costCents: 1500,
    billingCycle: "monthly",
    category: "entertainment",
    nextBillingDate: "2026-06-01",
    notes: "",
    createdAt: "2026-02-01T00:00:00.000Z",
    currency: "USD",
    ...overrides,
  };
}

function ledgerRow(month: string, name: string, monthlyCostCents: number): CancellationRecord {
  return {
    id: `led-${Math.random().toString(36).slice(2)}`,
    subscriptionName: name,
    category: "entertainment",
    monthlyCostCents,
    cancelledOn: month,
    recordedAt: `${month}T00:00:00.000Z`,
    auto: false,
    currency: "USD",
  };
}

describe("isReportReady", () => {
  it("requires 6+ in-year snapshots", () => {
    const fives = Array.from({ length: 5 }, (_, i) => makeSnap(`2026-0${i + 1}`, 1000));
    expect(isReportReady(2026, fives)).toBe(false);
    const sixes = [...fives, makeSnap("2026-06", 1100)];
    expect(isReportReady(2026, sixes)).toBe(true);
  });
});

describe("buildAnnualReport", () => {
  it("returns zeros gracefully on empty input", () => {
    const report = buildAnnualReport({
      year: 2026,
      baseCurrency: "USD",
      subscriptions: [],
      snapshots: [],
      ledger: [],
      fx: buildFxContext("USD", {}),
      now: new Date("2026-12-31"),
    });
    expect(report.totalSpendCents).toBe(0);
    expect(report.cancellationsCount).toBe(0);
    expect(report.partial).toBe(true);
  });

  it("identifies biggest and quietest months across in-year snapshots", () => {
    const snaps = [
      makeSnap("2026-01", 1000),
      makeSnap("2026-02", 800),
      makeSnap("2026-03", 1500),
      makeSnap("2026-04", 900),
      makeSnap("2026-05", 700),
      makeSnap("2026-06", 1100),
    ];
    const report = buildAnnualReport({
      year: 2026,
      baseCurrency: "USD",
      subscriptions: [],
      snapshots: snaps,
      ledger: [],
      now: new Date("2026-06-30"),
    });
    expect(report.biggestMonth.month).toBe("2026-03");
    expect(report.quietestMonth.month).toBe("2026-05");
  });

  it("sums ledger savings and identifies biggest win", () => {
    const ledger = [
      ledgerRow("2026-02-01", "Netflix", 1599),
      ledgerRow("2026-03-15", "Spotify", 999),
    ];
    const report = buildAnnualReport({
      year: 2026,
      baseCurrency: "USD",
      subscriptions: [],
      snapshots: [makeSnap("2026-06", 1000), makeSnap("2026-07", 1000), makeSnap("2026-08", 1000), makeSnap("2026-09", 1000), makeSnap("2026-10", 1000), makeSnap("2026-11", 1000)],
      ledger,
      now: new Date("2026-12-31"),
    });
    expect(report.cancellationsCount).toBe(2);
    expect(report.biggestWin?.name).toBe("Netflix");
  });

  it("filters in-year ledger entries from prior years", () => {
    const ledger = [
      ledgerRow("2025-12-01", "PriorYear", 1000),
      ledgerRow("2026-03-15", "ThisYear", 500),
    ];
    const report = buildAnnualReport({
      year: 2026,
      baseCurrency: "USD",
      subscriptions: [],
      snapshots: Array.from({ length: 6 }, (_, i) => makeSnap(`2026-0${i + 1}`, 1000)),
      ledger,
      now: new Date("2026-06-30"),
    });
    expect(report.cancellationsCount).toBe(1);
    expect(report.biggestWin?.name).toBe("ThisYear");
  });

  it("counts new-in-year subs and category breakdown", () => {
    const subs = [
      makeSub({ id: "a", createdAt: "2026-01-15T00:00:00.000Z", category: "music", costCents: 1000 }),
      makeSub({ id: "b", createdAt: "2026-03-20T00:00:00.000Z", category: "entertainment", costCents: 2000 }),
      makeSub({ id: "c", createdAt: "2025-12-01T00:00:00.000Z", category: "entertainment", costCents: 500 }),
    ];
    const report = buildAnnualReport({
      year: 2026,
      baseCurrency: "USD",
      subscriptions: subs,
      snapshots: Array.from({ length: 6 }, (_, i) => makeSnap(`2026-0${i + 1}`, 1000)),
      ledger: [],
      now: new Date("2026-06-30"),
    });
    expect(report.newSubsAdded).toBe(2);
    expect(report.topSubscriptions[0].name).toBe(subs[1].name);
    expect(report.topSubscriptions[0].cents).toBe(2000 * 12);
  });

  it("sets partial=true with under 12 snapshots and partial=false at 12", () => {
    const twelve = Array.from({ length: 12 }, (_, i) =>
      makeSnap(`2026-${String(i + 1).padStart(2, "0")}`, 1000),
    );
    const full = buildAnnualReport({
      year: 2026,
      baseCurrency: "USD",
      subscriptions: [],
      snapshots: twelve,
      ledger: [],
      now: new Date("2026-12-31"),
    });
    expect(full.partial).toBe(false);
    const partial = buildAnnualReport({
      year: 2026,
      baseCurrency: "USD",
      subscriptions: [],
      snapshots: twelve.slice(0, 6),
      ledger: [],
      now: new Date("2026-06-30"),
    });
    expect(partial.partial).toBe(true);
  });
});
