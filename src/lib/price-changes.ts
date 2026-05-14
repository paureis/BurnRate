// v5 Feature 2: planned price-change scheduler. Users queue future price
// hikes per sub; this module applies them on boot and projects forward for
// the Trends forecast.

import type { PlannedPriceChange, Subscription } from "./burnrate";
import { monthlyCostInBaseCents } from "./burnrate";
import type { FxContext } from "./currency";

export interface AppliedPriceChange {
  subscriptionId: string;
  oldCents: number;
  newCents: number;
  effectiveDate: string;
}

export interface ApplyPriceChangeResult {
  next: Subscription[];
  applied: AppliedPriceChange[];
}

/**
 * Pure boot-time sweep. For each subscription with planned changes whose
 * `effectiveDate <= today`, apply them in date order, update `costCents`,
 * and remove them from the planned list. Idempotent on the same `now`.
 */
export function applyDuePriceChanges(subs: Subscription[], now: Date = new Date()): ApplyPriceChangeResult {
  const today = isoDay(now);
  const applied: AppliedPriceChange[] = [];
  let touched = false;
  const next = subs.map((sub) => {
    if (!sub.priceChanges || sub.priceChanges.length === 0) return sub;
    const due = sub.priceChanges.filter((change) => change.effectiveDate <= today);
    if (due.length === 0) return sub;
    touched = true;
    due.sort((a, b) => a.effectiveDate.localeCompare(b.effectiveDate));
    let costCents = sub.costCents;
    for (const change of due) {
      applied.push({
        subscriptionId: sub.id,
        oldCents: costCents,
        newCents: change.newCostCents,
        effectiveDate: change.effectiveDate,
      });
      costCents = change.newCostCents;
    }
    const remaining = sub.priceChanges.filter((change) => change.effectiveDate > today);
    return { ...sub, costCents, priceChanges: remaining.length > 0 ? remaining : undefined };
  });
  return { next: touched ? next : subs, applied };
}

/**
 * Project the monthly burn (base-currency cents) for a single subscription
 * at `monthOffset` months from `now`. Honors planned changes whose
 * effectiveDate falls on or before the target month.
 */
export function projectMonthlyBurnWithChanges(
  sub: Subscription,
  monthOffset: number,
  fx?: FxContext,
  now: Date = new Date(),
): number {
  const target = new Date(now.getFullYear(), now.getMonth() + monthOffset, 1);
  const targetIso = isoDay(new Date(target.getFullYear(), target.getMonth() + 1, 0));
  let projectedCost = sub.costCents;
  if (sub.priceChanges && sub.priceChanges.length > 0) {
    const sorted = [...sub.priceChanges].sort((a, b) => a.effectiveDate.localeCompare(b.effectiveDate));
    for (const change of sorted) {
      if (change.effectiveDate <= targetIso) {
        projectedCost = change.newCostCents;
      }
    }
  }
  return monthlyCostInBaseCents(
    { billingCycle: sub.billingCycle, costCents: projectedCost, currency: sub.currency },
    fx,
  );
}

/**
 * Expand all scheduled price changes across `horizonMonths` months. Each
 * entry surfaces the projected base-currency burn for that month plus the
 * list of subscription ids whose change fires that month.
 */
export function expandPriceChangeTimeline(
  subs: Subscription[],
  horizonMonths: number,
  fx?: FxContext,
  now: Date = new Date(),
): Array<{ month: string; baseCents: number; eventsAtThisMonth: string[] }> {
  const out: Array<{ month: string; baseCents: number; eventsAtThisMonth: string[] }> = [];
  for (let i = 0; i < horizonMonths; i += 1) {
    const target = new Date(now.getFullYear(), now.getMonth() + i, 1);
    const monthKey = `${target.getFullYear()}-${String(target.getMonth() + 1).padStart(2, "0")}`;
    const monthEnd = isoDay(new Date(target.getFullYear(), target.getMonth() + 1, 0));
    const monthStart = isoDay(new Date(target.getFullYear(), target.getMonth(), 1));
    let baseCents = 0;
    const events: string[] = [];
    for (const sub of subs) {
      if (sub.cancellingOn && sub.cancellingOn <= monthStart) continue;
      baseCents += projectMonthlyBurnWithChanges(sub, i, fx, now);
      if (sub.priceChanges) {
        for (const change of sub.priceChanges) {
          if (change.effectiveDate >= monthStart && change.effectiveDate <= monthEnd) {
            events.push(sub.id);
            break;
          }
        }
      }
    }
    out.push({ month: monthKey, baseCents, eventsAtThisMonth: events });
  }
  return out;
}

/**
 * Validate a single PlannedPriceChange shape (used by the editor form).
 */
export function validatePriceChange(
  draft: { effectiveDate: string; newCostCents: number; note?: string },
  now: Date = new Date(),
): { ok: true } | { ok: false; reason: string } {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(draft.effectiveDate)) return { ok: false, reason: "Effective date is required." };
  if (draft.effectiveDate <= isoDay(now)) return { ok: false, reason: "Effective date must be in the future." };
  if (!Number.isFinite(draft.newCostCents) || draft.newCostCents <= 0)
    return { ok: false, reason: "New cost must be a positive number." };
  return { ok: true };
}

export function buildPriceChange(input: {
  effectiveDate: string;
  newCostCents: number;
  note?: string;
}): PlannedPriceChange {
  return {
    id: `pc-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
    effectiveDate: input.effectiveDate,
    newCostCents: input.newCostCents,
    ...(input.note ? { note: input.note } : {}),
    addedAt: new Date().toISOString(),
  };
}

function isoDay(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
