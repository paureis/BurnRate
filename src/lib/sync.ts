import LZString from "lz-string";
import type { BurnRateData, Subscription, Trial } from "./burnrate";
import type { BurnRatePreferences } from "./preferences";
import { normalizePreferences } from "./preferences";
import { normalizeLedger } from "./ledger";
import { DEFAULT_BASE_CURRENCY } from "./currency";

const PREFIX_V1 = "BR1.";
const PREFIX_V2 = "BR2.";
const CURRENT_PREFIX = PREFIX_V2;

export class SyncDecodeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SyncDecodeError";
  }
}

export interface SyncSummary {
  subscriptionsCount: number;
  trialsCount: number;
  bytes: number;
  version: "BR1" | "BR2";
}

export function encodeSyncPayload(data: BurnRateData): string {
  const normalized = normalize(data);
  const json = JSON.stringify(normalized);
  const checksum = simpleChecksum(json).toString(36);
  const wrapped = `${json}|${checksum}`;
  const compressed = LZString.compressToEncodedURIComponent(wrapped);
  return `${CURRENT_PREFIX}${compressed}`;
}

export function decodeSyncPayload(input: string): BurnRateData {
  const { body, version } = parsePrefix(input);
  if (!body) {
    throw new SyncDecodeError("Sync payload is empty");
  }

  let decompressed: string | null;
  try {
    decompressed = LZString.decompressFromEncodedURIComponent(body);
  } catch {
    throw new SyncDecodeError("Sync payload could not be decompressed");
  }
  if (!decompressed) {
    throw new SyncDecodeError("Sync payload could not be decompressed");
  }

  const separatorIndex = decompressed.lastIndexOf("|");
  if (separatorIndex < 0) {
    throw new SyncDecodeError("Sync payload checksum is missing");
  }

  const json = decompressed.slice(0, separatorIndex);
  const checksum = decompressed.slice(separatorIndex + 1);
  if (simpleChecksum(json).toString(36) !== checksum) {
    throw new SyncDecodeError("Sync payload checksum mismatch");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new SyncDecodeError("Sync payload JSON is invalid");
  }

  return hydrate(parsed, version);
}

function parsePrefix(input: string): { body: string; version: "BR1" | "BR2" } {
  if (input.startsWith(PREFIX_V2)) {
    return { body: input.slice(PREFIX_V2.length), version: "BR2" };
  }
  if (input.startsWith(PREFIX_V1)) {
    return { body: input.slice(PREFIX_V1.length), version: "BR1" };
  }
  const match = /^BR\d+\./.exec(input);
  if (match) {
    throw new SyncDecodeError(`Unsupported sync payload version: ${match[0]}`);
  }
  throw new SyncDecodeError("Sync payload is missing the BR prefix");
}

export function summarizeSyncPayload(payload: string): SyncSummary {
  const data = decodeSyncPayload(payload);
  return {
    subscriptionsCount: data.subscriptions.length,
    trialsCount: data.trials.length,
    bytes: payload.length,
    version: payload.startsWith(PREFIX_V2) ? "BR2" : "BR1",
  };
}

export function mergeSync(current: BurnRateData, incoming: BurnRateData): BurnRateData {
  const existingNames = new Set(current.subscriptions.map((subscription) => subscription.name.toLowerCase()));
  const existingTrials = new Set(current.trials.map((trial) => trial.name.toLowerCase()));

  return {
    ...current,
    subscriptions: [
      ...current.subscriptions,
      ...incoming.subscriptions.filter((subscription) => !existingNames.has(subscription.name.toLowerCase())),
    ],
    trials: [...current.trials, ...incoming.trials.filter((trial) => !existingTrials.has(trial.name.toLowerCase()))],
    theme: current.theme,
  };
}

function normalize(data: BurnRateData): BurnRateData {
  const out: BurnRateData = {
    subscriptions: data.subscriptions.map(normalizeSubscription),
    trials: data.trials.map(normalizeTrial),
    theme: data.theme === "light" ? "light" : "dark",
  };
  if (data.budget) out.budget = data.budget;
  if (data.preferences) out.preferences = normalizePreferencesForWire(data.preferences);
  if (data.ledger && data.ledger.length > 0) out.ledger = data.ledger;
  return out;
}

