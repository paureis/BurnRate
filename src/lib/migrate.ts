import {
  type BillingCycle,
  billingCycles,
  defaultCategories,
  type Subscription,
  type Trial,
} from "./burnrate";
import { DEFAULT_BASE_CURRENCY } from "./currency";

export const SCHEMA_VERSION = 3;

function isBillingCycle(value: unknown): value is BillingCycle {
  return typeof value === "string" && (billingCycles as readonly string[]).includes(value);
}

function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function asNumber(value: unknown, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function asCurrency(value: unknown): string {
  if (typeof value === "string" && /^[A-Za-z]{3}$/.test(value)) {
    return value.toUpperCase();
  }
  return DEFAULT_BASE_CURRENCY;
}

function asCategory(value: unknown): string {
  const candidate = asString(value, "other");
  if ((defaultCategories as readonly string[]).includes(candidate)) {
    return candidate;
  }
  return candidate.trim() ? candidate : "other";
}

function nullableString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

// v2 Subscription had no `currency` and no `cancellingOn`. v3 adds both.
export function migrateSubscription(raw: unknown): Subscription | null {
  if (!raw || typeof raw !== "object") return null;
  const record = raw as Record<string, unknown>;
  if (typeof record.id !== "string" || typeof record.name !== "string") return null;
  const cancellingOn = nullableString(record.cancellingOn);
  return {
    id: record.id,
    name: record.name,
    costCents: asNumber(record.costCents, 0),
    billingCycle: isBillingCycle(record.billingCycle) ? record.billingCycle : "monthly",
    category: asCategory(record.category),
    nextBillingDate: asString(record.nextBillingDate, ""),
    notes: asString(record.notes, ""),
    color: typeof record.color === "string" ? record.color : undefined,
    icon: typeof record.icon === "string" ? record.icon : undefined,
    createdAt: asString(record.createdAt, new Date().toISOString()),
    currency: asCurrency(record.currency),
    ...(cancellingOn ? { cancellingOn } : {}),
  };
}

export function migrateTrial(raw: unknown): Trial | null {
  if (!raw || typeof raw !== "object") return null;
  const record = raw as Record<string, unknown>;
  if (typeof record.id !== "string" || typeof record.name !== "string") return null;
  return {
    id: record.id,
    name: record.name,
    trialStartDate: asString(record.trialStartDate, ""),
    trialEndDate: asString(record.trialEndDate, ""),
    costAfterTrialCents: asNumber(record.costAfterTrialCents, 0),
    remindMe: typeof record.remindMe === "boolean" ? record.remindMe : false,
    createdAt: asString(record.createdAt, new Date().toISOString()),
    currency: asCurrency(record.currency),
  };
}

export function migrateSubscriptions(raw: unknown): Subscription[] {
  if (!Array.isArray(raw)) return [];
  return raw.map(migrateSubscription).filter((value): value is Subscription => value !== null);
}

export function migrateTrials(raw: unknown): Trial[] {
  if (!Array.isArray(raw)) return [];
  return raw.map(migrateTrial).filter((value): value is Trial => value !== null);
}
