import type { Subscription } from "./burnrate";
import { monthlyCostInBaseCents } from "./burnrate";
import type { BundleRule } from "@/data/bundle-rules";
import type { OverlapRule } from "@/data/overlap-rules";
import type { FxContext } from "./currency";

export interface BundleMatch {
  rule: BundleRule;
  matchedSubscriptions: Subscription[];
  currentMonthlyCents: number;
  bundleMonthlyCents: number;
  savingsMonthlyCents: number;
}

export interface OverlapMatch {
  rule: OverlapRule;
  matchedSubscriptions: Subscription[];
  monthlyCents: number;
  cheapestSubscription: Subscription;
  cheapestMonthlyCents: number;
}

function lowerSet(values: string[]): Set<string> {
  return new Set(values.map((value) => value.toLowerCase()));
}

export function detectBundles(
  subscriptions: Subscription[],
  rules: BundleRule[],
  fx?: FxContext,
): BundleMatch[] {
  const matches: BundleMatch[] = [];
  for (const rule of rules) {
    const target = lowerSet(rule.replaces);
    const matched = subscriptions.filter((sub) => target.has(sub.name.trim().toLowerCase()));
    if (matched.length < rule.minMatches) continue;
    const currentMonthlyCents = matched.reduce((sum, sub) => sum + monthlyCostInBaseCents(sub, fx), 0);
    const savings = currentMonthlyCents - rule.bundleMonthlyCents;
    if (savings <= 0) continue;
    matches.push({
      rule,
      matchedSubscriptions: matched,
      currentMonthlyCents,
      bundleMonthlyCents: rule.bundleMonthlyCents,
      savingsMonthlyCents: savings,
    });
  }
  return matches.sort((a, b) => b.savingsMonthlyCents - a.savingsMonthlyCents);
}

export function detectOverlaps(
  subscriptions: Subscription[],
  rules: OverlapRule[],
  fx?: FxContext,
): OverlapMatch[] {
  const matches: OverlapMatch[] = [];
  for (const rule of rules) {
    const target = lowerSet(rule.matchNames);
    const matched = subscriptions.filter((sub) => target.has(sub.name.trim().toLowerCase()));
    if (matched.length < rule.minMatches) continue;
    const withCost = matched.map((sub) => ({ sub, monthly: monthlyCostInBaseCents(sub, fx) }));
    const monthlyCents = withCost.reduce((sum, entry) => sum + entry.monthly, 0);
    const cheapest = withCost.reduce((min, entry) => (entry.monthly < min.monthly ? entry : min), withCost[0]);
    matches.push({
      rule,
      matchedSubscriptions: matched,
      monthlyCents,
      cheapestSubscription: cheapest.sub,
      cheapestMonthlyCents: cheapest.monthly,
    });
  }
  return matches.sort((a, b) => b.matchedSubscriptions.length - a.matchedSubscriptions.length);
}
