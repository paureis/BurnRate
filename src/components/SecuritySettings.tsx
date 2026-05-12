"use client";

import { ShieldCheck, ShieldOff } from "lucide-react";
import { useState } from "react";
import type { BurnRatePreferences } from "@/lib/preferences";

export interface VaultControls {
  enabled: boolean;
  onEnable: (passphrase: string) => Promise<void>;
  onDisableWithPassphrase: (passphrase: string) => Promise<void>;
  onWipe: () => void;
}

export function SecuritySettings({
  controls,
  onPreferencesChange,
  preferences,
}: {
  controls: VaultControls;
  onPreferencesChange: (next: BurnRatePreferences) => void;
  preferences: BurnRatePreferences;
}) {
  const [pass, setPass] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleEnable() {
    setError(null);
    if (pass.length < 8) {
      setError("Pick a passphrase of at least 8 characters.");
      return;
    }
    if (pass !== confirm) {
      setError("The two passphrase entries don't match.");
      return;
    }
    setBusy(true);
    try {
      await controls.onEnable(pass);
      setPass("");
      setConfirm("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not enable lock.");
    } finally {
      setBusy(false);
    }
  }

  async function handleDisable() {
    setError(null);
    setBusy(true);
    try {
      await controls.onDisableWithPassphrase(pass);
      setPass("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not disable lock.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-3">
      <div className="flex items-center gap-2">
        {controls.enabled ? (
          <ShieldCheck aria-hidden="true" className="text-[color:var(--accent)]" size={18} />
        ) : (
          <ShieldOff aria-hidden="true" className="text-[color:var(--muted)]" size={18} />
        )}
        <h3 className="text-base font-extrabold">Security</h3>
      </div>

      {!controls.enabled && (
        <>
          <p className="text-xs text-[color:var(--subtle)]">
            Encrypt your local data with a passphrase. Sync and share links remain cleartext.
          </p>
          <label className="label">
            Passphrase
            <input
              className="input"
              type="password"
              value={pass}
              onChange={(event) => setPass(event.target.value)}
              autoComplete="new-password"
            />
          </label>
          <label className="label">
            Confirm passphrase
            <input
              className="input"
              type="password"
              value={confirm}
              onChange={(event) => setConfirm(event.target.value)}
              autoComplete="new-password"
            />
          </label>
          <button className="button-secondary justify-start" type="button" disabled={busy} onClick={handleEnable}>
            Enable passphrase lock
          </button>
        </>
      )}

      {controls.enabled && (
        <>
          <p className="text-xs text-[color:var(--accent-2)]">
            Lock is enabled. Sync and share links still carry cleartext — warnings shown when you generate them.
          </p>
          <label className="label">
            Current passphrase (to disable)
            <input
              className="input"
              type="password"
              value={pass}
              onChange={(event) => setPass(event.target.value)}
              autoComplete="current-password"
            />
          </label>
          <button className="button-secondary justify-start" type="button" disabled={busy || pass.length === 0} onClick={handleDisable}>
            Disable lock
          </button>
          <button
            className="button-secondary justify-start text-[color:var(--danger)]"
            type="button"
            onClick={() => {
              if (window.confirm("This wipes ALL local data and disables the lock. Continue?")) {
                controls.onWipe();
              }
            }}
          >
            Forgot passphrase — wipe and disable
          </button>

          <label className="label">
            Auto-lock after (minutes idle)
            <select
              className="input"
              value={preferences.autoLockMinutes}
              onChange={(event) =>
                onPreferencesChange({
                  ...preferences,
                  autoLockMinutes: Number.parseInt(event.target.value, 10),
                })
              }
            >
              <option value="0">Never</option>
              <option value="5">5</option>
              <option value="15">15</option>
              <option value="60">60</option>
            </select>
          </label>
        </>
      )}

      {error && <p className="text-xs font-bold text-[color:var(--danger)]">{error}</p>}
    </div>
  );
}
