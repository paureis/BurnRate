// v5 Feature 6: Goal engine v2. Generalizes the v2 BudgetGoal into a
// richer typed Goal slice with category caps, no-new-sub streaks, and
// monthly-cap streaks.

import { monthlyCostInBaseCents, type Subscription } from "./burnrate";
import type { MonthlySnapshot } from "./snapshots";
import type { FxContext } from "./currency";
import type { BudgetGoal } from "./budget";

export type GoalType =
  | "monthly-cap"
  | "category-cap"
  | "annual-savings"
  | "no-new-subs-streak"
  | "monthly-cap-streak";

export type GoalState = "active" | "achieved" | "failed" | "archived";

export interface GoalHistoryEvent {
  at: string;
  event: "created" | "reset" | "achieved" | "failed" | "milestone";
  note?: string;
}

export interface Goal {
  id: string;
  type: GoalType;
  label: string;
  createdAt: string;
  targetCents?: number;
  targetDays?: number;
  targetMonths?: number;
  targetDate?: string;
  categoryId?: string;
  baselineCents?: number;
  state: GoalState;
  achievedAt?: string;
  history: GoalHistoryEvent[];
}

export interface GoalsState {
  items: Goal[];
}

export interface GoalProgress {
  goalId: string;
  pct: number;                // 0..1
  label: string;
  timeRemainingDays?: number;
  nextMilestoneCents?: number;
  nextMilestoneDays?: number;
  color: "green" | "amber" | "red";
}

export interface AppStateForGoals {
  subscriptions: Subscription[];
  snapshots: MonthlySnapshot[];
  monthlyBurnCents: number;
  yearlyBurnCents: number;
}

const dayMs = 24 * 60 * 60 * 1000;

/**
 * Boot-time sweep. Transitions active goals to `achieved` or `failed` based
 * on the current state. Returns a fresh `Goal[]` so callers can persist.
 */
export function evaluateGoals(
  goals: Goal[],
  state: AppStateForGoals,
  fx?: FxContext,
  now: Date = new Date(),
): Goal[] {
  return goals.map((goal) => {
    if (goal.state !== "active") return goal;
    const result = evaluateOne(goal, state, fx, now);
    if (result.next === "achieved") {
      return {
        ...goal,
        state: "achieved",
        achievedAt: now.toISOString(),
        history: [...goal.history, { at: now.toISOString(), event: "achieved" }],
      };
    }
    if (result.next === "failed") {
      return {
        ...goal,
        state: "failed",
        history: [...goal.history, { at: now.toISOString(), event: "failed" }],
      };
    }
    return goal;
  });
}

/**
 * Build a UI-friendly progress payload for one goal.
 */
export function progressOfGoal(
  goal: Goal,
  state: AppStateForGoals,
  fx?: FxContext,
  now: Date = new Date(),
): GoalProgress {
  switch (goal.type) {
    case "monthly-cap":
      return monthlyCapProgress(goal, state);
    case "category-cap":
      return categoryCapProgress(goal, state, fx);
    case "annual-savings":
      return annualSavingsProgress(goal, state, now);
    case "no-new-subs-streak":
      return streakProgress(goal, streakDaysWithoutNewSub(state.subscriptions, now));
    case "monthly-cap-streak":
      return capStreakProgress(goal, state.snapshots);
  }
}

/**
 * Returns the number of days since the latest subscription was added.
 * Compares UTC dates to avoid local-TZ off-by-one on midnight boundaries.
 */
export function streakDaysWithoutNewSub(subs: Subscription[], now: Date = new Date()): number {
  if (subs.length === 0) return 0;
  let mostRecent = 0;
  for (const sub of subs) {
    const ts = Date.parse(sub.createdAt);
    if (Number.isFinite(ts) && ts > mostRecent) mostRecent = ts;
  }
  if (mostRecent === 0) return 0;
  const createdUtc = Date.UTC(
    new Date(mostRecent).getUTCFullYear(),
    new Date(mostRecent).getUTCMonth(),
    new Date(mostRecent).getUTCDate(),
  );
  const nowUtc = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return Math.max(0, Math.round((nowUtc - createdUtc) / dayMs));
}

/**
 * Count consecutive snapshots, walking back from the latest, where
 * monthlyBurnCents <= capCents. Stops at the first cap-exceeding month.
 */
export function consecutiveMonthsUnderCap(snapshots: MonthlySnapshot[], capCents: number): number {
  if (snapshots.length === 0) return 0;
  const sorted = [...snapshots].sort((a, b) => b.snapshotMonth.localeCompare(a.snapshotMonth));
  let count = 0;
  for (const snap of sorted) {
    if (snap.monthlyBurnCents > capCents) break;
    count += 1;
  }
  return count;
}

/**
 * Migrate a v2 BudgetGoal into the v5 Goal[] shape. Both monthly cap and
 * annual savings target become their own goal records (if set).
 */
export function migrateFromBudgetGoal(budget: BudgetGoal | undefined, now: Date = new Date()): Goal[] {
  if (!budget) return [];
  const out: Goal[] = [];
  if (budget.monthlyCapCents != null && budget.monthlyCapCents > 0) {
    out.push({
      id: "migrated-monthly-cap",
      type: "monthly-cap",
      label: `Monthly cap`,
      createdAt: budget.createdAt ?? now.toISOString(),
      targetCents: budget.monthlyCapCents,
      state: "active",
      history: [{ at: now.toISOString(), event: "created", note: "Migrated from v2 budget." }],
    });
  }
  if (budget.annualSavingsTargetCents != null && budget.annualSavingsTargetCents > 0) {
    out.push({
      id: "migrated-annual-savings",
      type: "annual-savings",
      label: `Annual savings target`,
      createdAt: budget.createdAt ?? now.toISOString(),
      targetCents: budget.annualSavingsTargetCents,
      targetDate: budget.targetDate ?? undefined,
      baselineCents: budget.baselineYearlyCents ?? undefined,
      state: "active",
      history: [{ at: now.toISOString(), event: "created", note: "Migrated from v2 budget." }],
    });
  }
  return out;
}

