import { describe, expect, it } from "vitest";
import {
  consecutiveMonthsUnderCap,
  evaluateGoals,
  migrateFromBudgetGoal,
  progressOfGoal,
  streakDaysWithoutNewSub,
  type AppStateForGoals,
  type Goal,
} from "../goals";
import type { MonthlySnapshot } from "../snapshots";
import type { Subscription } from "../burnrate";

function makeSub(createdAt: string, overrides: Partial<Subscription> = {}): Subscription {
  return {
    id: `sub-${createdAt}`,
    name: "Netflix",
    costCents: 1500,
    billingCycle: "monthly",
    category: "entertainment",
    nextBillingDate: "2026-06-01",
    notes: "",
    createdAt,
    currency: "USD",
    ...overrides,
  };
}

function snap(month: string, monthlyBurnCents: number): MonthlySnapshot {
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

function emptyState(over: Partial<AppStateForGoals> = {}): AppStateForGoals {
  return {
    subscriptions: [],
    snapshots: [],
    monthlyBurnCents: 0,
    yearlyBurnCents: 0,
    ...over,
  };
}

function activeGoal(over: Partial<Goal>): Goal {
  return {
    id: "g1",
    type: "monthly-cap",
    label: "test",
    createdAt: "2026-04-01T00:00:00.000Z",
    state: "active",
    history: [],
    ...over,
  };
}

describe("streakDaysWithoutNewSub", () => {
  it("returns 0 when no subs", () => {
    expect(streakDaysWithoutNewSub([], new Date("2026-05-14"))).toBe(0);
  });

  it("returns days since the most recent createdAt", () => {
    const subs = [
      makeSub("2026-05-01T00:00:00.000Z"),
      makeSub("2026-05-10T00:00:00.000Z"),
    ];
    expect(streakDaysWithoutNewSub(subs, new Date("2026-05-14"))).toBe(4);
  });
});

describe("consecutiveMonthsUnderCap", () => {
  it("stops at the first cap-exceeding month walking back", () => {
    const snaps = [
      snap("2026-01", 1000),
      snap("2026-02", 800),
      snap("2026-03", 1500),  // exceeds cap 1000
      snap("2026-04", 900),
      snap("2026-05", 700),
    ];
    expect(consecutiveMonthsUnderCap(snaps, 1000)).toBe(2);
  });

  it("returns 0 when no snapshots", () => {
    expect(consecutiveMonthsUnderCap([], 1000)).toBe(0);
  });
});

describe("evaluateGoals", () => {
  it("achieves an annual-savings goal when saved >= target", () => {
    const goals = [
      activeGoal({
        type: "annual-savings",
        targetCents: 1000,
        baselineCents: 12000,
      }),
    ];
    const state = emptyState({ yearlyBurnCents: 10500 });
    const next = evaluateGoals(goals, state, undefined, new Date("2026-05-15"));
    expect(next[0].state).toBe("achieved");
    expect(next[0].history.some((h) => h.event === "achieved")).toBe(true);
  });

  it("fails an annual-savings goal when targetDate passes without success", () => {
    const goals = [
      activeGoal({
        type: "annual-savings",
        targetCents: 1000,
        baselineCents: 12000,
        targetDate: "2026-05-01",
      }),
    ];
    const state = emptyState({ yearlyBurnCents: 11900 });
    const next = evaluateGoals(goals, state, undefined, new Date("2026-05-15"));
    expect(next[0].state).toBe("failed");
  });

  it("achieves a no-new-subs streak when target days reached", () => {
    const goals = [
      activeGoal({ type: "no-new-subs-streak", targetDays: 30 }),
    ];
    const state = emptyState({
      subscriptions: [makeSub("2026-03-01T00:00:00.000Z")],
    });
    const next = evaluateGoals(goals, state, undefined, new Date("2026-05-15"));
    expect(next[0].state).toBe("achieved");
  });

  it("achieves a monthly-cap-streak when consecutive months under cap >= target", () => {
    const goals = [
      activeGoal({ type: "monthly-cap-streak", targetCents: 5000, targetMonths: 3 }),
    ];
    const state = emptyState({
      snapshots: [snap("2026-03", 4000), snap("2026-04", 4200), snap("2026-05", 4500)],
    });
    const next = evaluateGoals(goals, state, undefined, new Date("2026-05-15"));
    expect(next[0].state).toBe("achieved");
  });

  it("is idempotent — re-evaluating an achieved goal leaves it alone", () => {
    const goals = [
      activeGoal({
        type: "annual-savings",
        targetCents: 1000,
        baselineCents: 12000,
        state: "achieved",
        achievedAt: "2026-05-01T00:00:00.000Z",
      }),
    ];
    const next = evaluateGoals(goals, emptyState({ yearlyBurnCents: 10000 }), undefined, new Date("2026-05-15"));
    expect(next[0].state).toBe("achieved");
    expect(next[0].history.length).toBe(0); // we never re-pushed an event
  });
});

describe("progressOfGoal", () => {
  it("returns red when burn exceeds the monthly cap", () => {
    const goal = activeGoal({ type: "monthly-cap", targetCents: 5000 });
    const state = emptyState({ monthlyBurnCents: 6000 });
    expect(progressOfGoal(goal, state).color).toBe("red");
  });

  it("returns green for an annual-savings goal at target", () => {
    const goal = activeGoal({
      type: "annual-savings",
      targetCents: 1000,
      baselineCents: 12000,
    });
    const state = emptyState({ yearlyBurnCents: 11000 });
    expect(progressOfGoal(goal, state).color).toBe("green");
  });

  it("surfaces nextMilestoneDays on a streak progress", () => {
    const goal = activeGoal({ type: "no-new-subs-streak", targetDays: 30 });
    const state = emptyState({ subscriptions: [makeSub("2026-05-10T00:00:00.000Z")] });
    const p = progressOfGoal(goal, state, undefined, new Date("2026-05-15"));
    expect(p.nextMilestoneDays).toBe(25);
  });
});

describe("migrateFromBudgetGoal", () => {
  it("returns nothing when no budget is set", () => {
    expect(migrateFromBudgetGoal(undefined)).toEqual([]);
  });

  it("creates a monthly-cap goal when cap is set", () => {
    const result = migrateFromBudgetGoal(
      {
        monthlyCapCents: 5000,
        annualSavingsTargetCents: null,
        targetDate: null,
        baselineYearlyCents: null,
        createdAt: "2026-04-01T00:00:00.000Z",
      },
      new Date("2026-05-15"),
    );
    expect(result.length).toBe(1);
    expect(result[0].type).toBe("monthly-cap");
  });

  it("creates two goals when both fields are set", () => {
    const result = migrateFromBudgetGoal(
      {
        monthlyCapCents: 5000,
        annualSavingsTargetCents: 12000,
        targetDate: "2026-12-31",
        baselineYearlyCents: 60000,
        createdAt: "2026-04-01T00:00:00.000Z",
      },
      new Date("2026-05-15"),
    );
    expect(result.length).toBe(2);
    expect(result.map((g) => g.type).sort()).toEqual(["annual-savings", "monthly-cap"]);
  });
});
