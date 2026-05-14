// v5 Feature 7: cancellation attempts log. Tracks each time the user
// walked a playbook, and the outcome they chose.

export type CancellationOutcome =
  | "cancelled"
  | "kept"
  | "downgraded"
  | "discount-accepted"
  | "abandoned";

export interface CancellationAttempt {
  id: string;
  subscriptionId: string;
  serviceName: string;
  startedAt: string;
  completedAt?: string;
  outcome?: CancellationOutcome;
  retentionOfferText?: string;
  note?: string;
  ledgerRecordId?: string;
}

export function buildAttempt(input: { subscriptionId: string; serviceName: string }): CancellationAttempt {
  return {
    id: `att-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
    subscriptionId: input.subscriptionId,
    serviceName: input.serviceName,
    startedAt: new Date().toISOString(),
  };
}

export function closeAttempt(
  attempt: CancellationAttempt,
  outcome: CancellationOutcome,
  patch: { retentionOfferText?: string; note?: string; ledgerRecordId?: string } = {},
): CancellationAttempt {
  return {
    ...attempt,
    outcome,
    completedAt: new Date().toISOString(),
    ...(patch.retentionOfferText ? { retentionOfferText: patch.retentionOfferText } : {}),
    ...(patch.note ? { note: patch.note } : {}),
    ...(patch.ledgerRecordId ? { ledgerRecordId: patch.ledgerRecordId } : {}),
  };
}

export function normalizeAttempts(stored: unknown): CancellationAttempt[] {
  if (!Array.isArray(stored)) return [];
  const out: CancellationAttempt[] = [];
  const seen = new Set<string>();
  for (const raw of stored) {
    if (!raw || typeof raw !== "object") continue;
    const r = raw as Record<string, unknown>;
    if (
      typeof r.id !== "string" ||
      typeof r.subscriptionId !== "string" ||
      typeof r.serviceName !== "string" ||
      typeof r.startedAt !== "string"
    ) {
      continue;
    }
    if (seen.has(r.id)) continue;
    seen.add(r.id);
    out.push({
      id: r.id,
      subscriptionId: r.subscriptionId,
      serviceName: r.serviceName,
      startedAt: r.startedAt,
      completedAt: typeof r.completedAt === "string" ? r.completedAt : undefined,
      outcome: isOutcome(r.outcome) ? r.outcome : undefined,
      retentionOfferText: typeof r.retentionOfferText === "string" ? r.retentionOfferText : undefined,
      note: typeof r.note === "string" ? r.note : undefined,
      ledgerRecordId: typeof r.ledgerRecordId === "string" ? r.ledgerRecordId : undefined,
    });
  }
  return out;
}

function isOutcome(value: unknown): value is CancellationOutcome {
  return (
    value === "cancelled" ||
    value === "kept" ||
    value === "downgraded" ||
    value === "discount-accepted" ||
    value === "abandoned"
  );
}

export function attemptSummary(attempts: CancellationAttempt[]): {
  total: number;
  cancelled: number;
  kept: number;
  discountAccepted: number;
  monthlySavedFromRetentions: number;
} {
  let cancelled = 0;
  let kept = 0;
  let discountAccepted = 0;
  for (const attempt of attempts) {
    if (attempt.outcome === "cancelled") cancelled += 1;
    if (attempt.outcome === "kept") kept += 1;
    if (attempt.outcome === "discount-accepted") discountAccepted += 1;
  }
  return {
    total: attempts.length,
    cancelled,
    kept,
    discountAccepted,
    monthlySavedFromRetentions: 0, // The ledger holds dollar amounts; this is a count-based summary.
  };
}
