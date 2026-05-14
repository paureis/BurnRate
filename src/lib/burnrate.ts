export const billingCycles = ["weekly", "monthly", "quarterly", "yearly"] as const;

export const defaultCategories = [
  "entertainment",
  "productivity",
  "fitness",
  "music",
  "cloud/storage",
  "news/media",
  "gaming",
  "food delivery",
  "other",
] as const;

export const defaultCategoryColors: Record<string, string> = {
  entertainment: "#ff5a3d",
  productivity: "#37f29b",
  fitness: "#ffd166",
  music: "#b388ff",
  "cloud/storage": "#7cc7ff",
  "news/media": "#f970a8",
  gaming: "#6ee7f9",
  "food delivery": "#ff9f1c",
  other: "#9aa4b2",
};

export type BillingCycle = (typeof billingCycles)[number];
export type Theme = "dark" | "light";

// v5: monthly usage entry. Lives on Subscription.usageLog, keyed by "YYYY-MM".
export interface UsageEntry {
  used: boolean;
  sessionCount?: number;
  note?: string;
  recordedAt: string; // ISO timestamp
}

// v5: planned price change queued on a subscription. Applied on boot when due.
export interface PlannedPriceChange {
  id: string;
  effectiveDate: string;  // ISO YYYY-MM-DD
  newCostCents: number;    // in the sub's native currency
  note?: string;
  addedAt: string;         // ISO timestamp
}

// v5: retention / discount metadata. The sub.costCents is what the user actually
// pays today; activeDiscount.originalCostCents is the strike-through reference.
export type DiscountSource = "retention" | "promo" | "student" | "annual-prepay" | "household" | "other";

export interface ActiveDiscount {
  id: string;
  originalCostCents: number;
  negotiatedOn: string;     // ISO YYYY-MM-DD
  expiresOn?: string;        // ISO YYYY-MM-DD
  note?: string;
  source: DiscountSource;
}

export interface Subscription {
  id: string;
  name: string;
  costCents: number;
  billingCycle: BillingCycle;
  category: string;
  nextBillingDate: string;
  notes: string;
  color?: string;
  icon?: string;
  createdAt: string;
  // ISO 4217 code. Optional for v2-compatibility; undefined is treated as USD.
  currency?: string;
  // ISO date (YYYY-MM-DD). When set, the sub renders as "Cancelling on X" and
  // applyDueCancellations() will move it to the ledger once the date passes.
  cancellingOn?: string | null;
  // v4: lowercase-kebab tag chips, deduped. Capped at 10 per record by tag helpers.
  tags?: string[];
  // v5 additions:
  usageLog?: Record<string, UsageEntry>;
  priceChanges?: PlannedPriceChange[];
  activeDiscount?: ActiveDiscount;
}

export interface Trial {
  id: string;
  name: string;
  trialStartDate: string;
  trialEndDate: string;
  costAfterTrialCents: number;
  remindMe: boolean;
  createdAt: string;
  currency?: string;
  // v4: tags shared with Subscription (same normalization rules).
  tags?: string[];
}

import type { BudgetGoal } from "./budget";
import type { CancellationRecord } from "./ledger";
import type { BurnRatePreferences } from "./preferences";
import type { MonthlySnapshot } from "./snapshots";

export interface BurnRateData {
  subscriptions: Subscription[];
  trials: Trial[];
  theme: Theme;
  budget?: BudgetGoal;
  preferences?: BurnRatePreferences;
  ledger?: CancellationRecord[];
  snapshots?: MonthlySnapshot[];
}

export interface CategoryBreakdown {
  category: string;
  monthlyCents: number;
  yearlyCents: number;
  percentage: number;
}

export type InsightKind =
  | "category-share"
  | "yearly-lock-in"
  | "renewals-this-week"
  | "new-last-30"
  | "cancel-largest"
  | "onboarding";

