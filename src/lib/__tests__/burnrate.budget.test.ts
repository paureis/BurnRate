import { describe, expect, it } from "vitest";
import {
  buildBudgetFromInput,
  budgetCsvRow,
  budgetFromCsvRow,
  emptyBudget,
  evaluateCap,
  evaluateSavings,
  isBudgetSet,
  totalYearlyCents,
  validateBudgetInput,
} from "@/lib/budget";
import { parseBurnRateCsv, serializeBurnRateCsv, type Subscription } from "@/lib/burnrate";

function makeSubscription(overrides: Partial<Subscription> = {}): Subscription {
  return {
    id: overrides.id ?? "s1",
    name: overrides.name ?? "Netflix",
    costCents: overrides.costCents ?? 1599,
    billingCycle: overrides.billingCycle ?? "monthly",
    category: overrides.category ?? "entertainment",
    nextBillingDate: overrides.nextBillingDate ?? "2026-06-01",
    notes: overrides.notes ?? "",
    color: overrides.color,
    icon: overrides.icon,
    createdAt: overrides.createdAt ?? "2026-01-01T00:00:00.000Z",
  };
}

describe("evaluateCap thresholds", () => {
  it("returns hasCap: false when no cap is set", () => {
    expect(evaluateCap(5000, emptyBudget)).toEqual({ hasCap: false, capCents: 0, ratio: 0, tone: "good", remainingCents: 0 });
  });

  it("classifies the tone at 0%, 50%, 100%, and 150% of cap", () => {
    const budget = { ...emptyBudget, monthlyCapCents: 10000 };
    expect(evaluateCap(0, budget).tone).toBe("good");
    expect(evaluateCap(5000, budget).tone).toBe("good");
    expect(evaluateCap(7500, budget).tone).toBe("warning");
    expect(evaluateCap(9700, budget).tone).toBe("danger");
    expect(evaluateCap(10001, budget).tone).toBe("over");
    expect(evaluateCap(15000, budget).tone).toBe("over");
  });

  it("computes remainingCents and ratio correctly", () => {
    const budget = { ...emptyBudget, monthlyCapCents: 10000 };
    const status = evaluateCap(7500, budget);
    expect(status.ratio).toBeCloseTo(0.75);
    expect(status.remainingCents).toBe(2500);
  });
});

describe("evaluateSavings", () => {
  it("returns hasGoal: false when no annual savings target", () => {
    expect(evaluateSavings(50000, emptyBudget).hasGoal).toBe(false);
  });

  it("calculates saved amount and progress ratio", () => {
    const budget = {
      ...emptyBudget,
      annualSavingsTargetCents: 20000,
      baselineYearlyCents: 100000,
      targetDate: "2026-12-31",
      createdAt: "2026-01-01T00:00:00.000Z",
    };
    const progress = evaluateSavings(85000, budget);
    expect(progress.savedYearlyCents).toBe(15000);
    expect(progress.ratio).toBeCloseTo(0.75);
  });

  it("computes daysRemaining relative to provided today", () => {
    const budget = {
      ...emptyBudget,
      annualSavingsTargetCents: 5000,
      baselineYearlyCents: 100000,
      targetDate: "2026-06-30",
      createdAt: "2026-01-01T00:00:00.000Z",
    };
    const today = new Date(2026, 5, 20); // 2026-06-20
    const progress = evaluateSavings(95000, budget, today);
    expect(progress.daysRemaining).toBe(10);
  });
});

