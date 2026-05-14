// v4 Feature 2: saved-view filter, sort, and scope spec applied to subscriptions or trials.

import type { BillingCycle, Subscription, Trial } from "./burnrate";
import { monthlyCostInBaseCents } from "./burnrate";
import type { FxContext } from "./currency";

export type SavedViewScope = "subscriptions" | "trials";
export type SavedViewSortBy = "name" | "cost" | "nextBillingDate" | "category";
export type SavedViewSortDir = "asc" | "desc";

export interface SavedViewFilter {
  query?: string;
  tags?: string[];
  categories?: string[];
  cycles?: BillingCycle[];
  currencies?: string[];
  minMonthlyCents?: number;
  maxMonthlyCents?: number;
  cancellingOnly?: boolean;
}

export interface SavedView {
  id: string;
  name: string;
  scope: SavedViewScope;
  filter: SavedViewFilter;
  sort: { by: SavedViewSortBy; dir: SavedViewSortDir };
  createdAt: string;
  updatedAt: string;
  builtIn?: boolean;
}

export const BUILTIN_VIEW_IDS = ["all-subs", "yearly-only", "cancelling-soon"] as const;
export type BuiltinViewId = (typeof BUILTIN_VIEW_IDS)[number];

export function buildBuiltinViews(now: Date = new Date()): SavedView[] {
  const ts = now.toISOString();
  return [
    {
      id: "all-subs",
      name: "All subscriptions",
      scope: "subscriptions",
      filter: {},
      sort: { by: "nextBillingDate", dir: "asc" },
      createdAt: ts,
      updatedAt: ts,
      builtIn: true,
    },
    {
      id: "yearly-only",
      name: "Yearly only",
      scope: "subscriptions",
      filter: { cycles: ["yearly"] },
      sort: { by: "cost", dir: "desc" },
      createdAt: ts,
      updatedAt: ts,
      builtIn: true,
    },
    {
      id: "cancelling-soon",
      name: "Cancelling soon",
      scope: "subscriptions",
      filter: { cancellingOnly: true },
      sort: { by: "nextBillingDate", dir: "asc" },
      createdAt: ts,
      updatedAt: ts,
      builtIn: true,
    },
  ];
}

export function isBuiltinView(view: Pick<SavedView, "id" | "builtIn">): boolean {
  return view.builtIn === true || (BUILTIN_VIEW_IDS as readonly string[]).includes(view.id);
}

/**
 * Apply a saved view's filter + sort to a list of subscriptions, using the
 * provided FX context so cost comparisons happen in base currency.
 */
export function applyView(subs: Subscription[], view: SavedView, fx?: FxContext): Subscription[] {
  const filtered = subs.filter((sub) => matchesFilter(sub, view.filter, fx));
  return sortSubs(filtered, view.sort, fx);
}

function matchesFilter(sub: Subscription, filter: SavedViewFilter, fx?: FxContext): boolean {
  if (filter.query && filter.query.trim()) {
    const q = filter.query.trim().toLowerCase();
    const haystack = `${sub.name} ${sub.notes ?? ""} ${sub.category}`.toLowerCase();
    if (!haystack.includes(q)) return false;
  }
  if (filter.tags && filter.tags.length > 0) {
    const subTags = new Set((sub.tags ?? []).map((t) => t.toLowerCase()));
    for (const required of filter.tags) {
      if (!subTags.has(required.toLowerCase())) return false;
    }
  }
  if (filter.categories && filter.categories.length > 0) {
    if (!filter.categories.includes(sub.category)) return false;
  }
  if (filter.cycles && filter.cycles.length > 0) {
    if (!filter.cycles.includes(sub.billingCycle)) return false;
  }
  if (filter.currencies && filter.currencies.length > 0) {
    const cur = (sub.currency ?? "USD").toUpperCase();
    if (!filter.currencies.some((code) => code.toUpperCase() === cur)) return false;
  }
  const minOrMax = filter.minMonthlyCents !== undefined || filter.maxMonthlyCents !== undefined;
  if (minOrMax) {
    const monthly = monthlyCostInBaseCents(sub, fx);
    if (filter.minMonthlyCents !== undefined && monthly < filter.minMonthlyCents) return false;
    if (filter.maxMonthlyCents !== undefined && monthly > filter.maxMonthlyCents) return false;
  }
  if (filter.cancellingOnly && !sub.cancellingOn) return false;
  return true;
}

function sortSubs(subs: Subscription[], sort: SavedView["sort"], fx?: FxContext): Subscription[] {
  const dir = sort.dir === "desc" ? -1 : 1;
  const next = [...subs];
  next.sort((a, b) => {
    switch (sort.by) {
      case "name":
        return dir * a.name.localeCompare(b.name);
      case "category":
        return dir * (a.category.localeCompare(b.category) || a.name.localeCompare(b.name));
      case "cost":
        return dir * (monthlyCostInBaseCents(a, fx) - monthlyCostInBaseCents(b, fx));
      case "nextBillingDate":
        return dir * a.nextBillingDate.localeCompare(b.nextBillingDate);
    }
  });
  return next;
}