export interface Insight {
  id: string;
  kind: InsightKind;
  title: string;
  detail: string;
  tone: "good" | "neutral" | "warning" | "danger";
}

export interface Renewal {
  subscription: Subscription;
  daysUntil: number;
}

export interface UpcomingRenewals {
  next7: Renewal[];
  next30: Renewal[];
}

export interface BurnMetrics {
  monthlyBurnCents: number;
  yearlyBurnCents: number;
  categoryBreakdown: CategoryBreakdown[];
  upcomingRenewals: UpcomingRenewals;
  insights: Insight[];
}

export interface SimulatorImpact {
  currentMonthlyCents: number;
  currentYearlyCents: number;
  projectedMonthlyCents: number;
  projectedYearlyCents: number;
  monthlySavingsCents: number;
  yearlySavingsCents: number;
}

export interface TrialStatus {
  daysRemaining: number;
  status: "active" | "soon" | "urgent" | "ended";
  hasEnded: boolean;
}

export const TRIAL_ALERT_THRESHOLDS = [1, 3, 7] as const;
export type TrialAlertThreshold = (typeof TRIAL_ALERT_THRESHOLDS)[number];

export interface TrialAlert {
  key: string;
  trial: Trial;
  threshold: TrialAlertThreshold;
  daysRemaining: number;
}

type CsvRow = Record<string, string>;

const dayMs = 24 * 60 * 60 * 1000;

export function toCents(value: string | number): number {
  if (typeof value === "number") {
    return Math.round(value * 100);
  }

  const normalized = value.replace(/[$,\s]/g, "");
  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) ? Math.round(parsed * 100) : 0;
}

export function formatCents(cents: number, compact = false): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: compact && cents % 100 === 0 ? 0 : 2,
    maximumFractionDigits: compact && cents % 100 === 0 ? 0 : 2,
  }).format(cents / 100);
}

export function yearlyCostCents(subscription: Pick<Subscription, "billingCycle" | "costCents">): number {
  switch (subscription.billingCycle) {
    case "weekly":
      return subscription.costCents * 52;
    case "monthly":
      return subscription.costCents * 12;
    case "quarterly":
      return subscription.costCents * 4;
    case "yearly":
      return subscription.costCents;
  }
}

export function monthlyCostCents(subscription: Pick<Subscription, "billingCycle" | "costCents">): number {
  return Math.round(yearlyCostCents(subscription) / 12);
}

// Currency-aware variants. Convert the native cost to the base currency
// before computing. When no FxContext is provided (or sub currency already
// equals base), this is identical to the native variants.
import type { FxContext } from "./currency";
import { convertToBase } from "./currency";

export function monthlyCostInBaseCents(
  subscription: Pick<Subscription, "billingCycle" | "costCents" | "currency">,
  fx?: FxContext,
): number {
  const native = monthlyCostCents(subscription);
  const currency = subscription.currency ?? "USD";
  if (!fx || fx.baseCurrency === currency) return native;
  return convertToBase(native, currency, fx);
}

export function yearlyCostInBaseCents(
  subscription: Pick<Subscription, "billingCycle" | "costCents" | "currency">,
  fx?: FxContext,
): number {
  const native = yearlyCostCents(subscription);
  const currency = subscription.currency ?? "USD";
  if (!fx || fx.baseCurrency === currency) return native;
  return convertToBase(native, currency, fx);
}

export function calculateBurnMetrics(subscriptions: Subscription[], today = new Date()): BurnMetrics {
  const yearlyBurnCents = subscriptions.reduce((sum, subscription) => sum + yearlyCostCents(subscription), 0);
  const monthlyBurnCents = subscriptions.reduce((sum, subscription) => sum + monthlyCostCents(subscription), 0);
  const categoryBreakdown = buildCategoryBreakdown(subscriptions, yearlyBurnCents);
  const upcomingRenewals = getUpcomingRenewals(subscriptions, today);

  return {
    monthlyBurnCents,
    yearlyBurnCents,
    categoryBreakdown,
    upcomingRenewals,
    insights: buildInsights(subscriptions, categoryBreakdown, upcomingRenewals, today, yearlyBurnCents),
  };
}