describe("validateBudgetInput", () => {
  it("rejects monthly cap of 0 or negative", () => {
    const errors = validateBudgetInput({
      monthlyCapCents: 0,
      annualSavingsTargetCents: null,
      targetDate: null,
      subscriptions: [],
      existingBudget: emptyBudget,
    });
    expect(errors).toContainEqual({ field: "monthlyCap", message: "Monthly cap must be greater than $0." });
  });

  it("rejects negative savings target", () => {
    const errors = validateBudgetInput({
      monthlyCapCents: null,
      annualSavingsTargetCents: -1000,
      targetDate: null,
      subscriptions: [],
      existingBudget: emptyBudget,
    });
    expect(errors).toContainEqual({ field: "annualSavings", message: "Savings target must be greater than $0." });
  });

  it("accepts null/empty fields without error", () => {
    expect(
      validateBudgetInput({
        monthlyCapCents: null,
        annualSavingsTargetCents: null,
        targetDate: null,
        subscriptions: [],
        existingBudget: emptyBudget,
      }),
    ).toEqual([]);
  });

  it("rejects malformed target date strings", () => {
    const errors = validateBudgetInput({
      monthlyCapCents: 1000,
      annualSavingsTargetCents: null,
      targetDate: "tomorrow",
      subscriptions: [],
      existingBudget: emptyBudget,
    });
    expect(errors.some((e) => e.field === "targetDate")).toBe(true);
  });
});

describe("buildBudgetFromInput", () => {
  it("captures the current yearly total as baseline when annual savings is set", () => {
    const subscriptions = [
      makeSubscription({ billingCycle: "yearly", costCents: 12000 }),
      makeSubscription({ id: "s2", billingCycle: "monthly", costCents: 1000 }),
    ];
    const baseline = totalYearlyCents(subscriptions);
    const next = buildBudgetFromInput(
      {
        monthlyCapCents: null,
        annualSavingsTargetCents: 5000,
        targetDate: null,
        subscriptions,
        existingBudget: emptyBudget,
      },
      new Date(2026, 0, 1),
    );
    expect(next.baselineYearlyCents).toBe(baseline);
    expect(next.createdAt).toMatch(/^2026-01-01T/);
  });

  it("preserves prior baseline when re-saving an existing savings goal", () => {
    const existing = {
      ...emptyBudget,
      annualSavingsTargetCents: 5000,
      baselineYearlyCents: 99999,
      createdAt: "2025-12-01T00:00:00.000Z",
    };
    const next = buildBudgetFromInput({
      monthlyCapCents: null,
      annualSavingsTargetCents: 6000,
      targetDate: null,
      subscriptions: [makeSubscription()],
      existingBudget: existing,
    });
    expect(next.baselineYearlyCents).toBe(99999);
    expect(next.createdAt).toBe("2025-12-01T00:00:00.000Z");
  });
});

describe("isBudgetSet", () => {
  it("returns false for empty budget", () => {
    expect(isBudgetSet(emptyBudget)).toBe(false);
  });
  it("returns true when at least one field is set", () => {
    expect(isBudgetSet({ ...emptyBudget, monthlyCapCents: 1000 })).toBe(true);
    expect(isBudgetSet({ ...emptyBudget, annualSavingsTargetCents: 1000 })).toBe(true);
  });
});

describe("budget CSV row helpers", () => {
  it("round-trips a budget through serialize/parse helpers", () => {
    const budget = {
      monthlyCapCents: 5000,
      annualSavingsTargetCents: 12000,
      targetDate: "2026-12-31",
      baselineYearlyCents: 100000,
      createdAt: "2026-01-01T00:00:00.000Z",
    };
    const row = budgetCsvRow(budget);
    const parsed = budgetFromCsvRow(row);
    expect(parsed).toEqual(budget);
  });
});

describe("CSV round-trip with budget", () => {
  it("serializeBurnRateCsv + parseBurnRateCsv preserve budget", () => {
    const data = {
      subscriptions: [makeSubscription()],
      trials: [],
      theme: "dark" as const,
      budget: {
        monthlyCapCents: 5000,
        annualSavingsTargetCents: 20000,
        targetDate: "2026-12-31",
        baselineYearlyCents: 100000,
        createdAt: "2026-01-01T00:00:00.000Z",
      },
    };
    const csv = serializeBurnRateCsv(data);
    const parsed = parseBurnRateCsv(csv);
    expect(parsed.budget).toEqual(data.budget);
  });

  it("omits budget row when budget is empty", () => {
    const data = {
      subscriptions: [makeSubscription()],
      trials: [],
      theme: "dark" as const,
      budget: { ...emptyBudget },
    };
    const csv = serializeBurnRateCsv(data);
    expect(csv).not.toContain("\nbudget,");
    expect(parseBurnRateCsv(csv).budget).toBeUndefined();
  });
});
