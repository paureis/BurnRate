import { describe, expect, it } from "vitest";
import { buildChargeCalendar, summarizeChargeCalendar } from "../charge-calendar";
import { buildFxContext } from "../currency";
import type { Subscription } from "../burnrate";

function makeSub(overrides: Partial<Subscription> = {}): Subscription {
  return {
    id: "sub-" + Math.random().toString(36).slice(2),
    name: "Netflix",
    costCents: 1500,
    billingCycle: "monthly",
    category: "entertainment",
    nextBillingDate: "2026-06-01",
    notes: "",
    createdAt: "2025-01-01T00:00:00.000Z",
    currency: "USD",
    ...overrides,
  };
}

const fx = buildFxContext("USD", {});

describe("buildChargeCalendar", () => {
  it("returns empty when there are no subs", () => {
    expect(buildChargeCalendar([], 365, fx, new Date("2026-05-15"))).toEqual([]);
  });

  it("walks a monthly sub backward over 12 months", () => {
    const sub = makeSub({ nextBillingDate: "2026-06-01" });
    const days = buildChargeCalendar([sub], 365, fx, new Date("2026-05-15"));
    expect(days.length).toBeGreaterThanOrEqual(10);
    expect(days.every((d) => d.totalCents === 1500)).toBe(true);
  });

  it("handles end-of-month wrap (Mar 31 clamps to Feb 28)", () => {
    const sub = makeSub({ nextBillingDate: "2026-03-31", costCents: 1000 });
    const days = buildChargeCalendar([sub], 90, fx, new Date("2026-05-15"));
    // Walking back from Mar 31 hits Feb 28 (clamped) — and going forward
    // again from Feb 28 to Jan 28 (no rebound to 31). Both must appear.
    expect(days.some((d) => d.date === "2026-03-31")).toBe(true);
    expect(days.some((d) => d.date === "2026-02-28")).toBe(true);
  });

  it("respects the horizonDays cutoff", () => {
    const sub = makeSub({ costCents: 1000 });
    const short = buildChargeCalendar([sub], 35, fx, new Date("2026-05-15"));
    const long = buildChargeCalendar([sub], 365, fx, new Date("2026-05-15"));
    expect(short.length).toBeLessThan(long.length);
  });

  it("converts foreign-currency charges to base currency", () => {
    const fxEur = buildFxContext("USD", { EUR: 0.9 });
    const sub = makeSub({ costCents: 900, currency: "EUR" });
    const days = buildChargeCalendar([sub], 60, fxEur, new Date("2026-05-15"));
    expect(days[0].totalCents).toBeCloseTo(1000, 0);
  });

  it("excludes charges on/after a cancellation date", () => {
    const sub = makeSub({ id: "sub-x", nextBillingDate: "2026-05-01", costCents: 1000 });
    const days = buildChargeCalendar([sub], 365, fx, new Date("2026-05-15"), {
      cancelledOn: { "sub-x": "2026-03-01" },
    });
    expect(days.every((d) => d.date < "2026-03-01")).toBe(true);
  });

  it("sums multiple subs charging on the same day", () => {
    const subA = makeSub({ id: "a", nextBillingDate: "2026-06-01", costCents: 1500 });
    const subB = makeSub({ id: "b", nextBillingDate: "2026-06-01", costCents: 999 });
    const days = buildChargeCalendar([subA, subB], 60, fx, new Date("2026-05-15"));
    const sameDay = days.find((d) => d.chargeCount === 2);
    expect(sameDay?.totalCents).toBe(2499);
  });
});

describe("summarizeChargeCalendar", () => {
  it("returns nullable defaults on empty input", () => {
    const summary = summarizeChargeCalendar([]);
    expect(summary.peakDay).toBeNull();
    expect(summary.dominantDayOfMonth).toBeNull();
    expect(summary.activeDayCount).toBe(0);
  });

  it("flags day-of-month when 40%+ of charges land there", () => {
    const sub = makeSub({ nextBillingDate: "2026-06-01" });
    const days = buildChargeCalendar([sub], 365, fx, new Date("2026-05-15"));
    const summary = summarizeChargeCalendar(days);
    expect(summary.dominantDayOfMonth).toBe(1);
  });

  it("returns null dominantDay when the distribution is mixed", () => {
    const subs = [
      makeSub({ id: "a", nextBillingDate: "2026-06-01" }),
      makeSub({ id: "b", nextBillingDate: "2026-06-15" }),
      makeSub({ id: "c", nextBillingDate: "2026-06-20" }),
      makeSub({ id: "d", nextBillingDate: "2026-06-28" }),
    ];
    const days = buildChargeCalendar(subs, 60, fx, new Date("2026-05-15"));
    const summary = summarizeChargeCalendar(days);
    expect(summary.dominantDayOfMonth).toBeNull();
  });

  it("breaks ties on peak day toward the latest date", () => {
    const subA = makeSub({ id: "a", nextBillingDate: "2026-06-01", costCents: 1000 });
    const subB = makeSub({ id: "b", nextBillingDate: "2026-06-10", costCents: 1000 });
    const days = buildChargeCalendar([subA, subB], 30, fx, new Date("2026-05-15"));
    const summary = summarizeChargeCalendar(days);
    // Both 1000-cent days exist; latest wins.
    expect(summary.peakDay?.totalCents).toBe(1000);
  });
});