export function getUpcomingRenewals(subscriptions: Subscription[], today = new Date()): UpcomingRenewals {
  const renewals = subscriptions
    .map((subscription) => ({
      subscription,
      daysUntil: daysBetween(today, subscription.nextBillingDate),
    }))
    .filter((renewal) => renewal.daysUntil >= 0 && renewal.daysUntil <= 30)
    .sort((a, b) => a.daysUntil - b.daysUntil || a.subscription.name.localeCompare(b.subscription.name));

  return {
    next7: renewals.filter((renewal) => renewal.daysUntil <= 7),
    next30: renewals,
  };
}

export function calculateSimulatorImpact(
  subscriptions: Subscription[],
  disabledIds: ReadonlySet<string>,
): SimulatorImpact {
  const currentYearlyCents = subscriptions.reduce((sum, subscription) => sum + yearlyCostCents(subscription), 0);
  const currentMonthlyCents = subscriptions.reduce((sum, subscription) => sum + monthlyCostCents(subscription), 0);
  const activeSubscriptions = subscriptions.filter((subscription) => !disabledIds.has(subscription.id));
  const projectedYearlyCents = activeSubscriptions.reduce((sum, subscription) => sum + yearlyCostCents(subscription), 0);
  const projectedMonthlyCents = activeSubscriptions.reduce((sum, subscription) => sum + monthlyCostCents(subscription), 0);

  return {
    currentMonthlyCents,
    currentYearlyCents,
    projectedMonthlyCents,
    projectedYearlyCents,
    monthlySavingsCents: Math.max(0, currentMonthlyCents - projectedMonthlyCents),
    yearlySavingsCents: Math.max(0, currentYearlyCents - projectedYearlyCents),
  };
}

export function trialAlertKey(trialId: string, threshold: TrialAlertThreshold): string {
  return `${trialId}:${threshold}`;
}

export function getPendingTrialAlerts(
  trials: Trial[],
  dismissed: Record<string, boolean>,
  today = new Date(),
): TrialAlert[] {
  const alerts: TrialAlert[] = [];

  for (const trial of trials) {
    if (!trial.remindMe) {
      continue;
    }

    const daysRemaining = daysBetween(today, trial.trialEndDate);
    if (daysRemaining < 0) {
      continue;
    }

    const applicable = TRIAL_ALERT_THRESHOLDS.find((threshold) => daysRemaining <= threshold);
    if (applicable === undefined) {
      continue;
    }
    const key = trialAlertKey(trial.id, applicable);
    if (dismissed[key]) {
      continue;
    }
    alerts.push({ key, trial, threshold: applicable, daysRemaining });
  }

  return alerts.sort((a, b) => a.daysRemaining - b.daysRemaining || a.trial.name.localeCompare(b.trial.name));
}

export function getTrialStatus(trial: Trial, today = new Date()): TrialStatus {
  const daysRemaining = daysBetween(today, trial.trialEndDate);
  const hasEnded = daysRemaining < 0;

  if (hasEnded) {
    return { daysRemaining, status: "ended", hasEnded };
  }

  if (daysRemaining <= 3) {
    return { daysRemaining, status: "urgent", hasEnded };
  }

  if (daysRemaining <= 7) {
    return { daysRemaining, status: "soon", hasEnded };
  }

  return { daysRemaining, status: "active", hasEnded };
}

