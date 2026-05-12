import type { BurnRateData, Subscription } from "./burnrate";
import { yearlyCostCents } from "./burnrate";

export interface BudgetGoal {
  monthlyCapCents: number | null;
  annualSavingsTargetCents: number | null;
  targetDate: string | null;
  baselineYearlyCents: number | null;
  createdAt: string | null;
}

export const emptyBudget: BudgetGoal = {
  monthlyCapCents: null,
  annualSavingsTargetCents: null,
  targetDate: null,
  baselineYearlyCents: null,
  createdAt: null,
};

export interface CapStatus {
  hasCap: boolean;
  capCents: number;
  ratio: number; // 0.0+, may exceed 1
  tone: "good" | "warning" | "danger" | "over";
  remainingCents: number; // can be negative
}

export function evaluateCap(monthlyBurnCents: number, budget: BudgetGoal): CapStatus {
  const capCents = budget.monthlyCapCents ?? 0;
  if (!budget.monthlyCapCents || budget.monthlyCapCents <= 0) {
    return { hasCap: false, capCents: 0, ratio: 0, tone: "good", remainingCents: 0 };
  }
  const ratio = monthlyBurnCents / capCents;
  let tone: CapStatus["tone"] = "good";
  if (ratio >= 1.0001) {
    tone = "over";
  } else if (ratio >= 0.95) {
    tone = "danger";
  } else if (ratio >= 0.7) {
    tone = "warning";
  }
  return {
    hasCap: true,
    capCents,
    ratio,
    tone,
    remainingCents: capCents - monthlyBurnCents,
  };
}

export interface SavingsProgress {
  hasGoal: boolean;
  baselineYearlyCents: number;
  currentYearlyCents: number;
  savedYearlyCents: number; // positive = saved
  targetCents: number;
  ratio: number; // 0..1+ progress to the target
  daysRemaining: number | null;
  targetDate: string | null;
  baselineDate: string | null;
}

export function evaluateSavings(
  currentYearlyCents: number,
  budget: BudgetGoal,
  today = new Date(),
): SavingsProgress {
  if (!budget.annualSavingsTargetCents || !budget.baselineYearlyCents) {
    return {
      hasGoal: false,
      baselineYearlyCents: 0,
      currentYearlyCents,
      savedYearlyCents: 0,
      targetCents: 0,
      ratio: 0,
      daysRemaining: null,
      targetDate: budget.targetDate,
      baselineDate: budget.createdAt,
    };
  }
  const saved = budget.baselineYearlyCents - currentYearlyCents;
  const ratio = budget.annualSavingsTargetCents > 0 ? saved / budget.annualSavingsTargetCents : 0;
  return {
    hasGoal: true,
    baselineYearlyCents: budget.baselineYearlyCents,
    currentYearlyCents,
    savedYearlyCents: saved,
    targetCents: budget.annualSavingsTargetCents,
    ratio,
    daysRemaining: budget.targetDate ? daysUntil(budget.targetDate, today) : null,
    targetDate: budget.targetDate,
    baselineDate: budget.createdAt,
  };
}

export interface BudgetValidationError {
  field: "monthlyCap" | "annualSavings" | "targetDate";
  message: string;
}

export interface SetBudgetInput {
  monthlyCapCents: number | null;
  annualSavingsTargetCents: number | null;
  targetDate: string | null;
  subscriptions: Subscription[];
  existingBudget: BudgetGoal;
}

export function validateBudgetInput(input: SetBudgetInput): BudgetValidationError[] {
  const errors: BudgetValidationError[] = [];
  if (input.monthlyCapCents !== null && input.monthlyCapCents <= 0) {
    errors.push({ field: "monthlyCap", message: "Monthly cap must be greater than $0." });
  }
  if (input.annualSavingsTargetCents !== null && input.annualSavingsTargetCents <= 0) {
    errors.push({ field: "annualSavings", message: "Savings target must be greater than $0." });
  }
  if (input.targetDate && !/^\d{4}-\d{2}-\d{2}$/.test(input.targetDate)) {
    errors.push({ field: "targetDate", message: "Target date must be a calendar date." });
  }
  return errors;
}

export function buildBudgetFromInput(input: SetBudgetInput, now = new Date()): BudgetGoal {
  const baselineYearlyCents =
    input.annualSavingsTargetCents !== null
      ? input.existingBudget.baselineYearlyCents ?? totalYearlyCents(input.subscriptions)
      : null;
  return {
    monthlyCapCents: input.monthlyCapCents,
    annualSavingsTargetCents: input.annualSavingsTargetCents,
    targetDate: input.targetDate,
    baselineYearlyCents,
    createdAt: input.annualSavingsTargetCents !== null ? input.existingBudget.createdAt ?? now.toISOString() : null,
  };
}

export function totalYearlyCents(subscriptions: Subscription[]): number {
  return subscriptions.reduce((sum, subscription) => sum + yearlyCostCents(subscription), 0);
}

export function isBudgetSet(budget: BudgetGoal): boolean {
  return budget.monthlyCapCents !== null || budget.annualSavingsTargetCents !== null;
}

export function budgetCsvRow(budget: BudgetGoal): Record<string, string> {
  return {
    recordType: "budget",
    monthlyCapCents: budget.monthlyCapCents != null ? String(budget.monthlyCapCents) : "",
    annualSavingsTargetCents: budget.annualSavingsTargetCents != null ? String(budget.annualSavingsTargetCents) : "",
    targetDate: budget.targetDate ?? "",
    baselineYearlyCents: budget.baselineYearlyCents != null ? String(budget.baselineYearlyCents) : "",
    createdAt: budget.createdAt ?? "",
  };
}

export function budgetFromCsvRow(row: Record<string, string>): BudgetGoal {
  return {
    monthlyCapCents: row.monthlyCapCents ? toIntegerOrNull(row.monthlyCapCents) : null,
    annualSavingsTargetCents: row.annualSavingsTargetCents
      ? toIntegerOrNull(row.annualSavingsTargetCents)
      : null,
    targetDate: row.targetDate || null,
    baselineYearlyCents: row.baselineYearlyCents ? toIntegerOrNull(row.baselineYearlyCents) : null,
    createdAt: row.createdAt || null,
  };
}

function toIntegerOrNull(value: string): number | null {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function daysUntil(targetDate: string, today: Date): number {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(targetDate);
  if (!match) return 0;
  const target = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  return Math.round((target.getTime() - start.getTime()) / (24 * 60 * 60 * 1000));
}

export function applyBudgetToData(data: BurnRateData, budget: BudgetGoal): BurnRateData & { budget: BudgetGoal } {
  return { ...data, budget };
}
