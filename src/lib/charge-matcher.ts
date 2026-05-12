import type { Subscription } from "./burnrate";
import type { PopularService } from "@/data/popular-services";
import type { ParsedCharge } from "./charges";

export type ChargeMatchType = "existing" | "popular" | "new";

export interface ChargeMatch {
  charge: ParsedCharge;
  matchType: ChargeMatchType;
  matchedSubscriptionId?: string;
  matchedPopularName?: string;
  confidence: number; // 0..1
}

const MATCH_THRESHOLD = 0.6;

function tokens(value: string): string[] {
  return value
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length > 0);
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let prev = Array.from({ length: b.length + 1 }, (_, idx) => idx);
  for (let i = 0; i < a.length; i += 1) {
    const curr = [i + 1];
    for (let j = 0; j < b.length; j += 1) {
      const cost = a[i] === b[j] ? 0 : 1;
      curr.push(Math.min(prev[j + 1] + 1, curr[j] + 1, prev[j] + cost));
    }
    prev = curr;
  }
  return prev[b.length];
}

function tokenScore(query: string, candidate: string): number {
  const qTokens = tokens(query);
  const cTokens = tokens(candidate);
  if (qTokens.length === 0 || cTokens.length === 0) return 0;
  const matched = qTokens.filter((token) => cTokens.includes(token));
  return matched.length / Math.max(qTokens.length, cTokens.length);
}

function similarityScore(query: string, candidate: string): number {
  const q = query.trim().toLowerCase();
  const c = candidate.trim().toLowerCase();
  if (!q || !c) return 0;
  if (q === c) return 1;
  if (c.includes(q) || q.includes(c)) {
    return 0.85;
  }
  const tokens = tokenScore(q, c);
  if (tokens > 0) {
    return Math.max(0.5, tokens);
  }
  const distance = levenshtein(q, c);
  const longest = Math.max(q.length, c.length);
  return Math.max(0, 1 - distance / longest);
}

interface MatchCandidate {
  score: number;
  type: ChargeMatchType;
  matchedSubscriptionId?: string;
  matchedPopularName?: string;
}

function bestMatch(
  charge: ParsedCharge,
  subscriptions: Subscription[],
  popular: PopularService[],
): MatchCandidate {
  let best: MatchCandidate = { score: 0, type: "new" };
  for (const sub of subscriptions) {
    const score = similarityScore(charge.vendorGuess, sub.name);
    if (score > best.score) {
      best = { score, type: "existing", matchedSubscriptionId: sub.id };
    }
  }
  for (const candidate of popular) {
    const score = similarityScore(charge.vendorGuess, candidate.name);
    if (score > best.score) {
      best = { score, type: "popular", matchedPopularName: candidate.name };
    }
  }
  if (best.score < MATCH_THRESHOLD) {
    return { score: best.score, type: "new" };
  }
  return best;
}

export function matchCharges(
  charges: ParsedCharge[],
  subscriptions: Subscription[],
  popular: PopularService[],
): ChargeMatch[] {
  return charges.map((charge) => {
    const candidate = bestMatch(charge, subscriptions, popular);
    return {
      charge,
      matchType: candidate.type,
      matchedSubscriptionId: candidate.matchedSubscriptionId,
      matchedPopularName: candidate.matchedPopularName,
      confidence: candidate.score,
    };
  });
}
