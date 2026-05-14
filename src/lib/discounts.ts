// v5 Feature 4: retention / discount log helpers.
//
// `Subscription.costCents` is what the user actually pays today.
// `Subscription.activeDiscount.originalCostCents` is the strike-through reference.

import type { ActiveDiscount, BillingCycle, Subscription } from "./burnrate";
import { yearlyCostCents, monthlyCostCents } from "./burnrate";
import type { FxContext } from "./currency";
import { convertToBase } from "./currency";
import { popularServices, type PopularService } from "@/data/popular-services";

export interface DiscountSummary {
  subscriptionId: string;
  monthlySavingsCents: number;             // base currency
  annualSavingsCents: number;
  daysUntilExpiry: number | null;
  publicPriceComparisonCents: number | null;
  publicPriceDeltaCents: number | null;
}

export interface PublicPriceLookupResult {
  cents: number;
  source: "popularServices" | "none";
}

const DEFAULT_WINDOW_DAYS = 14;
const dayMs = 24 * 60 * 60 * 1000;

/**
 * Look up the documented public price for a service by name. v2's
 * popularServices catalog is the source of truth.
 */
export function publicPriceLookup(serviceName: string): PublicPriceLookupResult {
  const target = serviceName.trim().toLowerCase();
  if (!target) return { cents: 0, source: "none" };
  for (const entry of popularServices as readonly PopularService[]) {
    if (entry.name.toLowerCase() === target) {
      return { cents: entry.defaultCents, source: "popularServices" };
    }
  }
  return { cents: 0, source: "none" };
}

/**
 * Build a DiscountSummary for one subscription. Returns null when the sub
 * has no active discount.
 */
export function summarizeDiscount(
  sub: Subscription,
  fx?: FxContext,
  now: Date = new Date(),
): DiscountSummary | null {
  const discount = sub.activeDiscount;
  if (!discount) return null;
  const monthlyOriginal = perCycleToMonthlyCents(discount.originalCostCents, sub.billingCycle);
  const monthlyPaid = monthlyCostCents(sub);
  const nativeMonthlySavings = Math.max(0, monthlyOriginal - monthlyPaid);
  const currency = sub.currency ?? "USD";
  const monthlySavingsCents = convertNative(nativeMonthlySavings, currency, fx);
  const annualSavingsCents = monthlySavingsCents * 12;
  const daysUntilExpiry = computeDaysUntilExpiry(discount, now);
  const lookup = publicPriceLookup(sub.name);
  const publicPriceComparisonCents = lookup.source === "popularServices" ? lookup.cents : null;
  const publicPriceDeltaCents =
    publicPriceComparisonCents !== null ? publicPriceComparisonCents - monthlyPaid : null;
  return {
    subscriptionId: sub.id,
    monthlySavingsCents,
    annualSavingsCents,
    daysUntilExpiry,
    publicPriceComparisonCents,
    publicPriceDeltaCents,
  };
}

/**
 * Returns true when the discount expires within `windowDays` (default 14).
 */
export function isExpiringSoon(sub: Subscription, now: Date = new Date(), windowDays: number = DEFAULT_WINDOW_DAYS): boolean {
  const expiresOn = sub.activeDiscount?.expiresOn;
  if (!expiresOn) return false;
  const expiry = parseIso(expiresOn);
  if (!expiry) return false;
  const today = startOfDay(now);
  const diff = Math.round((expiry.getTime() - today.getTime()) / dayMs);
  return diff >= 0 && diff <= windowDays;
}

/**
 * Sum of monthly + yearly active-discount savings across all subs in base currency.
 * Expired discounts are excluded.
 */
export function totalActiveDiscountsCents(
  subs: Subscription[],
  fx?: FxContext,
  now: Date = new Date(),
): { monthly: number; yearly: number } {
  let monthly = 0;
  let yearly = 0;
  for (const sub of subs) {
    const discount = sub.activeDiscount;
    if (!discount) continue;
    if (discount.expiresOn) {
      const expiry = parseIso(discount.expiresOn);
      if (expiry && expiry.getTime() < startOfDay(now).getTime()) continue; // expired
    }
    const summary = summarizeDiscount(sub, fx, now);
    if (!summary) continue;
    monthly += summary.monthlySavingsCents;
    yearly += summary.annualSavingsCents;
  }
  return { monthly, yearly };
}

/**
 * Build a fresh ActiveDiscount payload from a draft. The caller assigns it
 * to `sub.activeDiscount` and lowers `sub.costCents` to the discounted price.
 */
export function buildActiveDiscount(input: {
  originalCostCents: number;
  negotiatedOn: string;
  expiresOn?: string;
  note?: string;
  source: ActiveDiscount["source"];
}): ActiveDiscount {
  return {
    id: `disc-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
    originalCostCents: input.originalCostCents,
    negotiatedOn: input.negotiatedOn,
    ...(input.expiresOn ? { expiresOn: input.expiresOn } : {}),
    ...(input.note ? { note: input.note } : {}),
    source: input.source,
  };
}

function computeDaysUntilExpiry(discount: ActiveDiscount, now: Date): number | null {
  if (!discount.expiresOn) return null;
  const expiry = parseIso(discount.expiresOn);
  if (!expiry) return null;
  const today = startOfDay(now);
  return Math.round((expiry.getTime() - today.getTime()) / dayMs);
}

function perCycleToMonthlyCents(cents: number, cycle: BillingCycle): number {
  return Math.round(yearlyCostCents({ billingCycle: cycle, costCents: cents }) / 12);
}

function convertNative(amount: number, currency: string, fx?: FxContext): number {
  if (!fx || fx.baseCurrency === currency) return amount;
  return convertToBase(amount, currency, fx);
}

function parseIso(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!match) return null;
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}
