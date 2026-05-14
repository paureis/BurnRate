import { describe, expect, it } from "vitest";
import { monthKey, recordUsage, scoreUsage, shouldNudgeForMonth } from "../usage";
import type { Subscription, UsageEntry } from "../burnrate";
import type { BurnRatePreferences } from "../preferences";

function makeSub(overrides: Partial<Subscription> = {}): Subscription {
  return {
    id: "sub-1",
    name: "Netflix",
    costCents: 2000,
    billingCycle: "monthly",
    category: "entertainment",
    nextBillingDate: "2026-06-01",
    notes: "",
    createdAt: "2025-01-01T00:00:00.000Z",
    currency: "USD",
    ...overrides,
  };
}

function entry(used: boolean): UsageEntry {
  return { used, recordedAt: "2026-05-01T00:00:00.000Z" };
}

describe("scoreUsage", () => {
  it("marks subs with <2 months of data as untracked", () => {
    const sub = makeSub({ usageLog: { "2026-04": entry(true) } });
    expect(scoreUsage(sub, undefined, new Date("2026-05-15")).badge).toBe("untracked");
  });

  it("flags a hero when 3+ uses and cost-per-use <= $1", () => {
    const sub = makeSub({
      costCents: 100,
      usageLog: {
        "2026-03": entry(true),
        "2026-04": entry(true),
        "2026-05": entry(true),
      },
    });
    const score = scoreUsage(sub, undefined, new Date("2026-05-15"));
    expect(score.badge).toBe("hero");
    expect(score.costPerUseCents).toBe(100);
  });

  it("flags a steady when usage ratio >= 0.66", () => {
    const sub = makeSub({
      usageLog: {
        "2026-01": entry(true),
        "2026-02": entry(true),
        "2026-03": entry(true),
        "2026-04": entry(false),
      },
    });
    const score = scoreUsage(sub, undefined, new Date("2026-05-15"));
    expect(score.badge).toBe("steady");
  });

  it("flags a mixed when 0.33 <= ratio < 0.66 (no 3-month zero streak)", () => {
    const sub = makeSub({
      usageLog: {
        "2026-01": entry(true),
        "2026-02": entry(false),
        "2026-03": entry(true),
        "2026-04": entry(false),
      },
    });
    expect(scoreUsage(sub, undefined, new Date("2026-05-15")).badge).toBe("mixed");
  });

  it("flags a zombie when last 3+ months are zero-use", () => {
    const sub = makeSub({
      usageLog: {
        "2025-12": entry(true),
        "2026-01": entry(true),
        "2026-02": entry(false),
        "2026-03": entry(false),
        "2026-04": entry(false),
      },
    });
    const score = scoreUsage(sub, undefined, new Date("2026-05-15"));
    expect(score.badge).toBe("zombie");
    expect(score.monthsZeroUse).toBeGreaterThanOrEqual(3);
  });

  it("flags a ghost when no months are used", () => {
    const sub = makeSub({
      usageLog: {
        "2026-01": entry(false),
        "2026-02": entry(false),
        "2026-03": entry(false),
      },
    });
    expect(scoreUsage(sub, undefined, new Date("2026-05-15")).badge).toBe("ghost");
  });

  it("returns costPerUseCents=null when monthsUsed=0", () => {
    const sub = makeSub({ usageLog: { "2026-01": entry(false), "2026-02": entry(false) } });
    expect(scoreUsage(sub, undefined, new Date("2026-05-15")).costPerUseCents).toBeNull();
  });
});

describe("recordUsage", () => {
  it("is immutable", () => {
    const sub = makeSub();
    const next = recordUsage(sub, "2026-05", entry(true));
    expect(next).not.toBe(sub);
    expect(sub.usageLog).toBeUndefined();
    expect(next.usageLog?.["2026-05"].used).toBe(true);
  });

  it("overwrites an existing month entry", () => {
    const sub = makeSub({ usageLog: { "2026-05": entry(true) } });
    const next = recordUsage(sub, "2026-05", entry(false));
    expect(next.usageLog?.["2026-05"].used).toBe(false);
  });
});

describe("shouldNudgeForMonth", () => {
  it("returns true when no nudge has been recorded", () => {
    const prefs = { baseCurrency: "USD", fxOverrides: {}, lastFxOverrideAt: null, autoLockMinutes: 15 };
    expect(shouldNudgeForMonth(prefs as BurnRatePreferences, new Date("2026-05-14"))).toBe(true);
  });

  it("returns false within the same month as the last nudge", () => {
    const prefs = {
      baseCurrency: "USD",
      fxOverrides: {},
      lastFxOverrideAt: null,
      autoLockMinutes: 15,
      usageNudge: { lastNudgeMonth: "2026-05" },
    };
    expect(shouldNudgeForMonth(prefs as unknown as BurnRatePreferences, new Date("2026-05-14"))).toBe(false);
  });

  it("returns true when the calendar month rolls", () => {
    const prefs = {
      baseCurrency: "USD",
      fxOverrides: {},
      lastFxOverrideAt: null,
      autoLockMinutes: 15,
      usageNudge: { lastNudgeMonth: "2026-04" },
    };
    expect(shouldNudgeForMonth(prefs as unknown as BurnRatePreferences, new Date("2026-05-14"))).toBe(true);
  });
});

describe("monthKey", () => {
  it("formats as YYYY-MM", () => {
    expect(monthKey(new Date("2026-05-14"))).toBe("2026-05");
    expect(monthKey(new Date("2026-12-31"))).toBe("2026-12");
  });
});