export function serializeBurnRateCsv(data: BurnRateData): string {
  const headers = [
    "recordType",
    "id",
    "name",
    "costCents",
    "billingCycle",
    "category",
    "nextBillingDate",
    "notes",
    "color",
    "icon",
    "createdAt",
    "trialStartDate",
    "trialEndDate",
    "costAfterTrialCents",
    "remindMe",
    "theme",
    "monthlyCapCents",
    "annualSavingsTargetCents",
    "targetDate",
    "baselineYearlyCents",
  ];

  const rows: CsvRow[] = [
    {
      recordType: "meta",
      theme: data.theme,
    },
    ...data.subscriptions.map((subscription) => ({
      recordType: "subscription",
      id: subscription.id,
      name: subscription.name,
      costCents: String(subscription.costCents),
      billingCycle: subscription.billingCycle,
      category: subscription.category,
      nextBillingDate: subscription.nextBillingDate,
      notes: subscription.notes,
      color: subscription.color ?? "",
      icon: subscription.icon ?? "",
      createdAt: subscription.createdAt,
    })),
    ...data.trials.map((trial) => ({
      recordType: "trial",
      id: trial.id,
      name: trial.name,
      createdAt: trial.createdAt,
      trialStartDate: trial.trialStartDate,
      trialEndDate: trial.trialEndDate,
      costAfterTrialCents: String(trial.costAfterTrialCents),
      remindMe: String(trial.remindMe),
    })),
  ];

  if (data.budget && (data.budget.monthlyCapCents !== null || data.budget.annualSavingsTargetCents !== null)) {
    rows.push({
      recordType: "budget",
      monthlyCapCents: data.budget.monthlyCapCents != null ? String(data.budget.monthlyCapCents) : "",
      annualSavingsTargetCents:
        data.budget.annualSavingsTargetCents != null ? String(data.budget.annualSavingsTargetCents) : "",
      targetDate: data.budget.targetDate ?? "",
      baselineYearlyCents: data.budget.baselineYearlyCents != null ? String(data.budget.baselineYearlyCents) : "",
      createdAt: data.budget.createdAt ?? "",
    });
  }

  return [headers.join(","), ...rows.map((row) => headers.map((header) => escapeCsv(row[header] ?? "")).join(","))].join(
    "\n",
  );
}

export function parseBurnRateCsv(csv: string): BurnRateData {
  const parsedRows = parseCsv(csv.trim());
  if (parsedRows.length < 2) {
    return { subscriptions: [], trials: [], theme: "dark" };
  }

  const [headers, ...records] = parsedRows;
  const rows = records.map((record) =>
    headers.reduce<CsvRow>((row, header, index) => {
      row[header] = record[index] ?? "";
      return row;
    }, {}),
  );

  const theme = rows.find((row) => row.recordType === "meta")?.theme === "light" ? "light" : "dark";
  const subscriptions = rows
    .filter((row) => row.recordType === "subscription" || (!row.recordType && row.name))
    .map(rowToSubscription);
  const trials = rows.filter((row) => row.recordType === "trial").map(rowToTrial);
  const budgetRow = rows.find((row) => row.recordType === "budget");
  const budget = budgetRow
    ? {
        monthlyCapCents: budgetRow.monthlyCapCents ? parseIntegerOrNull(budgetRow.monthlyCapCents) : null,
        annualSavingsTargetCents: budgetRow.annualSavingsTargetCents
          ? parseIntegerOrNull(budgetRow.annualSavingsTargetCents)
          : null,
        targetDate: budgetRow.targetDate || null,
        baselineYearlyCents: budgetRow.baselineYearlyCents
          ? parseIntegerOrNull(budgetRow.baselineYearlyCents)
          : null,
        createdAt: budgetRow.createdAt || null,
      }
    : undefined;

  return { subscriptions, trials, theme, ...(budget ? { budget } : {}) };
}

