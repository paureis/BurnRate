import { describe, expect, it } from "vitest";
import {
  PROFILE_SCHEMA_VERSION,
  applyProfile,
  exportProfile,
  previewProfile,
  validateProfile,
  type ProfileSettingsState,
} from "../profile";
import { defaultPreferences } from "../preferences";
import { buildBuiltInCategories } from "../categories";
import { buildBuiltinViews, type SavedView } from "../views";

function state(overrides: Partial<ProfileSettingsState> = {}): ProfileSettingsState {
  return {
    theme: "dark",
    preferences: { ...defaultPreferences },
    views: buildBuiltinViews(),
    categories: buildBuiltInCategories(),
    ...overrides,
  };
}

const ts = "2026-05-14T00:00:00.000Z";

describe("exportProfile", () => {
  it("includes user views but strips built-ins", () => {
    const userView: SavedView = {
      id: "user-1",
      name: "My view",
      scope: "subscriptions",
      filter: {},
      sort: { by: "name", dir: "asc" },
      createdAt: ts,
      updatedAt: ts,
    };
    const profile = exportProfile(state({ views: [...buildBuiltinViews(), userView] }), {
      appVersion: "4.0.0",
      now: new Date(ts),
    });
    expect(profile.views?.length).toBe(1);
    expect(profile.views?.[0].id).toBe("user-1");
  });

  it("emits schemaVersion 1", () => {
    const profile = exportProfile(state(), { appVersion: "4.0.0" });
    expect(profile.schemaVersion).toBe(PROFILE_SCHEMA_VERSION);
  });
});

describe("validateProfile", () => {
  it("rejects non-objects", () => {
    expect(validateProfile(null).ok).toBe(false);
    expect(validateProfile("x").ok).toBe(false);
  });

  it("rejects wrong schema version", () => {
    const result = validateProfile({ schemaVersion: 99, exportedAt: ts });
    expect(result.ok).toBe(false);
  });

  it("rejects missing exportedAt", () => {
    const result = validateProfile({ schemaVersion: 1 });
    expect(result.ok).toBe(false);
  });

  it("rejects negative fx overrides", () => {
    const result = validateProfile({
      schemaVersion: 1,
      exportedAt: ts,
      preferences: { fxOverrides: { EUR: -1 } },
    });
    expect(result.ok).toBe(false);
  });

  it("accepts a minimal profile", () => {
    const result = validateProfile({ schemaVersion: 1, exportedAt: ts });
    expect(result.ok).toBe(true);
  });
});

describe("applyProfile", () => {
  it("merge keeps existing where the profile is silent", () => {
    const start = state({ theme: "light" });
    const profile = exportProfile(state({ theme: "dark" }), { appVersion: "4.0.0" });
    profile.theme = "system"; // means "don't change theme on merge"
    const merged = applyProfile(start, profile, { strategy: "merge" });
    expect(merged.theme).toBe("light");
  });

  it("merge unions user views by id", () => {
    const userView: SavedView = {
      id: "user-1",
      name: "My view",
      scope: "subscriptions",
      filter: {},
      sort: { by: "name", dir: "asc" },
      createdAt: ts,
      updatedAt: ts,
    };
    const profile = exportProfile(state({ views: [...buildBuiltinViews(), userView] }), {
      appVersion: "4.0.0",
    });
    const merged = applyProfile(state(), profile, { strategy: "merge" });
    expect(merged.views.find((v) => v.id === "user-1")).toBeDefined();
  });

  it("replace overwrites preferences wholesale", () => {
    const profile = exportProfile(
      state({ preferences: { ...defaultPreferences, baseCurrency: "EUR" } }),
      { appVersion: "4.0.0" },
    );
    const result = applyProfile(state(), profile, { strategy: "replace" });
    expect(result.preferences.baseCurrency).toBe("EUR");
  });

  it("never modifies subscriptions/trials (settings-only)", () => {
    // The function signature guarantees this by construction — we just sanity-check by
    // verifying that the output keys are the same as the input keys.
    const start = state();
    const profile = exportProfile(state({ theme: "light" }), { appVersion: "4.0.0" });
    const result = applyProfile(start, profile, { strategy: "merge" });
    expect(Object.keys(result).sort()).toEqual(Object.keys(start).sort());
  });
});

describe("previewProfile", () => {
  it("returns a non-empty diff when the theme changes", () => {
    const start = state({ theme: "dark" });
    const profile = exportProfile(state({ theme: "light" }), { appVersion: "4.0.0" });
    const diff = previewProfile(start, profile);
    expect(diff.some((row) => row.field === "Theme")).toBe(true);
  });

  it("returns empty when there's nothing to change", () => {
    const start = state();
    const profile = exportProfile(start, { appVersion: "4.0.0" });
    expect(previewProfile(start, profile)).toEqual([]);
  });
});
