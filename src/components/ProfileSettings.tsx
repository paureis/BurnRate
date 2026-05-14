"use client";

import { useRef, useState } from "react";
import { Download, Upload, FileJson } from "lucide-react";
import {
  applyProfile,
  exportProfile,
  previewProfile,
  validateProfile,
  type ApplyStrategy,
  type BurnRateProfile,
  type ProfileSettingsState,
} from "@/lib/profile";

interface ProfileSettingsProps {
  state: ProfileSettingsState;
  appVersion: string;
  onApply: (next: ProfileSettingsState) => void;
}

export function ProfileSettings({ state, appVersion, onApply }: ProfileSettingsProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [pendingProfile, setPendingProfile] = useState<BurnRateProfile | null>(null);
  const [strategy, setStrategy] = useState<ApplyStrategy>("merge");
  const [error, setError] = useState<string | null>(null);

  async function handleExport() {
    const profile = exportProfile(state, { appVersion });
    const blob = new Blob([JSON.stringify(profile, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    const date = new Date().toISOString().slice(0, 10);
    link.download = `burnrate-profile-${date}.burnprofile`;
    link.click();
    URL.revokeObjectURL(url);
  }

  async function handleImport(file: File | null) {
    setError(null);
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const result = validateProfile(parsed);
      if (!result.ok) {
        setError(result.reason);
        setPendingProfile(null);
      } else {
        setPendingProfile(result.profile);
      }
    } catch {
      setError("Could not read profile file.");
    } finally {
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  function applyPending() {
    if (!pendingProfile) return;
    onApply(applyProfile(state, pendingProfile, { strategy }));
    setPendingProfile(null);
  }

  const diff = pendingProfile ? previewProfile(state, pendingProfile) : [];

  return (
    <section className="panel p-5">
      <div className="mb-4 flex items-center gap-2">
        <FileJson aria-hidden="true" className="text-[color:var(--accent-2)]" size={20} />
        <h2 className="text-xl font-extrabold">Profile</h2>
      </div>
      <p className="mb-3 text-sm text-[color:var(--muted)]">
        Export your settings — theme, currency, FX overrides, saved views, and categories — as a portable
        <code className="mx-1 rounded bg-[color:var(--panel-strong)] px-1.5 py-0.5 text-xs">.burnprofile</code>
        file. Subscriptions, trials, ledger, and snapshots are never included.
      </p>
      <div className="flex flex-wrap gap-2">
        <button className="button-secondary" type="button" onClick={handleExport}>
          <Download aria-hidden="true" size={17} />
          Export profile
        </button>
        <label className="button-secondary cursor-pointer">
          <Upload aria-hidden="true" size={17} />
          Import profile
          <input
            ref={inputRef}
            type="file"
            accept=".burnprofile,application/json"
            className="sr-only"
            onChange={(event) => void handleImport(event.target.files?.[0] ?? null)}
          />
        </label>
      </div>

      {error && <p className="mt-3 text-sm font-bold text-[color:var(--accent)]">{error}</p>}

      {pendingProfile && (
        <div className="mt-4 rounded-panel border border-[color:var(--accent-2)] bg-[color:var(--panel-strong)] p-4">
          <h3 className="mb-3 text-base font-extrabold">Review changes</h3>
          {diff.length === 0 ? (
            <p className="text-sm text-[color:var(--muted)]">No changes to apply — the profile matches current settings.</p>
          ) : (
            <ul className="grid gap-1 text-sm">
              {diff.map((row) => (
                <li key={row.field}>
                  <span className="font-extrabold">{row.field}:</span>{" "}
                  <span className="text-[color:var(--muted)]">{row.from}</span>{" "}
                  <span aria-hidden="true">→</span>{" "}
                  <span>{row.to}</span>
                </li>
              ))}
            </ul>
          )}
          <fieldset className="mt-4 flex flex-wrap gap-3 text-sm">
            <legend className="sr-only">Apply strategy</legend>
            <label className="flex items-center gap-2">
              <input
                type="radio"
                name="strategy"
                value="merge"
                checked={strategy === "merge"}
                onChange={() => setStrategy("merge")}
              />
              Merge (keep existing where the profile is silent)
            </label>
            <label className="flex items-center gap-2">
              <input
                type="radio"
                name="strategy"
                value="replace"
                checked={strategy === "replace"}
                onChange={() => setStrategy("replace")}
              />
              Replace (overwrite settings wholesale)
            </label>
          </fieldset>
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" className="button-primary" onClick={applyPending}>
              Apply
            </button>
            <button type="button" className="button-ghost" onClick={() => setPendingProfile(null)}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
