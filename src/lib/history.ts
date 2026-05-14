// v4 Feature 5: 20-entry ring buffer of mutations across the app, with
// before/after snapshots small enough that the user can undo each entry.

export type HistoryOp =
  | "addSubscription"
  | "updateSubscription"
  | "deleteSubscription"
  | "bulkUpdate"
  | "bulkDelete"
  | "addTrial"
  | "updateTrial"
  | "deleteTrial"
  | "convertTrial"
  | "setCancellingOn"
  | "undoCancellation"
  | "applyDueCancellation"
  | "addLedger"
  | "deleteLedger"
  | "updateBudget"
  | "updatePreferences"
  | "addView"
  | "updateView"
  | "deleteView"
  | "addCategory"
  | "updateCategory"
  | "deleteCategory"
  | "importProfile"
  | "importCsv";

export interface HistoryEntry {
  id: string;
  ts: string;
  op: HistoryOp;
  summary: string;
  before: unknown;
  after: unknown;
  affectedRecordIds?: string[];
  // When true, the before/after deltas were too large to store and the entry
  // cannot be undone. We keep the metadata so the user still sees what happened.
  oversized?: boolean;
}

export const HISTORY_LIMIT = 20;
export const HISTORY_MAX_PAYLOAD_BYTES = 8 * 1024;

const ID_RANDOM_LEN = 6;
const ID_ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
let idCounter = 0;

function randomId(): string {
  let out = "";
  for (let i = 0; i < ID_RANDOM_LEN; i += 1) {
    out += ID_ALPHABET[Math.floor(Math.random() * ID_ALPHABET.length)];
  }
  return out;
}

/**
 * Build a fresh entry. Computes ID and timestamp; the caller is responsible
 * for cooperating with `prune` to enforce the ring buffer cap.
 */
export function record(
  partial: Omit<HistoryEntry, "id" | "ts">,
  now: Date = new Date(),
): HistoryEntry {
  // Compute oversized flag if not pre-set.
  let oversized = partial.oversized;
  if (oversized === undefined) {
    try {
      const beforeSize = byteLength(JSON.stringify(partial.before));
      const afterSize = byteLength(JSON.stringify(partial.after));
      if (beforeSize > HISTORY_MAX_PAYLOAD_BYTES || afterSize > HISTORY_MAX_PAYLOAD_BYTES) {
        oversized = true;
      }
    } catch {
      oversized = true;
    }
  }
  // Increment a counter to make IDs uniquely sortable within the same ms.
  idCounter = (idCounter + 1) & 0xffff;
  const id = `${now.getTime().toString(36)}-${idCounter.toString(36).padStart(4, "0")}-${randomId()}`;
  return {
    id,
    ts: now.toISOString(),
    ...partial,
    ...(oversized ? { oversized: true, before: null, after: null } : {}),
  };
}

/**
 * Keep at most `limit` entries (default 20), discarding oldest first.
 * Entries are assumed to be in chronological order (oldest first).
 */
export function prune(entries: HistoryEntry[], limit: number = HISTORY_LIMIT): HistoryEntry[] {
  if (entries.length <= limit) return entries;
  return entries.slice(entries.length - limit);
}

/**
 * Append an entry to a ring buffer and prune in one call.
 */
export function append(
  current: HistoryEntry[],
  partial: Omit<HistoryEntry, "id" | "ts">,
  now: Date = new Date(),
): HistoryEntry[] {
  return prune([...current, record(partial, now)]);
}

/**
 * Build the human-readable summary line for an op. Callers can override the
 * summary in `record({ summary: ... })` — this helper is for the common cases.
 */
