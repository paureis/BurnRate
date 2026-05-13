import { describe, it, expect } from "vitest";
import type { Subscription, Trial } from "../burnrate";
import { buildFxContext } from "../currency";
import {
  buildForecastPoints,
  buildSnapshot,
  buildTrendInsights,
  captureSnapshotIfNeeded,
  currentMonthKey,
  pruneSnapshots,
  type MonthlySnapshot,
} from "../snapshots";

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
    currency: overrides.currency ?? "USD",
    ...overrides,
  };
}

function snapshot(month: string, monthlyBurnCents: number): MonthlySnapshot {
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

describe("currentMonthKey", () => {
  it("produces YYYY-MM", () => {
    // Construct via local-time constructor so the test is timezone-independent.
    expect(currentMonthKey(new Date(2026, 4, 12))).toBe("2026-05");
    expect(currentMonthKey(new Date(2026, 0, 1))).toBe("2026-01");
  });
});

describe("buildSnapshot", () => {
  it("captures monthly burn in base currency", () => {
    const subs: Subscription[] = [sub({ name: "Netflix", costCents: 1599, currency: "USD" })];
    const trials: Trial[] = [];
    const fx = buildFxContext("USD");
    const snap = buildSnapshot(subs, trials, fx, new Date("2026-05-12"));
    expect(snap.snapshotMonth).toBe("2026-05");
    expect(snap.monthlyBurnCents).toBe(1599);
    expect(snap.subscriptionCount).toBe(1);
    expect(snap.categoryBreakdown.entertainment).toBe(1599);
  });

  it("converts foreign-currency subs into base currency", () => {
    const subs: Subscription[] = [sub({ name: "Spotify", costCents: 999, currency: "EUR" })];
    const fx = buildFxContext("USD");
    const snap = buildSnapshot(subs, [], fx, new Date("2026-05-12"));
    // 9.99 EUR / 0.93 = ~$10.74 → 1074 cents (rounded)
    expect(snap.monthlyBurnCents).toBeGreaterThan(1000);
    expect(snap.monthlyBurnCents).toBeLessThan(1200);
  });
});

describe("pruneSnapshots", () => {
  it("keeps within the limit, dropping oldest", () => {
    const snapshots = Array.from({ length: 30 }, (_, i) =>
      snapshot(`2024-${String((i % 12) + 1).padStart(2, "0")}`, 1000 + i),
    );
    const pruned = pruneSnapshots(snapshots, 24);
    expect(pruned).toHaveLength(24);
  });

  it("does not modify input when under the limit", () => {
    const input = [snapshot("2026-01", 100), snapshot("2026-02", 200)];
    expect(pruneSnapshots(input, 24)).toHaveLength(2);
  });
});

describe("captureSnapshotIfNeeded", () => {
  it("captures when no existing snapshots for the current month", () => {
    const result = captureSnapshotIfNeeded([], () => snapshot("2026-05", 1000), new Date("2026-05-12"));
    expect(result.added).not.toBeNull();
    expect(result.snapshots).toHaveLength(1);
  });

  it("does not duplicate when this month is already captured", () => {
    const existing = [snapshot("2026-05", 1000)];
    const result = captureSnapshotIfNeeded(existing, () => snapshot("2026-05", 9999), new Date("2026-05-12"));
    expect(result.added).toBeNull();
    expect(result.snapshots).toHaveLength(1);
    expect(result.snapshots[0].monthlyBurnCents).toBe(1000);
  });

  it("is idempotent within a month", () => {
    const fn = () => snapshot("2026-05", 1000);
    const first = captureSnapshotIfNeeded([], fn, new Date("2026-05-12"));
    const second = captureSnapshotIfNeeded(first.snapshots, fn, new Date("2026-05-12"));
    expect(second.added).toBeNull();
    expect(second.snapshots).toEqual(first.snapshots);
  });
});

describe("buildTrendInsights", () => {
  it("returns nothing with fewer than 2 snapshots", () => {
    expect(buildTrendInsights([snapshot("2026-05", 1000)], 1000)).toEqual([]);
  });

  it("produces a 3-month delta insight when history exists", () => {
    const history = [
      snapshot("2026-01", 1000),
      snapshot("2026-02", 1100),
      snapshot("2026-03", 1200),
      snapshot("2026-04", 1300),
      snapshot("2026-05", 2000),
    ];
    const insights = buildTrendInsights(history, 2000);
    expect(insights.some((i) => i.id === "trend-3mo")).toBe(true);
    expect(insights.some((i) => i.id === "trend-forecast")).toBe(true);
  });

  it("flags a peak month different from the latest", () => {
    const history = [
      snapshot("2026-01", 2000),
      snapshot("2026-02", 1500),
      snapshot("2026-03", 1000),
    ];
    const insights = buildTrendInsights(history, 1000);
    expect(insights.some((i) => i.id === "trend-peak")).toBe(true);
  });
});

describe("buildForecastPoints", () => {
  it("appends the next 12 months after history", () => {
    const history = [snapshot("2026-04", 1000)];
    const points = buildForecastPoints(history, 1000, 12, new Date("2026-05-15"));
    expect(points.length).toBeGreaterThanOrEqual(13);
    expect(points.some((p) => p.projection)).toBe(true);
  });
});
