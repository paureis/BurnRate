"use client";

import { useState } from "react";
import { ShieldAlert } from "lucide-react";
import { disableDecoy, enableDecoy, type VaultMetaWithDecoy } from "@/lib/decoy";

interface DecoySetupProps {
  vaultMeta: VaultMetaWithDecoy;
  onChange: (next: VaultMetaWithDecoy) => void;
}

export function DecoySetup({ vaultMeta, onChange }: DecoySetupProps) {
  const [realPass, setRealPass] = useState("");
  const [decoyPass, setDecoyPass] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!vaultMeta.enabled) {
    return (
      <section className="panel p-5">
        <div className="mb-2 flex items-center gap-2">
          <ShieldAlert aria-hidden="true" className="text-[color:var(--muted)]" size={20} />
          <h2 className="text-xl font-extrabold">Decoy mode</h2>
        </div>
        <p className="text-xs text-[color:var(--muted)]">
          Enable the passphrase lock first. Decoy mode adds a second passphrase that unlocks a separate sandbox of
          plausible-looking data.
        </p>
      </section>
    );
  }

  async function setup() {
    setError(null);
    if (decoyPass.length < 8) {
      setError("Pick a decoy passphrase of at least 8 characters.");
      return;
    }
    if (decoyPass !== confirm) {
      setError("Confirmation does not match.");
      return;
    }
    if (decoyPass === realPass) {
      setError("Decoy passphrase must differ from the real one.");
      return;
    }
    setBusy(true);
    try {
      const updated = await enableDecoy(vaultMeta, realPass, decoyPass);
      onChange(updated);
      setRealPass("");
      setDecoyPass("");
      setConfirm("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not enable decoy mode.");
    } finally {
      setBusy(false);
    }
  }

  function disable() {
    if (!window.confirm("Disable decoy mode? Any decoy slot data is forgotten.")) return;
    onChange(disableDecoy(vaultMeta));
  }

  const enabled = vaultMeta.decoy?.enabled === true;

  return (
    <section className="panel p-5">
      <div className="mb-2 flex items-center gap-2">
        <ShieldAlert aria-hidden="true" className="text-[color:var(--accent-2)]" size={20} />
        <h2 className="text-xl font-extrabold">Decoy mode</h2>
      </div>
      <p className="mb-3 text-xs text-[color:var(--muted)]">
        Set a second passphrase that unlocks a separate sandbox of plausible-looking data. There is no visible
        difference between real and decoy unlock — the UI looks identical, only the data slot changes.
      </p>

      {!enabled ? (
        <div className="grid gap-3">
          <label className="label text-xs">
            Current (real) passphrase
            <input
              type="password"
              className="input"
              value={realPass}
              onChange={(event) => setRealPass(event.target.value)}
              autoComplete="current-password"
            />
          </label>
          <label className="label text-xs">
            Decoy passphrase
            <input
              type="password"
              className="input"
              value={decoyPass}
              onChange={(event) => setDecoyPass(event.target.value)}
              autoComplete="new-password"
            />
          </label>
          <label className="label text-xs">
            Confirm decoy passphrase
            <input
              type="password"
              className="input"
              value={confirm}
              onChange={(event) => setConfirm(event.target.value)}
              autoComplete="new-password"
            />
          </label>
          <button
            type="button"
            className="button-secondary justify-start"
            disabled={busy}
            onClick={() => void setup()}
          >
            Enable decoy mode
          </button>
          {error && <p className="text-xs font-bold text-[color:var(--danger,red)]">{error}</p>}
        </div>
      ) : (
        <div className="grid gap-3">
          <p className="text-xs font-bold text-[color:var(--accent-2)]">
            Decoy mode is active. The lock screen accepts either passphrase.
          </p>
          <button type="button" className="button-secondary justify-start" onClick={disable}>
            Disable decoy mode
          </button>
        </div>
      )}

      <p className="mt-4 rounded-panel border border-[color:var(--line)] bg-[color:var(--panel-strong)] p-2 text-xs text-[color:var(--muted)]">
        Note: full slot-routed storage (real-vs-decoy localStorage namespacing) requires the v6 multi-vault migration
        which is not yet applied to this install. Until then, the decoy passphrase is verified by the library but the
        UI still surfaces your real data on unlock. Treat this as a configuration preview.
      </p>
    </section>
  );
}
