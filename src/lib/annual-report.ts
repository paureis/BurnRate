// v5 Feature 5: end-of-year report builder.
//
// Pure aggregator that walks subs + snapshots + ledger to produce a
// Spotify-Wrapped-shaped payload. The /report/[year] route assembles
// the scroll story from this output.

import { monthlyCostInBaseCents, type Subscription } from "./burnrate";
import type { CancellationRecord } from "./ledger";
import type { MonthlySnapshot } from "./snapshots";
import type { FxContext } from "./currency";
import { scoreUsage, type RoiScore } from "./usage";
import { streakDaysWithoutNewSub } from "./goals";

export interface AnnualReport {
  year: number;
  baseCurrency: string;
  totalSpendCents: number;
  topSubscriptions: Array<{ name: string; cents: number; category: string }>;
  biggestMonth: { month: string; cents: number };
  quietestMonth: { month: string; cents: number };
  cancellationsCount: number;
  cancellationsSavedAnnualCents: number;
  biggestWin: { name: string; annualSavedCents: number } | null;
  roiHeroes: string[];
  roiZombies: string[];
  categoryBreakdown: Array<{ category: string; cents: number; pct: number }>;
  newSubsAdded: number;
  avgMonthlyBurnCents: number;
  streaks: { longestNoNewSubsDays: number };
  lifetime: { firstSnapshotMonth: string | null; totalCentsAcrossAllSnapshots: number };
  partial: boolean;       // true when fewer than 12 in-year snapshots existed
  snapshotsCount: number;
}

export interface AnnualReportInput {
  year: number;
  baseCurrency: string;
  subscriptions: Subscription[];
  snapshots: MonthlySnapshot[];
  ledger: CancellationRecord[];
  fx?: FxContext;
  now?: Date;
}

/**
 * A report is "ready" when at least 6 in-year snapshots exist.
 */
export function isReportReady(year: number, snapshots: MonthlySnapshot[]): boolean {
  const inYear = snapshots.filter((snap) => snap.snapshotMonth.startsWith(`${year}-`));
  return inYear.length >= 6;
}

export function buildAnnualReport(input: AnnualReportInput): AnnualReport {
  const { year, baseCurrency, subscriptions, snapshots, ledger, fx, now = new Date() } = input;

  const inYear = snapshots
    .filter((snap) => snap.snapshotMonth.startsWith(`${year}-`))
    .sort((a, b) => a.snapshotMonth.localeCompare(b.snapshotMonth));

  const totalSpendCents = inYear.reduce((sum, snap) => sum + snap.monthlyBurnCents, 0);
  const avgMonthlyBurnCents =
    inYear.length === 0 ? 0 : Math.round(totalSpendCents / inYear.length);

  const biggestMonth = inYear.reduce<{ month: string; cents: number }>(
    (winner, snap) => (snap.monthlyBurnCents > winner.cents ? { month: snap.snapshotMonth, cents: snap.monthlyBurnCents } : winner),
    { month: "", cents: 0 },
  );

  const quietestMonth = inYear.reduce<{ month: string; cents: number } | null>((winner, snap) => {
    if (!winner) return { month: snap.snapshotMonth, cents: snap.monthlyBurnCents };
    return snap.monthlyBurnCents < winner.cents ? { month: snap.snapshotMonth, cents: snap.monthlyBurnCents } : winner;
  }, null) ?? { month: "", cents: 0 };

  const topSubscriptions = [...subscriptions]
    .map((sub) => ({
      name: sub.name,
      cents: monthlyCostInBaseCents(sub, fx) * 12,
      category: sub.category,
    }))
    .sort((a, b) => b.cents - a.cents)
    .slice(0, 5);

  const inYearLedger = ledger.filter((row) => row.cancelledOn.startsWith(`${year}-`));
  const cancellationsCount = inYearLedger.length;
  const cancellationsSavedAnnualCents = inYearLedger.reduce(
    (sum, row) => sum + row.monthlyCostCents * 12,
    0,
  );
  const biggestWin = inYearLedger.reduce<{ name: string; annualSavedCents: number } | null>((winner, row) => {
    const annual = row.monthlyCostCents * 12;
    if (!winner || annual > winner.annualSavedCents) {
      return { name: row.subscriptionName, annualSavedCents: annual };
    }
    return winner;
  }, null);

  const scores: RoiScore[] = subscriptions.map((sub) => scoreUsage(sub, fx, now));
  const roiHeroes = scores
    .filter((score) => score.badge === "hero")
    .sort((a, b) => (a.costPerUseCents ?? Infinity) - (b.costPerUseCents ?? Infinity))
    .slice(0, 3)
    .map((score) => subscriptions.find((sub) => sub.id === score.subscriptionId)?.name ?? "");
  const roiZombies = scores
    .filter((score) => score.badge === "zombie" || score.badge === "ghost")
    .sort((a, b) => b.lifetimeSpendCents - a.lifetimeSpendCents)
    .slice(0, 3)
    .map((score) => subscriptions.find((sub) => sub.id === score.subscriptionId)?.name ?? "");

  // Build category breakdown from the latest in-year snapshot if available;
  // otherwise compute from the active subs.
  const breakdownSource = inYear[inYear.length - 1]?.categoryBreakdown ?? null;
  const categoryTotals = new Map<string, number>();
  if (breakdownSource) {
    for (const [category, cents] of Object.entries(breakdownSource)) {
      categoryTotals.set(category, cents * 12);
    }
  } else {
    for (const sub of subscriptions) {
      const monthly = monthlyCostInBaseCents(sub, fx);
      categoryTotals.set(sub.category, (categoryTotals.get(sub.category) ?? 0) + monthly * 12);
    }
  }
  const categoryTotalSum = [...categoryTotals.values()].reduce((sum, value) => sum + value, 0);
  const categoryBreakdown = [...categoryTotals.entries()]
    .map(([category, cents]) => ({
      category,
      cents,
      pct: categoryTotalSum > 0 ? Math.round((cents / categoryTotalSum) * 100) : 0,
    }))
    .sort((a, b) => b.cents - a.cents);

  const newSubsAdded = subscriptions.filter((sub) => sub.createdAt.startsWith(`${year}-`)).length;

  const longestNoNewSubsDays = streakDaysWithoutNewSub(
    subscriptions.filter((sub) => sub.createdAt.startsWith(`${year}-`)),
    now,
  );

  const lifetimeSnapshots = snapshots;
  const firstSnapshotMonth =
    lifetimeSnapshots.length > 0
      ? [...lifetimeSnapshots].sort((a, b) => a.snapshotMonth.localeCompare(b.snapshotMonth))[0].snapshotMonth
      : null;
  const totalCentsAcrossAllSnapshots = lifetimeSnapshots.reduce(
    (sum, snap) => sum + snap.monthlyBurnCents,
    0,
  );

  return {
    year,
    baseCurrency,
    totalSpendCents,
    topSubscriptions,
    biggestMonth,
    quietestMonth,
    cancellationsCount,
    cancellationsSavedAnnualCents,
    biggestWin,
    roiHeroes,
    roiZombies,
    categoryBreakdown,
    newSubsAdded,
    avgMonthlyBurnCents,
    streaks: { longestNoNewSubsDays },
    lifetime: { firstSnapshotMonth, totalCentsAcrossAllSnapshots },
    partial: inYear.length < 12,
    snapshotsCount: inYear.length,
  };
}