function normalizePreferencesForWire(prefs: BurnRatePreferences): BurnRatePreferences {
  return {
    baseCurrency: prefs.baseCurrency || DEFAULT_BASE_CURRENCY,
    fxOverrides: prefs.fxOverrides ?? {},
    lastFxOverrideAt: prefs.lastFxOverrideAt ?? null,
    autoLockMinutes: prefs.autoLockMinutes ?? 15,
  };
}

function normalizeSubscription(subscription: Subscription): Subscription {
  // Preserve undefined optional fields so round-trips equal their input.
  const out: Subscription = {
    id: subscription.id,
    name: subscription.name,
    costCents: subscription.costCents,
    billingCycle: subscription.billingCycle,
    category: subscription.category,
    nextBillingDate: subscription.nextBillingDate,
    notes: subscription.notes ?? "",
    color: subscription.color,
    icon: subscription.icon,
    createdAt: subscription.createdAt,
  };
  if (subscription.currency) out.currency = subscription.currency;
  if (subscription.cancellingOn) out.cancellingOn = subscription.cancellingOn;
  return out;
}

function normalizeTrial(trial: Trial): Trial {
  const out: Trial = {
    id: trial.id,
    name: trial.name,
    trialStartDate: trial.trialStartDate,
    trialEndDate: trial.trialEndDate,
    costAfterTrialCents: trial.costAfterTrialCents,
    remindMe: trial.remindMe,
    createdAt: trial.createdAt,
  };
  if (trial.currency) out.currency = trial.currency;
  return out;
}

function hydrate(value: unknown, version: "BR1" | "BR2"): BurnRateData {
  if (!value || typeof value !== "object") {
    throw new SyncDecodeError("Sync payload shape is invalid");
  }
  const candidate = value as Partial<BurnRateData>;
  if (!Array.isArray(candidate.subscriptions) || !Array.isArray(candidate.trials)) {
    throw new SyncDecodeError("Sync payload missing subscriptions or trials array");
  }
  const out: BurnRateData = {
    subscriptions: candidate.subscriptions.map(hydrateSubscription),
    trials: candidate.trials.map(hydrateTrial),
    theme: candidate.theme === "light" ? "light" : "dark",
  };
  if (candidate.budget && typeof candidate.budget === "object") {
    out.budget = candidate.budget;
  }
  if (version === "BR2") {
    if (candidate.preferences) out.preferences = normalizePreferences(candidate.preferences);
    if (Array.isArray(candidate.ledger)) out.ledger = normalizeLedger(candidate.ledger);
  }
  return out;
}

function hydrateSubscription(value: unknown): Subscription {
  const record = value as Partial<Subscription>;
  if (typeof record.id !== "string" || typeof record.name !== "string" || typeof record.costCents !== "number") {
    throw new SyncDecodeError("Subscription record is malformed");
  }
  const out: Subscription = {
    id: record.id,
    name: record.name,
    costCents: record.costCents,
    billingCycle: record.billingCycle ?? "monthly",
    category: record.category ?? "other",
    nextBillingDate: record.nextBillingDate ?? "",
    notes: record.notes ?? "",
    color: record.color,
    icon: record.icon,
    createdAt: record.createdAt ?? new Date().toISOString(),
  };
  if (record.currency) out.currency = record.currency;
  if (record.cancellingOn) out.cancellingOn = record.cancellingOn;
  return out;
}

function hydrateTrial(value: unknown): Trial {
  const record = value as Partial<Trial>;
  if (typeof record.id !== "string" || typeof record.name !== "string") {
    throw new SyncDecodeError("Trial record is malformed");
  }
  const out: Trial = {
    id: record.id,
    name: record.name,
    trialStartDate: record.trialStartDate ?? "",
    trialEndDate: record.trialEndDate ?? "",
    costAfterTrialCents: typeof record.costAfterTrialCents === "number" ? record.costAfterTrialCents : 0,
    remindMe: record.remindMe ?? false,
    createdAt: record.createdAt ?? new Date().toISOString(),
  };
  if (record.currency) out.currency = record.currency;
  return out;
}

// FNV-1a 32-bit. Detects accidental corruption / truncation in URL-passed payloads.
// Not cryptographic: a motivated actor can recompute and forge it. Treat sync links
// as capability tokens, not as authenticated messages.
function simpleChecksum(input: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}
