import {
  type ActiveDiscount,
  type BillingCycle,
  billingCycles,
  defaultCategories,
  type DiscountSource,
  type PlannedPriceChange,
  type Subscription,
  type Trial,
  type UsageEntry,
} from "./burnrate";
import { DEFAULT_BASE_CURRENCY } from "./currency";

export const SCHEMA_VERSION = 6;

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

// v4: tags are lowercase-kebab strings. Migrating from v3 hydrates as undefined when absent.
function migrateTags(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const seen = new Set<string>();
  const out: string[] = [];
  for (const candidate of value) {
    if (typeof candidate !== "string") continue;
    const normalized = candidate.trim().toLowerCase();
    if (!normalized || normalized.length > 20) continue;
    if (!/^[a-z0-9-]+$/.test(normalized)) continue;
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    out.push(normalized);
    if (out.length >= 10) break;
  }
  return out.length > 0 ? out : undefined;
}

// v5: usage log keyed by YYYY-MM. Drop any malformed keys/values silently.
function migrateUsageLog(value: unknown): Record<string, UsageEntry> | undefined {
  if (!value || typeof value !== "object") return undefined;
  const out: Record<string, UsageEntry> = {};
  for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(key)) continue;
    if (!raw || typeof raw !== "object") continue;
    const r = raw as Record<string, unknown>;
    out[key] = {
      used: r.used === true,
      ...(typeof r.sessionCount === "number" ? { sessionCount: r.sessionCount } : {}),
      ...(typeof r.note === "string" ? { note: r.note } : {}),
      recordedAt: typeof r.recordedAt === "string" ? r.recordedAt : new Date().toISOString(),
    };
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

// v5: planned price changes attached to a subscription.
function migratePriceChanges(value: unknown): PlannedPriceChange[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const out: PlannedPriceChange[] = [];
  for (const raw of value) {
    if (!raw || typeof raw !== "object") continue;
    const r = raw as Record<string, unknown>;
    if (typeof r.id !== "string" || typeof r.effectiveDate !== "string") continue;
    if (typeof r.newCostCents !== "number" || !Number.isFinite(r.newCostCents)) continue;
    out.push({
      id: r.id,
      effectiveDate: r.effectiveDate,
      newCostCents: r.newCostCents,
      ...(typeof r.note === "string" ? { note: r.note } : {}),
      addedAt: typeof r.addedAt === "string" ? r.addedAt : new Date().toISOString(),
    });
  }
  return out.length > 0 ? out : undefined;
}

const VALID_DISCOUNT_SOURCES: readonly DiscountSource[] = [
  "retention",
  "promo",
  "student",
  "annual-prepay",
  "household",
  "other",
];

// v5: active discount.
function migrateDiscount(value: unknown): ActiveDiscount | undefined {
  if (!value || typeof value !== "object") return undefined;
  const r = value as Record<string, unknown>;
  if (typeof r.id !== "string" || typeof r.originalCostCents !== "number") return undefined;
  if (!Number.isFinite(r.originalCostCents) || r.originalCostCents <= 0) return undefined;
  const source = VALID_DISCOUNT_SOURCES.includes(r.source as DiscountSource) ? (r.source as DiscountSource) : "other";
  return {
    id: r.id,
    originalCostCents: r.originalCostCents,
    negotiatedOn: typeof r.negotiatedOn === "string" ? r.negotiatedOn : new Date().toISOString().slice(0, 10),
    ...(typeof r.expiresOn === "string" ? { expiresOn: r.expiresOn } : {}),
    ...(typeof r.note === "string" ? { note: r.note } : {}),
    source,
  };
}

// v6: subscription owners (cost splits).
function migrateOwners(value: unknown): Array<{ profileId: string; share: number }> | undefined {
  if (!Array.isArray(value)) return undefined;
  const out: Array<{ profileId: string; share: number }> = [];
  for (const raw of value) {
    if (!raw || typeof raw !== "object") continue;
    const r = raw as Record<string, unknown>;
    if (typeof r.profileId !== "string") continue;
    if (typeof r.share !== "number" || !Number.isFinite(r.share)) continue;
    out.push({ profileId: r.profileId, share: Math.max(0, Math.min(1, r.share)) });
  }
  return out.length > 0 ? out : undefined;
}

// v2 Subscription had no `currency` and no `cancellingOn`. v3 adds both. v4 adds tags.
// v5 adds usageLog/priceChanges/activeDiscount. v6 adds owners.
export function migrateSubscription(raw: unknown): Subscription | null {
  if (!raw || typeof raw !== "object") return null;
  const record = raw as Record<string, unknown>;
  if (typeof record.id !== "string" || typeof record.name !== "string") return null;
  const cancellingOn = nullableString(record.cancellingOn);
  const tags = migrateTags(record.tags);
  const usageLog = migrateUsageLog(record.usageLog);
  const priceChanges = migratePriceChanges(record.priceChanges);
  const activeDiscount = migrateDiscount(record.activeDiscount);
  const owners = migrateOwners((record as { owners?: unknown }).owners);
  const sub: Subscription = {
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
    ...(tags ? { tags } : {}),
    ...(usageLog ? { usageLog } : {}),
    ...(priceChanges ? { priceChanges } : {}),
    ...(activeDiscount ? { activeDiscount } : {}),
  };
  if (owners) (sub as Subscription & { owners?: typeof owners }).owners = owners;
  return sub;
}

export function migrateTrial(raw: unknown): Trial | null {
  if (!raw || typeof raw !== "object") return null;
  const record = raw as Record<string, unknown>;
  if (typeof record.id !== "string" || typeof record.name !== "string") return null;
  const tags = migrateTags(record.tags);
  return {
    id: record.id,
    name: record.name,
    trialStartDate: asString(record.trialStartDate, ""),
    trialEndDate: asString(record.trialEndDate, ""),
    costAfterTrialCents: asNumber(record.costAfterTrialCents, 0),
    remindMe: typeof record.remindMe === "boolean" ? record.remindMe : false,
    createdAt: asString(record.createdAt, new Date().toISOString()),
    currency: asCurrency(record.currency),
    ...(tags ? { tags } : {}),
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