/**
 * Normalize a stored value (e.g. from localStorage) into a clean SavedView[].
 * Bad rows are dropped silently. Built-in views are seeded if missing.
 */
export function normalizeViews(stored: unknown, now: Date = new Date()): SavedView[] {
  const out: SavedView[] = [];
  const seenIds = new Set<string>();
  if (Array.isArray(stored)) {
    for (const raw of stored) {
      const view = sanitizeView(raw);
      if (!view) continue;
      if (seenIds.has(view.id)) continue;
      seenIds.add(view.id);
      out.push(view);
    }
  }
  // Seed built-ins that weren't present in storage.
  for (const builtin of buildBuiltinViews(now)) {
    if (!seenIds.has(builtin.id)) {
      out.push(builtin);
      seenIds.add(builtin.id);
    }
  }
  return out;
}

function sanitizeView(raw: unknown): SavedView | null {
  if (!raw || typeof raw !== "object") return null;
  const record = raw as Record<string, unknown>;
  if (typeof record.id !== "string" || typeof record.name !== "string") return null;
  const scope = record.scope === "trials" ? "trials" : "subscriptions";
  const filter = sanitizeFilter(record.filter);
  const sort = sanitizeSort(record.sort);
  const createdAt = typeof record.createdAt === "string" ? record.createdAt : new Date().toISOString();
  const updatedAt = typeof record.updatedAt === "string" ? record.updatedAt : createdAt;
  const builtIn =
    record.builtIn === true || (BUILTIN_VIEW_IDS as readonly string[]).includes(record.id) ? true : undefined;
  return {
    id: record.id,
    name: record.name.trim() || "Untitled view",
    scope,
    filter,
    sort,
    createdAt,
    updatedAt,
    ...(builtIn ? { builtIn } : {}),
  };
}

function sanitizeFilter(raw: unknown): SavedViewFilter {
  if (!raw || typeof raw !== "object") return {};
  const r = raw as Record<string, unknown>;
  const filter: SavedViewFilter = {};
  if (typeof r.query === "string" && r.query.trim()) filter.query = r.query.trim();
  if (Array.isArray(r.tags)) filter.tags = r.tags.filter((t): t is string => typeof t === "string" && t.length > 0);
  if (Array.isArray(r.categories))
    filter.categories = r.categories.filter((c): c is string => typeof c === "string" && c.length > 0);
  if (Array.isArray(r.cycles))
    filter.cycles = r.cycles.filter(
      (c): c is BillingCycle => c === "weekly" || c === "monthly" || c === "quarterly" || c === "yearly",
    );
  if (Array.isArray(r.currencies))
    filter.currencies = r.currencies.filter((c): c is string => typeof c === "string" && c.length > 0);
  if (typeof r.minMonthlyCents === "number" && Number.isFinite(r.minMonthlyCents))
    filter.minMonthlyCents = r.minMonthlyCents;
  if (typeof r.maxMonthlyCents === "number" && Number.isFinite(r.maxMonthlyCents))
    filter.maxMonthlyCents = r.maxMonthlyCents;
  if (r.cancellingOnly === true) filter.cancellingOnly = true;
  return filter;
}

function sanitizeSort(raw: unknown): SavedView["sort"] {
  if (raw && typeof raw === "object") {
    const r = raw as Record<string, unknown>;
    const by: SavedViewSortBy =
      r.by === "name" || r.by === "cost" || r.by === "nextBillingDate" || r.by === "category" ? r.by : "nextBillingDate";
    const dir: SavedViewSortDir = r.dir === "desc" ? "desc" : "asc";
    return { by, dir };
  }
  return { by: "nextBillingDate", dir: "asc" };
}

// Trial filtering uses a tiny subset of the spec (query + tags only — trials don't have categories/cycles in the same way).
export function applyViewToTrials(trials: Trial[], view: SavedView): Trial[] {
  if (view.scope !== "trials") return trials;
  return trials.filter((trial) => matchesTrialFilter(trial, view.filter));
}

function matchesTrialFilter(trial: Trial, filter: SavedViewFilter): boolean {
  if (filter.query && filter.query.trim()) {
    const q = filter.query.trim().toLowerCase();
    if (!trial.name.toLowerCase().includes(q)) return false;
  }
  if (filter.tags && filter.tags.length > 0) {
    const trialTags = new Set((trial.tags ?? []).map((t) => t.toLowerCase()));
    for (const required of filter.tags) {
      if (!trialTags.has(required.toLowerCase())) return false;
    }
  }
  return true;
}
