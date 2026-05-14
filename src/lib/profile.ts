// v4 Feature 7: portable `.burnprofile` settings file. Carries theme,
// preferences (currency/FX/auto-lock/dashboardLayout), saved views, and
// custom categories — but NOT subscriptions, trials, ledger, or snapshots.

import type { Theme } from "./burnrate";
import type { BurnRatePreferences } from "./preferences";
import { normalizePreferences } from "./preferences";
import type { SavedView } from "./views";
import { normalizeViews, isBuiltinView } from "./views";
import type { CategoryDef } from "./categories";
import { buildBuiltInCategories, mergeOnImport } from "./categories";

export const PROFILE_SCHEMA_VERSION = 1;

export interface ProfileNotificationOptIns {
  // Reserved for v6's notification hub. Settings-only, no data.
  [channel: string]: boolean;
}

export interface BurnRateProfile {
  schemaVersion: typeof PROFILE_SCHEMA_VERSION;
  exportedAt: string;
  appVersion: string;
  theme?: Theme | "system";
  preferences?: BurnRatePreferences;
  views?: SavedView[];
  categories?: CategoryDef[];
  notificationOptIns?: ProfileNotificationOptIns;
}

export interface ProfileSettingsState {
  theme: Theme;
  preferences: BurnRatePreferences;
  views: SavedView[];
  categories: CategoryDef[];
  notificationOptIns?: ProfileNotificationOptIns;
}

export type ApplyStrategy = "merge" | "replace";

/**
 * Snapshot the user's current settings as a portable profile.
 */
export function exportProfile(
  state: ProfileSettingsState,
  meta: { appVersion: string; now?: Date } = { appVersion: "0.0.0" },
): BurnRateProfile {
  return {
    schemaVersion: PROFILE_SCHEMA_VERSION,
    exportedAt: (meta.now ?? new Date()).toISOString(),
    appVersion: meta.appVersion,
    theme: state.theme,
    preferences: state.preferences,
    // User views only — built-ins are seeded by the receiving install.
    views: state.views.filter((view) => !isBuiltinView(view)),
    // Include user categories AND any built-in edits (color/label/hidden).
    categories: state.categories,
    notificationOptIns: state.notificationOptIns,
  };
}

/**
 * Validate an unknown blob. Returns the typed profile on success.
 */
export function validateProfile(
  input: unknown,
): { ok: true; profile: BurnRateProfile } | { ok: false; reason: string } {
  if (!input || typeof input !== "object") return { ok: false, reason: "Profile must be a JSON object." };
  const r = input as Record<string, unknown>;
  if (r.schemaVersion !== PROFILE_SCHEMA_VERSION) {
    return { ok: false, reason: `Unsupported profile schema version: ${String(r.schemaVersion)}` };
  }
  if (typeof r.exportedAt !== "string") return { ok: false, reason: "Profile is missing exportedAt." };

  if (r.preferences !== undefined && r.preferences !== null) {
    const prefs = r.preferences as { fxOverrides?: unknown };
    if (prefs.fxOverrides && typeof prefs.fxOverrides === "object") {
      for (const [code, value] of Object.entries(prefs.fxOverrides as Record<string, unknown>)) {
        if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
          return { ok: false, reason: `FX override for ${code} is not a positive number.` };
        }
      }
    }
  }

  const profile: BurnRateProfile = {
    schemaVersion: PROFILE_SCHEMA_VERSION,
    exportedAt: r.exportedAt,
    appVersion: typeof r.appVersion === "string" ? r.appVersion : "unknown",
    theme: r.theme === "light" || r.theme === "dark" || r.theme === "system" ? r.theme : undefined,
    preferences:
      r.preferences && typeof r.preferences === "object" ? normalizePreferences(r.preferences) : undefined,
    views: Array.isArray(r.views) ? normalizeViews(r.views) : undefined,
    categories: Array.isArray(r.categories)
      ? (r.categories.filter((c) => c && typeof c === "object") as CategoryDef[])
      : undefined,
    notificationOptIns:
      r.notificationOptIns && typeof r.notificationOptIns === "object"
        ? sanitizeNotificationOptIns(r.notificationOptIns as Record<string, unknown>)
        : undefined,
  };
  return { ok: true, profile };
}

