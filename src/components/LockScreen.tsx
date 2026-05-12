"use client";

import { KeyRound, Lock } from "lucide-react";
import { useState } from "react";

export function LockScreen({
  attemptsRemaining,
  cooldownSeconds,
  onUnlock,
  recoveryHint,
}: {
  attemptsRemaining: number;
  cooldownSeconds: number;
  onUnlock: (passphrase: string) => void;
  recoveryHint?: string;
}) {
  const [passphrase, setPassphrase] = useState("");

  return (
    <div className="grid min-h-screen place-items-center bg-[color:var(--bg)] p-6">
      <form
        className="grid w-full max-w-md gap-4 rounded-panel border border-[color:var(--line)] bg-[color:var(--panel)] p-6 shadow-2xl"
        onSubmit={(event) => {
          event.preventDefault();
          if (cooldownSeconds > 0) return;
          onUnlock(passphrase);
        }}
      >
        <div className="flex items-center gap-3">
          <div className="grid h-12 w-12 place-items-center rounded-panel bg-[color:var(--panel-strong)] text-[color:var(--accent)]">
            <Lock aria-hidden="true" size={26} />
          </div>
          <div>
            <h2 className="text-xl font-extrabold">Locked</h2>
            <p className="text-sm text-[color:var(--muted)]">
              Enter your passphrase to unlock BurnRate.
            </p>
          </div>
        </div>
        <label className="label">
          Passphrase
          <input
            autoFocus
            className="input"
            type="password"
            value={passphrase}
            onChange={(event) => setPassphrase(event.target.value)}
            autoComplete="off"
          />
        </label>
        {cooldownSeconds > 0 ? (
          <p className="text-xs font-bold text-[color:var(--danger)]">
            Too many attempts. Try again in {cooldownSeconds} second{cooldownSeconds === 1 ? "" : "s"}.
          </p>
        ) : (
          <p className="text-xs text-[color:var(--subtle)]">
            {attemptsRemaining < 5 && attemptsRemaining > 0
              ? `${attemptsRemaining} attempt${attemptsRemaining === 1 ? "" : "s"} before cool-down.`
              : "There is no passphrase recovery — forgetting it wipes your data on this device."}
          </p>
        )}
        <button className="button-primary" type="submit" disabled={cooldownSeconds > 0 || passphrase.length === 0}>
          <KeyRound aria-hidden="true" size={17} />
          Unlock
        </button>
        {recoveryHint && (
          <p className="text-xs text-[color:var(--subtle)]">{recoveryHint}</p>
        )}
      </form>
    </div>
  );
}