function parseIntegerOrNull(value: string): number | null {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

export function createId(prefix: string): string {
  const random = Math.random().toString(36).slice(2, 9);
  return `${prefix}-${Date.now().toString(36)}-${random}`;
}

export function todayDateInputValue(date = new Date()): string {
  const normalized = startOfDay(date);
  const year = normalized.getFullYear();
  const month = String(normalized.getMonth() + 1).padStart(2, "0");
  const day = String(normalized.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function addDaysDateInputValue(days: number, date = new Date()): string {
  const normalized = startOfDay(date);
  normalized.setDate(normalized.getDate() + days);
  return todayDateInputValue(normalized);
}

function buildCategoryBreakdown(subscriptions: Subscription[], totalYearlyCents: number): CategoryBreakdown[] {
  const byCategory = new Map<string, { monthlyCents: number; yearlyCents: number }>();

  for (const subscription of subscriptions) {
    const current = byCategory.get(subscription.category) ?? { monthlyCents: 0, yearlyCents: 0 };
    current.monthlyCents += monthlyCostCents(subscription);
    current.yearlyCents += yearlyCostCents(subscription);
    byCategory.set(subscription.category, current);
  }

  return [...byCategory.entries()]
    .map(([category, values]) => ({
      category,
      monthlyCents: values.monthlyCents,
      yearlyCents: values.yearlyCents,
      percentage: totalYearlyCents > 0 ? roundToTwo((values.yearlyCents / totalYearlyCents) * 100) : 0,
    }))
    .sort((a, b) => b.monthlyCents - a.monthlyCents || a.category.localeCompare(b.category));
}

function buildInsights(
  subscriptions: Subscription[],
  categoryBreakdown: CategoryBreakdown[],
  upcomingRenewals: UpcomingRenewals,
  today: Date,
  yearlyBurnCents: number,
): Insight[] {
  if (subscriptions.length === 0) {
    return [
      {
        id: "empty-add",
        kind: "onboarding",
        title: "Start with the subscriptions you remember",
        detail: "Add the obvious monthly charges first; BurnRate will normalize the cycles for you.",
        tone: "neutral",
      },
      {
        id: "empty-trials",
        kind: "onboarding",
        title: "Track trials before they auto-charge",
        detail: "Trials show countdowns and urgency states as their end date gets close.",
        tone: "warning",
      },
      {
        id: "empty-simulator",
        kind: "onboarding",
        title: "Use the simulator before canceling",
        detail: "Toggle subscriptions off to see monthly and yearly savings immediately.",
        tone: "good",
      },
    ];
  }

  const insights: Insight[] = [];
  const largestCategory = categoryBreakdown[0];

  if (largestCategory) {
    insights.push({
      id: "largest-category",
      kind: "category-share",
      title: `${titleCase(largestCategory.category)} dominates your burn`,
      detail: `You spend ${largestCategory.percentage}% of your subscription budget on ${largestCategory.category}.`,
      tone: largestCategory.percentage >= 50 ? "warning" : "neutral",
    });
  }

  const yearlySubscriptions = subscriptions.filter((subscription) => subscription.billingCycle === "yearly");
  if (yearlySubscriptions.length > 0) {
    const lockedCents = yearlySubscriptions.reduce((sum, subscription) => sum + yearlyCostCents(subscription), 0);
    insights.push({
      id: "yearly-lock-in",
      kind: "yearly-lock-in",
      title: `${yearlySubscriptions.length} yearly ${pluralize("subscription", yearlySubscriptions.length)}`,
      detail: `Those plans lock in ${formatCents(lockedCents)} per year.`,
      tone: "neutral",
    });
  }

  if (upcomingRenewals.next7.length > 0) {
    const renewalTotal = upcomingRenewals.next7.reduce(
      (sum, renewal) => sum + renewal.subscription.costCents,
      0,
    );
    insights.push({
      id: "renewals-week",
      kind: "renewals-this-week",
      title: `${upcomingRenewals.next7.length} renew ${upcomingRenewals.next7.length === 1 ? "charge" : "charges"} this week`,
      detail: `${formatCents(renewalTotal)} is scheduled in the next 7 days.`,
      tone: renewalTotal > yearlyBurnCents / 24 ? "warning" : "neutral",
    });
  }

  const newSubscriptions = subscriptions.filter((subscription) => daysBetween(subscription.createdAt, today) <= 30);
  insights.push({
    id: "new-last-30",
    kind: "new-last-30",
    title: `${newSubscriptions.length} new in the last 30 days`,
    detail:
      newSubscriptions.length > 0
        ? "Recent additions can hide inside normal card activity. Review whether they still earn their keep."
        : "No new subscriptions were added in the last 30 days.",
    tone: newSubscriptions.length >= 3 ? "warning" : "good",
  });

  const mostExpensive = subscriptions.reduce<Subscription | null>((largest, subscription) => {
    if (!largest) {
      return subscription;
    }
    return yearlyCostCents(subscription) > yearlyCostCents(largest) ? subscription : largest;
  }, null);

  if (mostExpensive) {
    insights.push({
      id: "cancel-largest",
      kind: "cancel-largest",
      title: `Canceling ${mostExpensive.name} saves the most`,
      detail: `Dropping it would save ${formatCents(yearlyCostCents(mostExpensive))} per year.`,
      tone: "danger",
    });
  }

  return insights.slice(0, 5);
}

function rowToSubscription(row: CsvRow): Subscription {
  return {
    id: row.id || createId("sub"),
    name: row.name || "Imported subscription",
    costCents: toInteger(row.costCents),
    billingCycle: isBillingCycle(row.billingCycle) ? row.billingCycle : "monthly",
    category: row.category || "other",
    nextBillingDate: row.nextBillingDate || todayDateInputValue(),
    notes: row.notes || "",
    color: row.color || undefined,
    icon: row.icon || undefined,
    createdAt: row.createdAt || new Date().toISOString(),
  };
}

function rowToTrial(row: CsvRow): Trial {
  return {
    id: row.id || createId("trial"),
    name: row.name || "Imported trial",
    trialStartDate: row.trialStartDate || todayDateInputValue(),
    trialEndDate: row.trialEndDate || addDaysDateInputValue(7),
    costAfterTrialCents: toInteger(row.costAfterTrialCents),
    remindMe: row.remindMe === "true",
    createdAt: row.createdAt || new Date().toISOString(),
  };
}

function isBillingCycle(value: string): value is BillingCycle {
  return billingCycles.some((cycle) => cycle === value);
}

function toInteger(value: string): number {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : 0;
}

function parseCsv(csv: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let index = 0; index < csv.length; index += 1) {
    const char = csv[index];
    const nextChar = csv[index + 1];

    if (char === '"' && inQuotes && nextChar === '"') {
      field += '"';
      index += 1;
      continue;
    }

    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }

    if (char === "," && !inQuotes) {
      row.push(field);
      field = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && nextChar === "\n") {
        index += 1;
      }
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
      continue;
    }

    field += char;
  }

  row.push(field);
  rows.push(row);
  return rows.filter((parsedRow) => parsedRow.some((value) => value.length > 0));
}

function escapeCsv(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function daysBetween(from: Date | string, to: Date | string): number {
  const fromDay = startOfDay(typeof from === "string" ? parseFlexibleDate(from) : from);
  const toDay = startOfDay(typeof to === "string" ? parseFlexibleDate(to) : to);
  return Math.round((toDay.getTime() - fromDay.getTime()) / dayMs);
}

function parseFlexibleDate(value: string): Date {
  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (dateOnly) {
    return new Date(Number(dateOnly[1]), Number(dateOnly[2]) - 1, Number(dateOnly[3]));
  }
  return new Date(value);
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function roundToTwo(value: number): number {
  return Math.round(value * 100) / 100;
}

function titleCase(value: string): string {
  return value
    .split(/[\s/]+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function pluralize(value: string, count: number): string {
  return count === 1 ? value : `${value}s`;
}
