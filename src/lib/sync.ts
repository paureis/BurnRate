import LZString from "lz-string";
import type { BurnRateData, Subscription, Trial } from "./burnrate";

const PREFIX = "BR1.";

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
}

export function encodeSyncPayload(data: BurnRateData): string {
  const normalized = normalize(data);
  const json = JSON.stringify(normalized);
  const checksum = simpleChecksum(json).toString(36);
  const wrapped = `${json}|${checksum}`;
  const compressed = LZString.compressToEncodedURIComponent(wrapped);
  return `${PREFIX}${compressed}`;
}

export function decodeSyncPayload(input: string): BurnRateData {
  if (!input.startsWith(PREFIX)) {
    const match = /^BR\d+\./.exec(input);
    if (match) {
      throw new SyncDecodeError(`Unsupported sync payload version: ${match[0]}`);
    }
    throw new SyncDecodeError("Sync payload is missing the BR1. prefix");
  }

  const body = input.slice(PREFIX.length);
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
    throw new SyncDecodeError("Sync payload checksum mismatch (possible tampering)");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new SyncDecodeError("Sync payload JSON is invalid");
  }

  return hydrate(parsed);
}

export function summarizeSyncPayload(payload: string): SyncSummary {
  const data = decodeSyncPayload(payload);
  return {
    subscriptionsCount: data.subscriptions.length,
    trialsCount: data.trials.length,
    bytes: payload.length,
  };
}

export function mergeSync(current: BurnRateData, incoming: BurnRateData): BurnRateData {
  const existingNames = new Set(current.subscriptions.map((subscription) => subscription.name.toLowerCase()));
  const existingTrials = new Set(current.trials.map((trial) => trial.name.toLowerCase()));

  return {
    subscriptions: [
      ...current.subscriptions,
      ...incoming.subscriptions.filter((subscription) => !existingNames.has(subscription.name.toLowerCase())),
    ],
    trials: [...current.trials, ...incoming.trials.filter((trial) => !existingTrials.has(trial.name.toLowerCase()))],
    theme: current.theme,
  };
}

function normalize(data: BurnRateData): BurnRateData {
  return {
    subscriptions: data.subscriptions.map(normalizeSubscription),
    trials: data.trials.map(normalizeTrial),
    theme: data.theme === "light" ? "light" : "dark",
  };
}

function normalizeSubscription(subscription: Subscription): Subscription {
  return {
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
}

function normalizeTrial(trial: Trial): Trial {
  return {
    id: trial.id,
    name: trial.name,
    trialStartDate: trial.trialStartDate,
    trialEndDate: trial.trialEndDate,
    costAfterTrialCents: trial.costAfterTrialCents,
    remindMe: trial.remindMe,
    createdAt: trial.createdAt,
  };
}

function hydrate(value: unknown): BurnRateData {
  if (!value || typeof value !== "object") {
    throw new SyncDecodeError("Sync payload shape is invalid");
  }
  const candidate = value as Partial<BurnRateData>;
  if (!Array.isArray(candidate.subscriptions) || !Array.isArray(candidate.trials)) {
    throw new SyncDecodeError("Sync payload missing subscriptions or trials array");
  }
  return {
    subscriptions: candidate.subscriptions.map(hydrateSubscription),
    trials: candidate.trials.map(hydrateTrial),
    theme: candidate.theme === "light" ? "light" : "dark",
  };
}

function hydrateSubscription(value: unknown): Subscription {
  const record = value as Partial<Subscription>;
  if (typeof record.id !== "string" || typeof record.name !== "string" || typeof record.costCents !== "number") {
    throw new SyncDecodeError("Subscription record is malformed");
  }
  return {
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
}

function hydrateTrial(value: unknown): Trial {
  const record = value as Partial<Trial>;
  if (typeof record.id !== "string" || typeof record.name !== "string") {
    throw new SyncDecodeError("Trial record is malformed");
  }
  return {
    id: record.id,
    name: record.name,
    trialStartDate: record.trialStartDate ?? "",
    trialEndDate: record.trialEndDate ?? "",
    costAfterTrialCents: typeof record.costAfterTrialCents === "number" ? record.costAfterTrialCents : 0,
    remindMe: record.remindMe ?? false,
    createdAt: record.createdAt ?? new Date().toISOString(),
  };
}

function simpleChecksum(input: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}
