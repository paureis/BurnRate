"use client";

import { useState } from "react";
import { Layers, Plus, Trash2, Pencil, ChevronRight } from "lucide-react";
import {
  DEFAULT_VAULT_ID,
  addVault,
  defaultVaultRegistry,
  removeVault,
  renameVault,
  setActiveVault,
  type VaultRegistry,
} from "@/lib/vault-registry";

interface VaultManagerProps {
  registry: VaultRegistry;
  onChange: (next: VaultRegistry) => void;
}

const COLORS = ["#ff5a3d", "#37f29b", "#ffd166", "#b388ff", "#7cc7ff", "#f970a8"];

export function VaultManager({ registry, onChange }: VaultManagerProps) {
  const [adding, setAdding] = useState(false);
  const [draftLabel, setDraftLabel] = useState("");
  const [draftColor, setDraftColor] = useState(COLORS[3]);
  const [editingId, setEditingId] = useState<string | null>(null);

  function addNew() {
    if (!draftLabel.trim()) return;
    const { next } = addVault(registry, { label: draftLabel.trim(), color: draftColor });
    onChange(next);
    setAdding(false);
    setDraftLabel("");
    setDraftColor(COLORS[3]);
  }

  function remove(id: string) {
    if (!window.confirm("Delete this vault? Its data is forgotten on this device.")) return;
    onChange(removeVault(registry, id));
  }

  function rename(id: string, label: string) {
    if (!label.trim()) return;
    onChange(renameVault(registry, id, label.trim()));
    setEditingId(null);
  }

  function switchVault(id: string) {
    onChange(setActiveVault(registry, id));
  }

  function reset() {
    if (!window.confirm("Reset the vault registry? Only the default vault is preserved.")) return;
    onChange(defaultVaultRegistry());
  }

  return (
    <section className="panel p-5">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Layers aria-hidden="true" className="text-[color:var(--accent-2)]" size={20} />
          <h2 className="text-xl font-extrabold">Vaults</h2>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" className="button-ghost text-xs" onClick={reset}>
            Reset
          </button>
          <button type="button" className="button-secondary text-xs" onClick={() => setAdding(true)}>
            <Plus aria-hidden="true" size={13} />
            New vault
          </button>
        </div>
      </div>
      <p className="mb-3 text-xs text-[color:var(--muted)]">
        Multiple vaults let one BurnRate install host independent data sets (personal, work, household). Active vault is
        the one whose data is currently shown.
      </p>

      <ul className="grid gap-2">
        {registry.items.map((entry) => {
          const isActive = entry.id === registry.activeVaultId;
          return (
            <li
              key={entry.id}
              className="flex items-center gap-3 rounded-panel border border-[color:var(--line)] bg-[color:var(--panel-strong)] p-3"
            >
              <span
                className="grid h-7 w-7 place-items-center rounded-full text-xs font-extrabold"
                style={{ background: entry.color, color: "#140b08" }}
              >
                {entry.label.slice(0, 2).toUpperCase()}
              </span>
              {editingId === entry.id ? (
                <form
                  className="flex flex-1 items-center gap-2"
                  onSubmit={(event) => {
                    event.preventDefault();
                    const value = (event.currentTarget.elements.namedItem("vault-label") as HTMLInputElement).value;
                    rename(entry.id, value);
                  }}
                >
                  <input
                    name="vault-label"
                    defaultValue={entry.label}
                    className="input flex-1"
                    autoFocus
                  />
                  <button type="submit" className="button-primary text-xs">
                    Save
                  </button>
                  <button type="button" className="text-xs text-[color:var(--muted)]" onClick={() => setEditingId(null)}>
                    Cancel
                  </button>
                </form>
              ) : (
                <>
                  <div className="min-w-0 flex-1">
                    <p className="font-extrabold">
                      {entry.label}
                      {isActive && (
                        <span className="ml-2 rounded-full bg-[color:var(--accent)] px-2 py-0.5 text-xs text-[#140b08]">
                          Active
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-[color:var(--muted)]">
                      {entry.id === DEFAULT_VAULT_ID ? "Default vault (protected)" : "User vault"} · created{" "}
                      {entry.createdAt.slice(0, 10)}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    {!isActive && (
                      <button
                        type="button"
                        className="icon-button"
                        aria-label={`Switch to ${entry.label}`}
                        onClick={() => switchVault(entry.id)}
                      >
                        <ChevronRight aria-hidden="true" size={14} />
                      </button>
                    )}
                    <button
                      type="button"
                      className="icon-button"
                      aria-label={`Rename ${entry.label}`}
                      onClick={() => setEditingId(entry.id)}
                    >
                      <Pencil aria-hidden="true" size={13} />
                    </button>
                    {entry.id !== DEFAULT_VAULT_ID && (
                      <button
                        type="button"
                        className="icon-button"
                        aria-label={`Delete ${entry.label}`}
                        onClick={() => remove(entry.id)}
                      >
                        <Trash2 aria-hidden="true" size={13} />
                      </button>
                    )}
                  </div>
                </>
              )}
            </li>
          );
        })}
        {adding && (
          <li className="rounded-panel border border-[color:var(--accent-2)] bg-[color:var(--panel-strong)] p-3">
            <form
              className="grid gap-2"
              onSubmit={(event) => {
                event.preventDefault();
                addNew();
              }}
            >
              <label className="label text-xs">
                Label
                <input
                  className="input"
                  value={draftLabel}
                  onChange={(event) => setDraftLabel(event.target.value)}
                  autoFocus
                />
              </label>
              <div className="flex flex-wrap items-center gap-1">
                {COLORS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    className="h-6 w-6 rounded-full border border-[color:var(--line)]"
                    style={{ background: color, outline: color === draftColor ? "2px solid var(--accent)" : undefined }}
                    aria-label={`Color ${color}`}
                    onClick={() => setDraftColor(color)}
                  />
                ))}
              </div>
              <div className="flex justify-end gap-2">
                <button type="button" className="button-ghost text-xs" onClick={() => setAdding(false)}>
                  Cancel
                </button>
                <button type="submit" className="button-primary text-xs">
                  Create
                </button>
              </div>
            </form>
          </li>
        )}
      </ul>

      <p className="mt-4 rounded-panel border border-[color:var(--line)] bg-[color:var(--panel-strong)] p-2 text-xs text-[color:var(--muted)]">
        Note: actual storage-key namespacing (so each vault has its own subs/trials/ledger) is the deferred runtime
        piece. Switching the active vault updates the registry; the data slice still maps to a single shared store
        until the v5→v6 migration is applied.
      </p>
    </section>
  );
}
