// v5 Feature 3: charge-calendar heatmap.
//
// Derives the days a user was charged by walking each subscription's
// `nextBillingDate` BACKWARD by its billing cycle, all the way through
// the requested horizon. Ledger cancellation entries cap the walk for
// subs that were cancelled mid-window.

import type { BillingCycle, Subscription } from "./burnrate";
import { monthlyCostInBaseCents, yearlyCostCents } from "./burnrate";
import type { FxContext } from "./currency";
import { convertToBase } from "./currency";

export interface ChargeContributor {
  subscriptionId: string;
  subscriptionName: string;
  amountCents: number;
  cycle: BillingCycle;
}

export interface ChargeDay {
  date: string;            // ISO YYYY-MM-DD
  totalCents: number;      // base currency
  chargeCount: number;
  contributors: ChargeContributor[];
}

export interface ChargeCalendarSummary {
  totalCents: number;
  peakDay: ChargeDay | null;
  avgCentsPerActiveDay: number;
  activeDayCount: number;
  dominantDayOfMonth: number | null;  // 1..31 when >=40% of charges land there
  dominantDayOfWeek: number | null;   // 0..6 (Sun..Sat) under the same rule
}

interface BuildOptions {
  cancelledOn?: Record<string, string>; // subscriptionId -> ISO date; charges on/after this date are excluded
}

/**
 * Walk every subscription's billing cycle backward over the past
 * `horizonDays` and return one ChargeDay per day with at least one
 * charge. Pure, deterministic, no side effects.
 */
export function buildChargeCalendar(
  subs: Subscription[],
  horizonDays: number,
  fx?: FxContext,
  now: Date = new Date(),
  opts: BuildOptions = {},
): ChargeDay[] {
  const todayKey = isoDay(now);
  const cutoffMs = startOfDay(now).getTime() - horizonDays * dayMs;
  const days = new Map<string, ChargeDay>();

  for (const sub of subs) {
    const baseAmount = chargeAmountInBaseCents(sub, fx);
    if (baseAmount <= 0) continue;
    const cancelledOn = opts.cancelledOn?.[sub.id];
    let cursor = parseIso(sub.nextBillingDate);
    if (!cursor) continue;
    // nextBillingDate is the NEXT upcoming charge. If it's in the future,
    // step back once so we start emitting at the most-recent past charge.
    // If it's already in the past (e.g. user hasn't updated it), start at
    // that date directly.
    if (isoDay(cursor) > todayKey) {
      cursor = stepCycle(cursor, sub.billingCycle, -1);
    }
    let safety = 0;
    while (cursor.getTime() >= cutoffMs && safety < 600) {
      safety += 1;
      const key = isoDay(cursor);
      if (key > todayKey) {
        cursor = stepCycle(cursor, sub.billingCycle, -1);
        continue;
      }
      if (cancelledOn && key >= cancelledOn) {
        cursor = stepCycle(cursor, sub.billingCycle, -1);
        continue;
      }
      const existing = days.get(key);
      const contributor: ChargeContributor = {
        subscriptionId: sub.id,
        subscriptionName: sub.name,
        amountCents: baseAmount,
        cycle: sub.billingCycle,
      };
      if (existing) {
        existing.totalCents += baseAmount;
        existing.chargeCount += 1;
        existing.contributors.push(contributor);
      } else {
        days.set(key, { date: key, totalCents: baseAmount, chargeCount: 1, contributors: [contributor] });
      }
      cursor = stepCycle(cursor, sub.billingCycle, -1);
    }
  }

  return [...days.values()].sort((a, b) => a.date.localeCompare(b.date));
}

export function summarizeChargeCalendar(days: ChargeDay[]): ChargeCalendarSummary {
  if (days.length === 0) {
    return {
      totalCents: 0,
      peakDay: null,
      avgCentsPerActiveDay: 0,
      activeDayCount: 0,
      dominantDayOfMonth: null,
      dominantDayOfWeek: null,
    };
  }

  let totalCents = 0;
  let peakDay = days[0];
  const dayOfMonth = new Map<number, number>();
  const dayOfWeek = new Map<number, number>();
  for (const day of days) {
    totalCents += day.totalCents;
    if (
      day.totalCents > peakDay.totalCents ||
      (day.totalCents === peakDay.totalCents && day.date > peakDay.date)
    ) {
      peakDay = day;
    }
    const date = parseIso(day.date);
    if (date) {
      dayOfMonth.set(date.getDate(), (dayOfMonth.get(date.getDate()) ?? 0) + day.chargeCount);
      dayOfWeek.set(date.getDay(), (dayOfWeek.get(date.getDay()) ?? 0) + day.chargeCount);
    }
  }
  const activeDayCount = days.length;
  const avgCentsPerActiveDay = Math.round(totalCents / activeDayCount);

  const totalCharges = days.reduce((sum, day) => sum + day.chargeCount, 0);
  const dominantDayOfMonth = findDominant(dayOfMonth, totalCharges);
  const dominantDayOfWeek = findDominant(dayOfWeek, totalCharges);

  return {
    totalCents,
    peakDay,
    avgCentsPerActiveDay,
    activeDayCount,
    dominantDayOfMonth,
    dominantDayOfWeek,
  };
}

function findDominant(counts: Map<number, number>, total: number): number | null {
  if (total === 0) return null;
  let winner: number | null = null;
  let winnerCount = 0;
  for (const [key, count] of counts.entries()) {
    if (count > winnerCount) {
      winner = key;
      winnerCount = count;
    }
  }
  if (winner === null) return null;
  return winnerCount / total >= 0.4 ? winner : null;
}

function chargeAmountInBaseCents(sub: Subscription, fx?: FxContext): number {
  // Convert the per-cycle charge (which is sub.costCents in native currency).
  const currency = sub.currency ?? "USD";
  if (!fx || fx.baseCurrency === currency) return sub.costCents;
  return convertToBase(sub.costCents, currency, fx);
}

const dayMs = 24 * 60 * 60 * 1000;

function isoDay(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function parseIso(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!match) return null;
  const d = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function stepCycle(date: Date, cycle: BillingCycle, direction: 1 | -1): Date {
  switch (cycle) {
    case "weekly":
      return new Date(date.getFullYear(), date.getMonth(), date.getDate() + 7 * direction);
    case "monthly": {
      const next = new Date(date.getFullYear(), date.getMonth() + direction, 1);
      // Clamp to end-of-month if the source day exceeds the target's month length.
      const lastDay = new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate();
      next.setDate(Math.min(date.getDate(), lastDay));
      return next;
    }
    case "quarterly": {
      const next = new Date(date.getFullYear(), date.getMonth() + 3 * direction, 1);
      const lastDay = new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate();
      next.setDate(Math.min(date.getDate(), lastDay));
      return next;
    }
    case "yearly":
      return new Date(date.getFullYear() + direction, date.getMonth(), date.getDate());
  }
}

// Exposed for tests + the dashboard module
export function chargeAmountForCycle(sub: Subscription, fx?: FxContext): { perCharge: number; monthlyEquivalent: number; yearlyEquivalent: number } {
  return {
    perCharge: chargeAmountInBaseCents(sub, fx),
    monthlyEquivalent: monthlyCostInBaseCents(sub, fx),
    yearlyEquivalent: yearlyCostCents(sub),
  };
}