function evaluateOne(
  goal: Goal,
  state: AppStateForGoals,
  fx: FxContext | undefined,
  now: Date,
): { next: GoalState } {
  switch (goal.type) {
    case "monthly-cap":
      return { next: "active" };
    case "category-cap":
      return { next: "active" };
    case "annual-savings": {
      if (goal.targetCents !== undefined && goal.baselineCents !== undefined) {
        const saved = goal.baselineCents - state.yearlyBurnCents;
        if (saved >= goal.targetCents) return { next: "achieved" };
      }
      if (goal.targetDate && goal.targetDate < isoDay(now)) return { next: "failed" };
      return { next: "active" };
    }
    case "no-new-subs-streak": {
      const days = streakDaysWithoutNewSub(state.subscriptions, now);
      if (goal.targetDays !== undefined && days >= goal.targetDays) return { next: "achieved" };
      return { next: "active" };
    }
    case "monthly-cap-streak": {
      if (goal.targetCents !== undefined && goal.targetMonths !== undefined) {
        const months = consecutiveMonthsUnderCap(state.snapshots, goal.targetCents);
        if (months >= goal.targetMonths) return { next: "achieved" };
      }
      return { next: "active" };
    }
  }
  void fx;
}

function monthlyCapProgress(goal: Goal, state: AppStateForGoals): GoalProgress {
  const target = goal.targetCents ?? 0;
  if (target === 0) return { goalId: goal.id, pct: 0, label: "No cap set.", color: "green" };
  const pct = Math.min(1.2, state.monthlyBurnCents / target);
  const color: GoalProgress["color"] = pct >= 1 ? "red" : pct >= 0.7 ? "amber" : "green";
  return {
    goalId: goal.id,
    pct,
    label: `${formatCents(state.monthlyBurnCents)} of ${formatCents(target)} this month`,
    color,
  };
}

function categoryCapProgress(goal: Goal, state: AppStateForGoals, fx?: FxContext): GoalProgress {
  if (!goal.categoryId || goal.targetCents === undefined) {
    return { goalId: goal.id, pct: 0, label: "Incomplete category cap.", color: "green" };
  }
  const monthly = state.subscriptions
    .filter((sub) => sub.category === goal.categoryId)
    .reduce((sum, sub) => sum + monthlyCostInBaseCents(sub, fx), 0);
  const pct = Math.min(1.2, monthly / goal.targetCents);
  const color: GoalProgress["color"] = pct >= 1 ? "red" : pct >= 0.7 ? "amber" : "green";
  return {
    goalId: goal.id,
    pct,
    label: `${formatCents(monthly)} of ${formatCents(goal.targetCents)} on ${goal.categoryId}`,
    color,
  };
}

function annualSavingsProgress(goal: Goal, state: AppStateForGoals, now: Date): GoalProgress {
  const target = goal.targetCents ?? 0;
  const baseline = goal.baselineCents ?? state.yearlyBurnCents;
  const saved = Math.max(0, baseline - state.yearlyBurnCents);
  const pct = target > 0 ? Math.min(1.5, saved / target) : 0;
  const timeRemainingDays = goal.targetDate ? daysUntil(goal.targetDate, now) : undefined;
  const color: GoalProgress["color"] = pct >= 1 ? "green" : pct >= 0.5 ? "amber" : "red";
  return {
    goalId: goal.id,
    pct,
    label: `${formatCents(saved)} of ${formatCents(target)} saved`,
    timeRemainingDays,
    color,
  };
}

function streakProgress(goal: Goal, days: number): GoalProgress {
  const target = goal.targetDays ?? 30;
  const pct = Math.min(1.5, days / target);
  const color: GoalProgress["color"] = pct >= 1 ? "green" : pct >= 0.5 ? "amber" : "red";
  return {
    goalId: goal.id,
    pct,
    label: `${days} day${days === 1 ? "" : "s"} of ${target}`,
    nextMilestoneDays: Math.max(0, target - days),
    color,
  };
}

function capStreakProgress(goal: Goal, snapshots: MonthlySnapshot[]): GoalProgress {
  const target = goal.targetMonths ?? 3;
  const cap = goal.targetCents ?? 0;
  const months = consecutiveMonthsUnderCap(snapshots, cap);
  const pct = Math.min(1.5, months / target);
  const color: GoalProgress["color"] = pct >= 1 ? "green" : pct >= 0.5 ? "amber" : "red";
  return {
    goalId: goal.id,
    pct,
    label: `${months} of ${target} months under ${formatCents(cap)}`,
    color,
  };
}

function daysUntil(iso: string, now: Date): number {
  const target = parseIso(iso);
  if (!target) return 0;
  return Math.max(0, Math.round((target.getTime() - startOfDay(now).getTime()) / dayMs));
}

function isoDay(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function parseIso(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!match) return null;
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(0)}`;
}

export function buildGoalId(): string {
  return `goal-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}
