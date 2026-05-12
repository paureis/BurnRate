import { createId, type Subscription, todayDateInputValue } from "./burnrate";
import { DEFAULT_BASE_CURRENCY } from "./currency";

export interface CancellationRecord {
  id: string;
  subscriptionName: string;
  category: string;
  monthlyCostCents: number;
  currency: string;
  cancelledOn: string;
  recordedAt: string;
  auto: boolean;
  note?: string;
}

const UNDO_WINDOW_DAYS = 7;

export function isUndoEligible(record: CancellationRecord, now = new Date()): boolean {
  if (!record.auto) return false;
  const recordedAt = new Date(record.recordedAt);
  if (Number.isNaN(recordedAt.getTime())) return false;
  const days = (now.getTime() - recordedAt.getTime()) / (24 * 60 * 60 * 1000);
  return days <= UNDO_WINDOW_DAYS;
}

export function totalSavedMonthlyCents(records: CancellationRecord[]): number {
  return records.reduce((sum, record) => sum + record.monthlyCostCents, 0);
}

export function totalSavedYearlyCents(records: CancellationRecord[]): number {
  return totalSavedMonthlyCents(records) * 12;
}

export function earliestCancelledOn(records: CancellationRecord[]): string | null {
  if (records.length === 0) return null;
  return records.reduce((earliest, record) => (record.cancelledOn < earliest ? record.cancelledOn : earliest), records[0].cancelledOn);
}

export interface ApplyDueResult {
  remaining: Subscription[];
  added: CancellationRecord[];
}

// Move any subscription whose `cancellingOn` is on or before `today` to the ledger.
// Pure function — caller persists the result.
export function applyDueCancellations(
  subscriptions: Subscription[],
  now = new Date(),
): ApplyDueResult {
  const today = todayDateInputValue(now);
  const remaining: Subscription[] = [];
  const added: CancellationRecord[] = [];
  for (const sub of subscriptions) {
    if (sub.cancellingOn && sub.cancellingOn <= today) {
      added.push({
        id: createId("ledger"),
        subscriptionName: sub.name,
        category: sub.category,
        monthlyCostCents: monthlyFromBilling(sub),
        currency: sub.currency || DEFAULT_BASE_CURRENCY,
        cancelledOn: sub.cancellingOn,
        recordedAt: now.toISOString(),
        auto: true,
      });
    } else {
      remaining.push(sub);
    }
  }
  return { remaining, added };
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

export function buildManualLedgerRecord(input: {
  subscriptionName: string;
  category: string;
  monthlyCostCents: number;
  currency: string;
  cancelledOn: string;
  note?: string;
  now?: Date;
}): CancellationRecord {
  return {
    id: createId("ledger"),
    subscriptionName: input.subscriptionName,
    category: input.category,
    monthlyCostCents: input.monthlyCostCents,
    currency: input.currency,
    cancelledOn: input.cancelledOn,
    recordedAt: (input.now ?? new Date()).toISOString(),
    auto: false,
    note: input.note,
  };
}

export function normalizeLedger(raw: unknown): CancellationRecord[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((value): CancellationRecord | null => {
      if (!value || typeof value !== "object") return null;
      const record = value as Record<string, unknown>;
      if (typeof record.id !== "string" || typeof record.subscriptionName !== "string") return null;
      const monthly = typeof record.monthlyCostCents === "number" ? record.monthlyCostCents : 0;
      return {
        id: record.id,
        subscriptionName: record.subscriptionName,
        category: typeof record.category === "string" ? record.category : "other",
        monthlyCostCents: monthly,
        currency: typeof record.currency === "string" ? record.currency.toUpperCase() : DEFAULT_BASE_CURRENCY,
        cancelledOn: typeof record.cancelledOn === "string" ? record.cancelledOn : todayDateInputValue(),
        recordedAt: typeof record.recordedAt === "string" ? record.recordedAt : new Date().toISOString(),
        auto: record.auto === true,
        note: typeof record.note === "string" ? record.note : undefined,
      };
    })
    .filter((value): value is CancellationRecord => value !== null);
}

export function ledgerCsvRow(record: CancellationRecord): Record<string, string> {
  return {
    recordType: "ledger",
    id: record.id,
    name: record.subscriptionName,
    category: record.category,
    costCents: String(record.monthlyCostCents),
    currency: record.currency,
    nextBillingDate: record.cancelledOn,
    createdAt: record.recordedAt,
    notes: record.note ?? "",
    color: record.auto ? "auto" : "manual",
  };
}

export function ledgerFromCsvRow(row: Record<string, string>): CancellationRecord {
  return {
    id: row.id || createId("ledger"),
    subscriptionName: row.name || "Cancelled subscription",
    category: row.category || "other",
    monthlyCostCents: Number.parseInt(row.costCents, 10) || 0,
    currency: row.currency || DEFAULT_BASE_CURRENCY,
    cancelledOn: row.nextBillingDate || todayDateInputValue(),
    recordedAt: row.createdAt || new Date().toISOString(),
    auto: row.color === "auto",
    note: row.notes || undefined,
  };
}
