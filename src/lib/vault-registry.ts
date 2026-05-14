// v6 Feature 7: multi-vault registry. Lets one BurnRate install host
// multiple independent vaults (personal, work, household). Each vault
// namespaces its own storage keys.

export interface VaultRegistryEntry {
  id: string;
  label: string;
  color: string;
  createdAt: string;
  isLocked: boolean;
  lastUsedAt?: string;
}

export interface VaultRegistry {
  items: VaultRegistryEntry[];
  activeVaultId: string;
}

export const DEFAULT_VAULT_ID = "default";

export function defaultVaultRegistry(now: Date = new Date()): VaultRegistry {
  return {
    items: [
      {
        id: DEFAULT_VAULT_ID,
        label: "Personal",
        color: "#ff5a3d",
        createdAt: now.toISOString(),
        isLocked: false,
      },
    ],
    activeVaultId: DEFAULT_VAULT_ID,
  };
}

/**
 * Compose a namespaced storage key: `burnrate.vault.<vaultId>.<slot>.<key>`
 * where slot is `real` or `decoy` (v6 Feature 5).
 */
export function namespacedKey(
  vaultId: string,
  slot: "real" | "decoy",
  key: string,
): string {
  if (!/^[a-z0-9-]+$/.test(vaultId)) throw new Error(`Invalid vaultId: ${vaultId}`);
  return `burnrate.vault.${vaultId}.${slot}.${key}`;
}

/**
 * Pure migration helper: given a flat localStorage map (string -> string),
 * return the patches needed to namespace every `burnrate.<key>` into
 * `burnrate.vault.default.real.<key>`. Caller applies them.
 *
 * The vault registry key + auto-discovery keys (`burnrate.vault-registry.v1`,
 * `burnrate.vault.v1`) are NOT remapped — they live at the install level.
 */
export function planV5toV6Migration(allKeys: string[]): Array<{ from: string; to: string }> {
  const out: Array<{ from: string; to: string }> = [];
  for (const key of allKeys) {
    if (!key.startsWith("burnrate.")) continue;
    if (key === "burnrate.vault.v1") continue;
    if (key === "burnrate.vault-registry.v1") continue;
    if (key.startsWith("burnrate.vault.")) continue;
    const tail = key.slice("burnrate.".length);
    out.push({ from: key, to: `burnrate.vault.${DEFAULT_VAULT_ID}.real.${tail}` });
  }
  return out;
}

export function normalizeRegistry(stored: unknown): VaultRegistry {
  if (!stored || typeof stored !== "object") return defaultVaultRegistry();
  const r = stored as Record<string, unknown>;
  const items: VaultRegistryEntry[] = [];
  const seen = new Set<string>();
  if (Array.isArray(r.items)) {
    for (const raw of r.items) {
      const entry = sanitizeEntry(raw);
      if (!entry || seen.has(entry.id)) continue;
      seen.add(entry.id);
      items.push(entry);
    }
  }
  if (items.length === 0) return defaultVaultRegistry();
  const requestedActive = typeof r.activeVaultId === "string" ? r.activeVaultId : items[0].id;
  const activeVaultId = items.some((entry) => entry.id === requestedActive) ? requestedActive : items[0].id;
  return { items, activeVaultId };
}

function sanitizeEntry(raw: unknown): VaultRegistryEntry | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.id !== "string" || !/^[a-z0-9-]+$/.test(r.id)) return null;
  const label = typeof r.label === "string" && r.label.trim() ? r.label.trim() : r.id;
  const color =
    typeof r.color === "string" && /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(r.color) ? r.color : "#7cc7ff";
  const createdAt = typeof r.createdAt === "string" ? r.createdAt : new Date().toISOString();
  const isLocked = r.isLocked === true;
  const lastUsedAt = typeof r.lastUsedAt === "string" ? r.lastUsedAt : undefined;
  return { id: r.id, label, color, createdAt, isLocked, ...(lastUsedAt ? { lastUsedAt } : {}) };
}

export function addVault(
  registry: VaultRegistry,
  input: { label: string; color?: string },
): { next: VaultRegistry; created: VaultRegistryEntry } {
  const created: VaultRegistryEntry = {
    id: `vault-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
    label: input.label.trim() || "New vault",
    color: input.color ?? "#7cc7ff",
    createdAt: new Date().toISOString(),
    isLocked: false,
  };
  return { next: { ...registry, items: [...registry.items, created] }, created };
}

export function removeVault(registry: VaultRegistry, vaultId: string): VaultRegistry {
  if (vaultId === DEFAULT_VAULT_ID) {
    // Default vault is protected from deletion.
    return registry;
  }
  const items = registry.items.filter((entry) => entry.id !== vaultId);
  if (items.length === 0) return registry;
  const activeVaultId =
    registry.activeVaultId === vaultId ? items[0].id : registry.activeVaultId;
  return { items, activeVaultId };
}

export function setActiveVault(registry: VaultRegistry, vaultId: string, now: Date = new Date()): VaultRegistry {
  if (!registry.items.some((entry) => entry.id === vaultId)) return registry;
  return {
    items: registry.items.map((entry) =>
      entry.id === vaultId ? { ...entry, lastUsedAt: now.toISOString() } : entry,
    ),
    activeVaultId: vaultId,
  };
}

export function renameVault(registry: VaultRegistry, vaultId: string, label: string): VaultRegistry {
  return {
    ...registry,
    items: registry.items.map((entry) =>
      entry.id === vaultId ? { ...entry, label: label.trim() || entry.label } : entry,
    ),
  };
}