/**
 * Apply a validated profile onto an existing state.
 * - `merge`: keep existing where missing in the profile; user views/categories are union'd by id.
 * - `replace`: overwrite settings slices wholesale (data slices remain untouched in BOTH modes).
 */
export function applyProfile(
  state: ProfileSettingsState,
  profile: BurnRateProfile,
  opts: { strategy: ApplyStrategy },
): ProfileSettingsState {
  const next: ProfileSettingsState = { ...state };
  if (opts.strategy === "replace") {
    if (profile.theme) next.theme = profile.theme === "system" ? state.theme : profile.theme;
    if (profile.preferences) next.preferences = profile.preferences;
    if (profile.views) {
      // Replace overwrites user views but always keeps built-ins.
      const builtIns = state.views.filter(isBuiltinView);
      const userViews = profile.views.filter((view) => !isBuiltinView(view));
      next.views = [...builtIns, ...userViews];
    }
    if (profile.categories) next.categories = mergeOnImport(buildBuiltInCategories(), profile.categories);
    if (profile.notificationOptIns) next.notificationOptIns = profile.notificationOptIns;
    return next;
  }

  // merge
  if (profile.theme && profile.theme !== "system") next.theme = profile.theme;
  if (profile.preferences) {
    next.preferences = {
      ...state.preferences,
      ...profile.preferences,
      fxOverrides: {
        ...(state.preferences.fxOverrides ?? {}),
        ...(profile.preferences.fxOverrides ?? {}),
      },
    };
  }
  if (profile.views) {
    const byId = new Map(state.views.map((v) => [v.id, v] as const));
    for (const view of profile.views) {
      if (isBuiltinView(view)) continue;
      byId.set(view.id, view);
    }
    next.views = [...byId.values()];
  }
  if (profile.categories) {
    next.categories = mergeOnImport(state.categories, profile.categories);
  }
  if (profile.notificationOptIns) {
    next.notificationOptIns = { ...(state.notificationOptIns ?? {}), ...profile.notificationOptIns };
  }
  return next;
}

/**
 * Build a human-readable preview of what an `applyProfile` call would change.
 */
export function previewProfile(
  state: ProfileSettingsState,
  profile: BurnRateProfile,
): Array<{ field: string; from: string; to: string }> {
  const diff: Array<{ field: string; from: string; to: string }> = [];
  if (profile.theme && profile.theme !== state.theme) {
    diff.push({ field: "Theme", from: state.theme, to: profile.theme });
  }
  if (profile.preferences) {
    if (profile.preferences.baseCurrency && profile.preferences.baseCurrency !== state.preferences.baseCurrency) {
      diff.push({
        field: "Base currency",
        from: state.preferences.baseCurrency,
        to: profile.preferences.baseCurrency,
      });
    }
    const incomingOverrides = profile.preferences.fxOverrides ?? {};
    const existingOverrides = state.preferences.fxOverrides ?? {};
    const newCodes = Object.keys(incomingOverrides).filter((k) => !(k in existingOverrides));
    if (newCodes.length > 0) {
      diff.push({ field: "FX overrides", from: "—", to: `${newCodes.length} new` });
    }
  }
  if (profile.views) {
    const userIncoming = profile.views.filter((view) => !isBuiltinView(view));
    const existingIds = new Set(state.views.map((v) => v.id));
    const newViews = userIncoming.filter((v) => !existingIds.has(v.id));
    if (newViews.length > 0) {
      diff.push({ field: "Saved views", from: "—", to: `${newViews.length} new` });
    }
  }
  if (profile.categories) {
    const existingIds = new Set(state.categories.map((c) => c.id));
    const newCats = profile.categories.filter((c) => !existingIds.has(c.id));
    if (newCats.length > 0) {
      diff.push({ field: "Categories", from: "—", to: `${newCats.length} new` });
    }
  }
  return diff;
}

function sanitizeNotificationOptIns(value: Record<string, unknown>): ProfileNotificationOptIns {
  const out: ProfileNotificationOptIns = {};
  for (const [key, v] of Object.entries(value)) {
    if (typeof v === "boolean") out[key] = v;
  }
  return out;
}