export function buildSummary(op: HistoryOp, before: unknown, after: unknown): string {
  switch (op) {
    case "addSubscription":
      return `Added ${nameOf(after) ?? "a subscription"}.`;
    case "updateSubscription":
      return `Updated ${nameOf(after) ?? nameOf(before) ?? "a subscription"}.`;
    case "deleteSubscription":
      return `Deleted ${nameOf(before) ?? "a subscription"}.`;
    case "bulkUpdate": {
      const count = countOf(after) ?? countOf(before) ?? 0;
      return `Updated ${count} subscription${count === 1 ? "" : "s"}.`;
    }
    case "bulkDelete": {
      const count = countOf(before) ?? 0;
      const names = namesOf(before, 3);
      return `Deleted ${count} subscription${count === 1 ? "" : "s"}${names ? `: ${names}` : ""}.`;
    }
    case "addTrial":
      return `Added trial ${nameOf(after) ?? ""}.`.trim();
    case "updateTrial":
      return `Updated trial ${nameOf(after) ?? nameOf(before) ?? ""}.`.trim();
    case "deleteTrial":
      return `Removed trial ${nameOf(before) ?? ""}.`.trim();
    case "convertTrial":
      return `Converted ${nameOf(before) ?? "a trial"} to a subscription.`;
    case "setCancellingOn":
      return `Scheduled ${nameOf(after) ?? "a subscription"} to cancel.`;
    case "undoCancellation":
      return `Reverted cancellation for ${nameOf(after) ?? "a subscription"}.`;
    case "applyDueCancellation": {
      const count = countOf(after) ?? 0;
      return `Auto-cancelled ${count} due subscription${count === 1 ? "" : "s"}.`;
    }
    case "addLedger":
      return `Added ledger entry for ${nameOf(after) ?? ""}.`.trim();
    case "deleteLedger":
      return `Removed a ledger entry.`;
    case "updateBudget":
      return `Updated budget goals.`;
    case "updatePreferences":
      return `Updated preferences.`;
    case "addView":
      return `Saved view "${nameOf(after) ?? ""}".`.trim();
    case "updateView":
      return `Updated view "${nameOf(after) ?? nameOf(before) ?? ""}".`.trim();
    case "deleteView":
      return `Deleted view "${nameOf(before) ?? ""}".`.trim();
    case "addCategory":
      return `Added category ${nameOf(after) ?? ""}.`.trim();
    case "updateCategory":
      return `Updated category ${nameOf(after) ?? nameOf(before) ?? ""}.`.trim();
    case "deleteCategory":
      return `Deleted category ${nameOf(before) ?? ""}.`.trim();
    case "importProfile":
      return `Imported profile settings.`;
    case "importCsv": {
      const count = countOf(after) ?? 0;
      return `Imported ${count} record${count === 1 ? "" : "s"} from CSV.`;
    }
  }
}

/**
 * Apply an entry's `before` snapshot to revert the change. The shape of
 * `before` is op-specific; the caller wires this through the appropriate
 * state setter. Returns false when the entry cannot be undone.
 */
export function isUndoable(entry: HistoryEntry): boolean {
  return !entry.oversized;
}

/**
 * Remove an entry from the ring buffer by id (used after a successful undo).
 */
export function dropEntry(entries: HistoryEntry[], id: string): HistoryEntry[] {
  return entries.filter((entry) => entry.id !== id);
}

/**
 * Normalize a stored value (e.g. from localStorage) into a valid HistoryEntry[].
 */
export function normalizeHistory(stored: unknown): HistoryEntry[] {
  if (!Array.isArray(stored)) return [];
  const out: HistoryEntry[] = [];
  const seenIds = new Set<string>();
  for (const raw of stored) {
    if (!raw || typeof raw !== "object") continue;
    const r = raw as Record<string, unknown>;
    if (typeof r.id !== "string" || seenIds.has(r.id)) continue;
    if (typeof r.op !== "string") continue;
    if (typeof r.ts !== "string") continue;
    if (typeof r.summary !== "string") continue;
    seenIds.add(r.id);
    out.push({
      id: r.id,
      ts: r.ts,
      op: r.op as HistoryOp,
      summary: r.summary,
      before: r.before,
      after: r.after,
      affectedRecordIds: Array.isArray(r.affectedRecordIds)
        ? r.affectedRecordIds.filter((x): x is string => typeof x === "string")
        : undefined,
      oversized: r.oversized === true ? true : undefined,
    });
  }
  return prune(out);
}

function nameOf(value: unknown): string | null {
  if (Array.isArray(value)) {
    const first = value[0];
    if (first && typeof first === "object" && typeof (first as { name?: unknown }).name === "string") {
      return (first as { name: string }).name;
    }
    return null;
  }
  if (value && typeof value === "object" && typeof (value as { name?: unknown }).name === "string") {
    return (value as { name: string }).name;
  }
  return null;
}

function countOf(value: unknown): number | null {
  if (Array.isArray(value)) return value.length;
  return null;
}

function namesOf(value: unknown, limit: number): string {
  if (!Array.isArray(value)) return "";
  const names: string[] = [];
  for (const item of value) {
    if (item && typeof item === "object" && typeof (item as { name?: unknown }).name === "string") {
      names.push((item as { name: string }).name);
    }
    if (names.length >= limit) break;
  }
  if (names.length === 0) return "";
  if (value.length > limit) return `${names.join(", ")}, +${value.length - limit} more`;
  return names.join(", ");
}

function byteLength(value: string | undefined): number {
  if (!value) return 0;
  // Approximate — sufficient for the oversized guard.
  return value.length;
}
