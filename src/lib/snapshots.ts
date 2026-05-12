import { calculateBurnMetrics, type Subscription, type Trial } from "./burnrate";
import { buildFxContext, convertToBase, type FxContext } from "./currency";
import { idbGetAll, idbPut, idbDelete, SNAPSHOTS_STORE } from "./idb";

export interface MonthlySnapshot {
  snapshotMonth: string;
  capturedAt: string;
  monthlyBurnCents: number;
  yearlyBurnCents: number;
  subscriptionCount: number;
  trialCount: number;
  categoryBreakdown: Record<string, number>;
  baseCurrency: string;
}

export const SNAPSHOT_RETENTION = 24;

export function currentMonthKey(now = new Date()): string {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

export function buildSnapshot(
  subscriptions: Subscription[],
  trials: Trial[],
  fx: FxContext,
  now = new Date(),
): MonthlySnapshot {
  const metrics = calculateBurnMetrics(subscriptions, now);
  const breakdown: Record<string, number> = {};
  for (const entry of metrics.categoryBreakdown) {
    breakdown[entry.category] = entry.monthlyCents;
  }
  // calculateBurnMetrics today operates on native cents; for the snapshot we
  // want base-currency cents. Re-sum sub-by-sub against fx.
  const monthlyBurnCents = subscriptions.reduce((sum, sub) => {
    const native = monthlyFromBilling(sub);
    return sum + convertToBase(native, sub.currency || "USD", fx);
  }, 0);
  const yearlyBurnCents = monthlyBurnCents * 12;
  // Re-key the breakdown in base currency as well.
  const baseBreakdown: Record<string, number> = {};
  for (const sub of subscriptions) {
    const monthlyBase = convertToBase(monthlyFromBilling(sub), sub.currency || "USD", fx);
    baseBreakdown[sub.category] = (baseBreakdown[sub.category] ?? 0) + monthlyBase;
  }
  return {
    snapshotMonth: currentMonthKey(now),
    capturedAt: now.toISOString(),
    monthlyBurnCents,
    yearlyBurnCents,
    subscriptionCount: subscriptions.length,
    trialCount: trials.length,
    categoryBreakdown: baseBreakdown,
    baseCurrency: fx.baseCurrency,
  };
}

function monthlyFromBilling(subscription: Subscription): number {
  switch (subscription.billingCycle) {
    case "weekly":
      return Math.round((subscription.costCents * 52) / 12);
    case "monthly":
      return subscription.costCents;
    case "quarterly":
      return Math.round((subscription.costCents * 4) / 12);
    case "yearly":
      return Math.round(subscription.costCents / 12);
  }
}

export function pruneSnapshots(snapshots: MonthlySnapshot[], limit = SNAPSHOT_RETENTION): MonthlySnapshot[] {
  const sorted = [...snapshots].sort((a, b) => a.snapshotMonth.localeCompare(b.snapshotMonth));
  if (sorted.length <= limit) return sorted;
  return sorted.slice(sorted.length - limit);
}

export interface CaptureResult {
  snapshots: MonthlySnapshot[];
  added: MonthlySnapshot | null;
}

export function captureSnapshotIfNeeded(
  existing: MonthlySnapshot[],
  build: () => MonthlySnapshot,
  now = new Date(),
): CaptureResult {
  const month = currentMonthKey(now);
  if (existing.some((snapshot) => snapshot.snapshotMonth === month)) {
    return { snapshots: existing, added: null };
  }
  const added = build();
  const pruned = pruneSnapshots([...existing, added]);
  return { snapshots: pruned, added };
}

export async function loadSnapshots(): Promise<MonthlySnapshot[]> {
  const rows = await idbGetAll<MonthlySnapshot>(SNAPSHOTS_STORE);
  return rows.sort((a, b) => a.snapshotMonth.localeCompare(b.snapshotMonth));
}

export async function persistSnapshot(snapshot: MonthlySnapshot): Promise<void> {
  await idbPut(SNAPSHOTS_STORE, snapshot);
}

export async function removeSnapshot(month: string): Promise<void> {
  await idbDelete(SNAPSHOTS_STORE, month);
}

// Pure: pick the snapshots that should still exist after a prune and emit
// the list to delete. Caller does the IDB writes.
export function diffPrune(stored: MonthlySnapshot[], retained: MonthlySnapshot[]): string[] {
  const keep = new Set(retained.map((snapshot) => snapshot.snapshotMonth));
  return stored.filter((snapshot) => !keep.has(snapshot.snapshotMonth)).map((snapshot) => snapshot.snapshotMonth);
}

export interface TrendInsight {
  id: string;
  title: string;
  detail: string;
  tone: "good" | "neutral" | "warning" | "danger";
}

export function buildTrendInsights(snapshots: MonthlySnapshot[], currentMonthlyCents: number): TrendInsight[] {
  if (snapshots.length < 2) return [];

  const sorted = pruneSnapshots(snapshots);
  const last = sorted[sorted.length - 1];
  const threeMonthsAgo = sorted[Math.max(0, sorted.length - 4)];
  const insights: TrendInsight[] = [];

  if (threeMonthsAgo && threeMonthsAgo.snapshotMonth !== last.snapshotMonth) {
    const delta = last.monthlyBurnCents - threeMonthsAgo.monthlyBurnCents;
    if (Math.abs(delta) > 0) {
      const pct = threeMonthsAgo.monthlyBurnCents > 0
        ? Math.round((delta / threeMonthsAgo.monthlyBurnCents) * 100)
        : 0;
      insights.push({
        id: "trend-3mo",
        title: delta > 0 ? `Burn grew ${Math.abs(pct)}% over 3 months` : `Burn shrank ${Math.abs(pct)}% over 3 months`,
        detail: `Compared to ${threeMonthsAgo.snapshotMonth}, monthly burn changed by ${Math.abs(delta / 100).toFixed(2)}.`,
        tone: delta > 0 ? "warning" : "good",
      });
    }
  }

  const max = sorted.reduce((winner, snapshot) => (snapshot.monthlyBurnCents > winner.monthlyBurnCents ? snapshot : winner), sorted[0]);
  if (max.snapshotMonth !== last.snapshotMonth) {
    insights.push({
      id: "trend-peak",
      title: `Most expensive month: ${max.snapshotMonth}`,
      detail: `Monthly burn peaked at ${(max.monthlyBurnCents / 100).toFixed(2)} that month.`,
      tone: "neutral",
    });
  }

  insights.push({
    id: "trend-forecast",
    title: `Projected next 12 months: ${(currentMonthlyCents * 12 / 100).toFixed(2)}`,
    detail: "If your current burn rate holds steady.",
    tone: "neutral",
  });

  return insights;
}

export function buildForecastPoints(
  history: MonthlySnapshot[],
  currentMonthlyCents: number,
  months = 12,
  now = new Date(),
): Array<{ month: string; monthlyCents: number; projection: boolean }> {
  const points: Array<{ month: string; monthlyCents: number; projection: boolean }> = [];
  for (const snapshot of history) {
    points.push({ month: snapshot.snapshotMonth, monthlyCents: snapshot.monthlyBurnCents, projection: false });
  }
  // Anchor projection at the current month if not already a snapshot.
  const currentMonth = currentMonthKey(now);
  if (!points.some((p) => p.month === currentMonth)) {
    points.push({ month: currentMonth, monthlyCents: currentMonthlyCents, projection: false });
  }
  for (let i = 1; i <= months; i += 1) {
    const target = new Date(now.getFullYear(), now.getMonth() + i, 1);
    const key = currentMonthKey(target);
    points.push({ month: key, monthlyCents: currentMonthlyCents, projection: true });
  }
  return points;
}

export function emptyFxContext(): FxContext {
  return buildFxContext("USD");
}
