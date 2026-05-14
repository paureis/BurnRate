import { describe, expect, it } from "vitest";
import {
  DEFAULT_VAULT_ID,
  addVault,
  defaultVaultRegistry,
  namespacedKey,
  normalizeRegistry,
  planV5toV6Migration,
  removeVault,
  renameVault,
  setActiveVault,
} from "../vault-registry";

describe("namespacedKey", () => {
  it("composes the expected prefix", () => {
    expect(namespacedKey("default", "real", "subscriptions.v1")).toBe(
      "burnrate.vault.default.real.subscriptions.v1",
    );
    expect(namespacedKey("work", "decoy", "preferences.v1")).toBe(
      "burnrate.vault.work.decoy.preferences.v1",
    );
  });

  it("rejects malformed vault ids", () => {
    expect(() => namespacedKey("Has Space", "real", "k")).toThrow();
  });
});

describe("planV5toV6Migration", () => {
  it("renames every burnrate.* key into vault.default.real.*", () => {
    const keys = [
      "burnrate.subscriptions.v1",
      "burnrate.trials.v1",
      "burnrate.preferences.v1",
      "unrelated.key",
    ];
    const plan = planV5toV6Migration(keys);
    expect(plan).toEqual([
      { from: "burnrate.subscriptions.v1", to: "burnrate.vault.default.real.subscriptions.v1" },
      { from: "burnrate.trials.v1", to: "burnrate.vault.default.real.trials.v1" },
      { from: "burnrate.preferences.v1", to: "burnrate.vault.default.real.preferences.v1" },
    ]);
  });

  it("does not remap vault meta or registry keys", () => {
    const keys = ["burnrate.vault.v1", "burnrate.vault-registry.v1", "burnrate.vault.default.real.X"];
    expect(planV5toV6Migration(keys)).toEqual([]);
  });
});

describe("normalizeRegistry", () => {
  it("seeds the default registry when storage is empty", () => {
    expect(normalizeRegistry(undefined).items[0].id).toBe(DEFAULT_VAULT_ID);
  });

  it("preserves stored entries and dedupes by id", () => {
    const stored = {
      items: [
        { id: "default", label: "Personal", color: "#ff5a3d", createdAt: "2026-01-01", isLocked: false },
        { id: "default", label: "Dup", color: "#ff5a3d", createdAt: "2026-01-02", isLocked: false },
        { id: "work", label: "Work", color: "#7cc7ff", createdAt: "2026-01-01", isLocked: true },
      ],
      activeVaultId: "work",
    };
    const result = normalizeRegistry(stored);
    expect(result.items.length).toBe(2);
    expect(result.activeVaultId).toBe("work");
  });

  it("falls back to the first entry if activeVaultId is unknown", () => {
    const stored = {
      items: [{ id: "personal", label: "Personal", color: "#ff5a3d", createdAt: "", isLocked: false }],
      activeVaultId: "gone",
    };
    expect(normalizeRegistry(stored).activeVaultId).toBe("personal");
  });
});

describe("addVault / removeVault / setActiveVault / renameVault", () => {
  it("adds a vault and keeps it in the list", () => {
    const start = defaultVaultRegistry();
    const { next, created } = addVault(start, { label: "Work", color: "#7cc7ff" });
    expect(next.items.find((entry) => entry.id === created.id)).toBeDefined();
  });

  it("removeVault refuses to delete the default vault", () => {
    const start = defaultVaultRegistry();
    expect(removeVault(start, DEFAULT_VAULT_ID)).toBe(start);
  });

  it("removeVault on the active vault picks a new active", () => {
    const { next } = addVault(defaultVaultRegistry(), { label: "Work" });
    const active = setActiveVault(next, next.items[1].id);
    const removed = removeVault(active, next.items[1].id);
    expect(removed.activeVaultId).toBe(DEFAULT_VAULT_ID);
  });

  it("setActiveVault stamps lastUsedAt", () => {
    const start = defaultVaultRegistry();
    const next = setActiveVault(start, DEFAULT_VAULT_ID, new Date("2026-05-14T10:00:00.000Z"));
    expect(next.items[0].lastUsedAt).toBe("2026-05-14T10:00:00.000Z");
  });

  it("renameVault changes the label only", () => {
    const start = defaultVaultRegistry();
    const renamed = renameVault(start, DEFAULT_VAULT_ID, "My Vault");
    expect(renamed.items[0].label).toBe("My Vault");
    expect(renamed.items[0].id).toBe(DEFAULT_VAULT_ID);
  });
});
