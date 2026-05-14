// v5 Feature 1: usage tracker + ROI scoring.
//
// Users log monthly "used / didn't use" entries against each subscription.
// The score module turns that history into cost-per-use, lifetime spend,
// and a coaching badge (hero / steady / mixed / zombie / ghost / untracked).

import { monthlyCostInBaseCents, type Subscription, type UsageEntry } from "./burnrate";
import type { FxContext } from "./currency";
import type { BurnRatePreferences } from "./preferences";

export type RoiBadge = "hero" | "steady" | "mixed" | "zombie" | "ghost" | "untracked";

export interface RoiScore {
  subscriptionId: string;
  monthsTracked: number;
  monthsUsed: number;
  monthsZeroUse: number;          // contiguous trailing run of zero-use months
  lifetimeSpendCents: number;     // base currency
  costPerUseCents: number | null; // null when monthsUsed === 0
  badge: RoiBadge;
}

export function monthKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

export function previousMonthKey(date: Date): string {
  const d = new Date(date.getFullYear(), date.getMonth() - 1, 1);
  return monthKey(d);
}

/**
 * Compute the ROI score for one subscription.
 *
 * Badge rules (deterministic):
 *   - hero    : monthsUsed >= 3 AND costPerUseCents <= 100
 *   - steady  : monthsUsed / monthsTracked >= 0.66 (not hero)
 *   - mixed   : 0.33 <= ratio < 0.66
 *   - zombie  : monthsUsed >= 1 AND monthsZeroUse >= 3
 *   - ghost   : monthsUsed === 0 AND monthsTracked >= 2
 *   - untracked: monthsTracked < 2
 */
export function scoreUsage(sub: Subscription, fx?: FxContext, now: Date = new Date()): RoiScore {
  const log = sub.usageLog ?? {};
  const monthsTracked = Object.keys(log).length;
  const monthsUsed = Object.values(log).filter((entry) => entry.used).length;

  // Walk back from this month counting consecutive zero-use months.
  let monthsZeroUse = 0;
  let cursor = new Date(now.getFullYear(), now.getMonth(), 1);
  while (true) {
    const key = monthKey(cursor);
    const entry = log[key];
    if (!entry) {
      // No entry for the current cursor; if cursor is the current month, advance back once and try again.
      if (cursor.getTime() === new Date(now.getFullYear(), now.getMonth(), 1).getTime()) {
        cursor = new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1);
        continue;
      }
      break;
    }
    if (entry.used) break;
    monthsZeroUse += 1;
    cursor = new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1);
  }

  const monthly = monthlyCostInBaseCents(sub, fx);
  const lifetimeSpendCents = monthly * monthsTracked;
  const costPerUseCents = monthsUsed > 0 ? Math.round(lifetimeSpendCents / monthsUsed) : null;

  const badge = badgeFor({ monthsTracked, monthsUsed, monthsZeroUse, costPerUseCents });

  return {
    subscriptionId: sub.id,
    monthsTracked,
    monthsUsed,
    monthsZeroUse,
    lifetimeSpendCents,
    costPerUseCents,
    badge,
  };
}

function badgeFor(args: {
  monthsTracked: number;
  monthsUsed: number;
  monthsZeroUse: number;
  costPerUseCents: number | null;
}): RoiBadge {
  if (args.monthsTracked < 2) return "untracked";
  if (args.monthsUsed >= 3 && args.costPerUseCents !== null && args.costPerUseCents <= 100) return "hero";
  if (args.monthsUsed >= 1 && args.monthsZeroUse >= 3) return "zombie";
  if (args.monthsUsed === 0) return "ghost";
  const ratio = args.monthsUsed / args.monthsTracked;
  if (ratio >= 0.66) return "steady";
  if (ratio >= 0.33) return "mixed";
  // Low ratio but at least one use and the zombie threshold isn't met yet — fall back to mixed for UI consistency.
  return "mixed";
}

/**
 * Pure helper to add or update a single month's entry. Never mutates.
 */
export function recordUsage(sub: Subscription, month: string, entry: UsageEntry): Subscription {
  const log = { ...(sub.usageLog ?? {}) };
  log[month] = entry;
  return { ...sub, usageLog: log };
}

/**
 * Decide whether to surface the usage check-in banner this boot.
 * The banner fires on the first boot of a new calendar month — tracked via
 * `preferences.usageNudge.lastNudgeMonth`.
 */
export function shouldNudgeForMonth(prefs: BurnRatePreferences, now: Date = new Date()): boolean {
  const lastMonth = (prefs as { usageNudge?: { lastNudgeMonth?: string } }).usageNudge?.lastNudgeMonth;
  if (!lastMonth) return true;
  return lastMonth !== monthKey(now);
}

/**
 * Mark the current month as nudged so the banner does not re-appear this month.
 * Returns the updated preferences slice.
 */
export function markNudgeShown(prefs: BurnRatePreferences, now: Date = new Date()): BurnRatePreferences {
  const usageNudge = ((prefs as { usageNudge?: { lastNudgeMonth?: string; suppressed?: string[] } }).usageNudge ??
    {}) as { lastNudgeMonth?: string; suppressed?: string[] };
  return {
    ...prefs,
    // Stored as an extra field — the preferences normalizer will pass it through verbatim.
    ...({
      usageNudge: { ...usageNudge, lastNudgeMonth: monthKey(now) },
    } as unknown as Record<string, never>),
  };
}
