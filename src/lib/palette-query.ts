// v4 Feature 4: structured search operators for the command palette.
//
// Supported operators (case-insensitive, all repeatable):
//   cost:>20 / cost:<5 / cost:>=10 / cost:<=50    (numbers are in user's base currency)
//   cycle:weekly|monthly|quarterly|yearly
//   tag:<slug>
//   category:<id>
//   currency:<iso>
//   cancelling:                                   (boolean — match subs with cancellingOn set)
//   trial:                                        (boolean — match trials only)
//
// The parser is intentionally permissive: unknown operators (or malformed
// values) are left in `freeText` so the user's substring search still works.

import type { BillingCycle } from "./burnrate";

export interface ParsedPaletteQuery {
  freeText: string;
  filters: {
    costMinCents?: number;
    costMaxCents?: number;
    cycles?: BillingCycle[];
    tags?: string[];
    categories?: string[];
    currencies?: string[];
    cancellingOnly?: boolean;
    trialsOnly?: boolean;
  };
}

const KNOWN_OPERATORS = new Set([
  "cost",
  "cycle",
  "tag",
  "category",
  "currency",
  "cancelling",
  "trial",
]);

const CYCLES: BillingCycle[] = ["weekly", "monthly", "quarterly", "yearly"];

export function parsePaletteQuery(input: string): ParsedPaletteQuery {
  const filters: ParsedPaletteQuery["filters"] = {};
  const remainingTokens: string[] = [];
  const tokens = (input ?? "").split(/\s+/).filter(Boolean);

  for (const token of tokens) {
    const colonIndex = token.indexOf(":");
    if (colonIndex <= 0) {
      remainingTokens.push(token);
      continue;
    }
    const operator = token.slice(0, colonIndex).toLowerCase();
    const value = token.slice(colonIndex + 1);
    if (!KNOWN_OPERATORS.has(operator)) {
      remainingTokens.push(token);
      continue;
    }
    if (!consumeOperator(operator, value, filters)) {
      // Malformed value — keep the original token in free text.
      remainingTokens.push(token);
    }
  }

  return { freeText: remainingTokens.join(" ").trim(), filters };
}

export function hasActiveFilters(parsed: ParsedPaletteQuery): boolean {
  const f = parsed.filters;
  return (
    f.costMinCents !== undefined ||
    f.costMaxCents !== undefined ||
    (f.cycles !== undefined && f.cycles.length > 0) ||
    (f.tags !== undefined && f.tags.length > 0) ||
    (f.categories !== undefined && f.categories.length > 0) ||
    (f.currencies !== undefined && f.currencies.length > 0) ||
    f.cancellingOnly === true ||
    f.trialsOnly === true
  );
}

export function describeParsedQuery(parsed: ParsedPaletteQuery): string {
  const parts: string[] = [];
  const f = parsed.filters;
  if (f.cycles?.length) parts.push(`${f.cycles.join(", ")} cycle`);
  if (f.categories?.length) parts.push(`in ${f.categories.join(", ")}`);
  if (f.tags?.length) parts.push(`tagged ${f.tags.map((t) => `#${t}`).join(" ")}`);
  if (f.currencies?.length) parts.push(`in ${f.currencies.join(", ")}`);
  if (f.costMinCents !== undefined) parts.push(`≥ $${(f.costMinCents / 100).toFixed(0)}/mo`);
  if (f.costMaxCents !== undefined) parts.push(`≤ $${(f.costMaxCents / 100).toFixed(0)}/mo`);
  if (f.cancellingOnly) parts.push("cancelling soon");
  if (f.trialsOnly) parts.push("trials only");
  return parts.length > 0 ? `Filtering: ${parts.join(", ")}` : "";
}

function consumeOperator(
  operator: string,
  value: string,
  filters: ParsedPaletteQuery["filters"],
): boolean {
  switch (operator) {
    case "cost":
      return consumeCost(value, filters);
    case "cycle":
      return consumeCycle(value, filters);
    case "tag":
      return consumeTag(value, filters);
    case "category":
      return consumeCategory(value, filters);
    case "currency":
      return consumeCurrency(value, filters);
    case "cancelling":
      filters.cancellingOnly = true;
      return true;
    case "trial":
      filters.trialsOnly = true;
      return true;
    default:
      return false;
  }
}

function consumeCost(value: string, filters: ParsedPaletteQuery["filters"]): boolean {
  const match = /^(>=|<=|>|<|=)?(\d+(?:\.\d+)?)$/.exec(value);
  if (!match) return false;
  const op = match[1] ?? "=";
  const dollars = Number(match[2]);
  if (!Number.isFinite(dollars) || dollars < 0) return false;
  const cents = Math.round(dollars * 100);
  if (op === ">" || op === ">=") {
    filters.costMinCents = filters.costMinCents !== undefined ? Math.max(filters.costMinCents, cents) : cents;
  } else if (op === "<" || op === "<=") {
    filters.costMaxCents = filters.costMaxCents !== undefined ? Math.min(filters.costMaxCents, cents) : cents;
  } else {
    // Equality: clamp both sides to the same value.
    filters.costMinCents = cents;
    filters.costMaxCents = cents;
  }
  return true;
}

function consumeCycle(value: string, filters: ParsedPaletteQuery["filters"]): boolean {
  const lower = value.toLowerCase();
  if (!CYCLES.includes(lower as BillingCycle)) return false;
  filters.cycles = filters.cycles ?? [];
  if (!filters.cycles.includes(lower as BillingCycle)) filters.cycles.push(lower as BillingCycle);
  return true;
}

function consumeTag(value: string, filters: ParsedPaletteQuery["filters"]): boolean {
  const normalized = value.toLowerCase().trim();
  if (!normalized || !/^[a-z0-9-]+$/.test(normalized)) return false;
  filters.tags = filters.tags ?? [];
  if (!filters.tags.includes(normalized)) filters.tags.push(normalized);
  return true;
}

function consumeCategory(value: string, filters: ParsedPaletteQuery["filters"]): boolean {
  const normalized = value.trim().toLowerCase();
  if (!normalized) return false;
  filters.categories = filters.categories ?? [];
  if (!filters.categories.includes(normalized)) filters.categories.push(normalized);
  return true;
}

function consumeCurrency(value: string, filters: ParsedPaletteQuery["filters"]): boolean {
  if (!/^[a-zA-Z]{3}$/.test(value)) return false;
  const upper = value.toUpperCase();
  filters.currencies = filters.currencies ?? [];
  if (!filters.currencies.includes(upper)) filters.currencies.push(upper);
  return true;
}

export const PALETTE_OPERATOR_HELP: ReadonlyArray<{ syntax: string; description: string }> = [
  { syntax: "cost:>20", description: "Monthly cost over $20 (your base currency)." },
  { syntax: "cost:<=5", description: "Monthly cost at or under $5." },
  { syntax: "cycle:yearly", description: "Yearly subscriptions only." },
  { syntax: "tag:work", description: "Subscriptions tagged with #work." },
  { syntax: "category:entertainment", description: "One specific category." },
  { syntax: "currency:eur", description: "Subscriptions priced in EUR." },
  { syntax: "cancelling:", description: "Only subs with a scheduled cancel-on date." },
  { syntax: "trial:", description: "Restrict to trials." },
];
