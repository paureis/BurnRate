// v6 Feature 1: household profiles + cost splits.

import type { Subscription } from "./burnrate";
import { monthlyCostInBaseCents } from "./burnrate";
import type { FxContext } from "./currency";

export interface Profile {
  id: string;
  name: string;
  avatarColor: string;
  avatarInitials?: string;
  createdAt: string;
  isDefault?: boolean;
}

export type Owners = Array<{ profileId: string; share: number }>;

const DEFAULT_PROFILE_ID = "default";

export function defaultProfile(now: Date = new Date()): Profile {
  return {
    id: DEFAULT_PROFILE_ID,
    name: "Me",
    avatarColor: "#ff5a3d",
    createdAt: now.toISOString(),
    isDefault: true,
  };
}

/**
 * Normalize an owners list: clamp each share to [0, 1], drop bad entries,
 * and renormalize so the total equals exactly 1. When the input is empty
 * or all bad, returns 100% to the default profile.
 */
export function normalizeOwners(owners: Owners | undefined, defaultProfileId: string = DEFAULT_PROFILE_ID): Owners {
  if (!Array.isArray(owners) || owners.length === 0) {
    return [{ profileId: defaultProfileId, share: 1 }];
  }
  const cleaned: Owners = [];
  for (const entry of owners) {
    if (!entry || typeof entry !== "object") continue;
    if (typeof entry.profileId !== "string" || !entry.profileId) continue;
    if (typeof entry.share !== "number" || !Number.isFinite(entry.share)) continue;
    const share = Math.max(0, Math.min(1, entry.share));
    cleaned.push({ profileId: entry.profileId, share });
  }
  if (cleaned.length === 0) return [{ profileId: defaultProfileId, share: 1 }];
  const total = cleaned.reduce((sum, entry) => sum + entry.share, 0);
  if (total <= 0) {
    // Even split fallback.
    const evenShare = 1 / cleaned.length;
    return cleaned.map((entry) => ({ ...entry, share: evenShare }));
  }
  return cleaned.map((entry) => ({ ...entry, share: entry.share / total }));
}

/**
 * Return the share for a given profile on a subscription.
 * - No `owners` → defaultProfile gets 100%, every other profile gets 0%.
 * - Otherwise the sum of all matching entries (in case of duplicates).
 */
export function shareFor(
  sub: Subscription,
  profileId: string,
  defaultProfileId: string = DEFAULT_PROFILE_ID,
): number {
  const owners = (sub as Subscription & { owners?: Owners }).owners;
  if (!owners || owners.length === 0) {
    return profileId === defaultProfileId ? 1 : 0;
  }
  let total = 0;
  for (const owner of owners) {
    if (owner.profileId === profileId) total += owner.share;
  }
  return total;
}

/**
 * Split each subscription's monthly burn (base-currency cents) across the
 * profiles that own it. Returns a map `profileId -> totalCents`.
 */
export function splitMonthlyBurn(
  subs: Subscription[],
  profiles: Profile[],
  fx?: FxContext,
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const profile of profiles) out[profile.id] = 0;
  const defaultId = profiles.find((p) => p.isDefault)?.id ?? DEFAULT_PROFILE_ID;
  for (const sub of subs) {
    const monthly = monthlyCostInBaseCents(sub, fx);
    const owners = (sub as Subscription & { owners?: Owners }).owners;
    if (!owners || owners.length === 0) {
      out[defaultId] = (out[defaultId] ?? 0) + monthly;
      continue;
    }
    for (const owner of owners) {
      if (!(owner.profileId in out)) continue;
      out[owner.profileId] = (out[owner.profileId] ?? 0) + Math.round(monthly * owner.share);
    }
  }
  return out;
}

/**
 * Replace deletedProfileId's shares with fallbackProfileId across all subs.
 * Returns a fresh subs array.
 */
export function reassignOnProfileDelete(
  subs: Subscription[],
  deletedProfileId: string,
  fallbackProfileId: string,
): Subscription[] {
  return subs.map((sub) => {
    const owners = (sub as Subscription & { owners?: Owners }).owners;
    if (!owners) return sub;
    const touched = owners.some((entry) => entry.profileId === deletedProfileId);
    if (!touched) return sub;
    const remapped = owners.map((entry) =>
      entry.profileId === deletedProfileId ? { profileId: fallbackProfileId, share: entry.share } : entry,
    );
    // Collapse duplicates after remap.
    const collapsed = new Map<string, number>();
    for (const entry of remapped) {
      collapsed.set(entry.profileId, (collapsed.get(entry.profileId) ?? 0) + entry.share);
    }
    const merged: Owners = [...collapsed.entries()].map(([profileId, share]) => ({ profileId, share }));
    return { ...sub, ...({ owners: merged } as Record<string, unknown>) } as Subscription;
  });
}

export function buildProfile(input: { name: string; avatarColor?: string }): Profile {
  return {
    id: `prof-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
    name: input.name.trim() || "New profile",
    avatarColor: input.avatarColor ?? "#7cc7ff",
    createdAt: new Date().toISOString(),
  };
}

export function normalizeProfiles(stored: unknown): Profile[] {
  if (!Array.isArray(stored)) return [defaultProfile()];
  const out: Profile[] = [];
  const seen = new Set<string>();
  let hasDefault = false;
  for (const raw of stored) {
    if (!raw || typeof raw !== "object") continue;
    const r = raw as Record<string, unknown>;
    if (typeof r.id !== "string" || seen.has(r.id)) continue;
    seen.add(r.id);
    const name = typeof r.name === "string" && r.name.trim() ? r.name.trim() : r.id;
    const avatarColor =
      typeof r.avatarColor === "string" && /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(r.avatarColor)
        ? r.avatarColor
        : "#7cc7ff";
    const createdAt = typeof r.createdAt === "string" ? r.createdAt : new Date().toISOString();
    const isDefault = r.isDefault === true;
    if (isDefault) hasDefault = true;
    out.push({
      id: r.id,
      name,
      avatarColor,
      createdAt,
      ...(isDefault ? { isDefault: true } : {}),
      ...(typeof r.avatarInitials === "string" ? { avatarInitials: r.avatarInitials } : {}),
    });
  }
  if (out.length === 0) return [defaultProfile()];
  if (!hasDefault) out[0].isDefault = true;
  return out;
}

export const DEFAULT_PROFILE_ID_CONSTANT = DEFAULT_PROFILE_ID;
