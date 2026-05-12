"use client";

import { Coins, RotateCcw } from "lucide-react";
import { useMemo, useState } from "react";
import { supportedCurrencies, FX_SNAPSHOT_DATE, bundledFxRates } from "@/data/fx-rates";
import type { BurnRatePreferences } from "@/lib/preferences";
import type { Subscription, Trial } from "@/lib/burnrate";

export function CurrencySettings({
  onChange,
  preferences,
  subscriptions,
  trials,
}: {
  onChange: (next: BurnRatePreferences) => void;
  preferences: BurnRatePreferences;
  subscriptions: Subscription[];
  trials: Trial[];
}) {
  const usedCurrencies = useMemo(() => {
    const set = new Set<string>([preferences.baseCurrency]);
    for (const sub of subscriptions) if (sub.currency) set.add(sub.currency);
    for (const trial of trials) if (trial.currency) set.add(trial.currency);
    return [...set].sort();
  }, [preferences.baseCurrency, subscriptions, trials]);

  const [addCode, setAddCode] = useState<string>(() => supportedCurrencies.find((code) => !usedCurrencies.includes(code)) ?? "EUR");

  function updateOverride(code: string, value: string) {
    const numeric = Number.parseFloat(value);
    if (!Number.isFinite(numeric) || numeric <= 0) {
      const next = { ...preferences.fxOverrides };
      delete next[code];
      onChange({ ...preferences, fxOverrides: next, lastFxOverrideAt: new Date().toISOString() });
      return;
    }
    onChange({
      ...preferences,
      fxOverrides: { ...preferences.fxOverrides, [code]: numeric },
      lastFxOverrideAt: new Date().toISOString(),
    });
  }

  function resetOverrides() {
    onChange({ ...preferences, fxOverrides: {}, lastFxOverrideAt: null });
  }

  function addOverride() {
    if (!addCode) return;
    if (preferences.fxOverrides[addCode] !== undefined) return;
    onChange({
      ...preferences,
      fxOverrides: { ...preferences.fxOverrides, [addCode]: bundledFxRates[addCode] ?? 1 },
      lastFxOverrideAt: new Date().toISOString(),
    });
  }

  const visibleCodes = useMemo(() => {
    const set = new Set<string>(usedCurrencies);
    for (const code of Object.keys(preferences.fxOverrides)) set.add(code);
    return [...set].filter((code) => code !== "USD").sort();
  }, [preferences.fxOverrides, usedCurrencies]);

  return (
    <div className="grid gap-3">
      <div className="flex items-center gap-2">
        <Coins aria-hidden="true" className="text-[color:var(--accent)]" size={18} />
        <h3 className="text-base font-extrabold">Currency</h3>
      </div>
      <label className="label">
        Base currency
        <select
          className="input"
          value={preferences.baseCurrency}
          onChange={(event) => onChange({ ...preferences, baseCurrency: event.target.value })}
        >
          {supportedCurrencies.map((code) => (
            <option key={code} value={code}>
              {code}
            </option>
          ))}
        </select>
      </label>
      <p className="text-xs text-[color:var(--subtle)]">
        Bundled FX rates snapshot: {FX_SNAPSHOT_DATE}. Override any rate below if it&apos;s drifted.
      </p>

      {visibleCodes.length > 0 && (
        <div className="grid gap-2">
          <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-[color:var(--muted)]">FX overrides</p>
          {visibleCodes.map((code) => {
            const effective = preferences.fxOverrides[code] ?? bundledFxRates[code] ?? 1;
            const isOverridden = preferences.fxOverrides[code] !== undefined;
            return (
              <div key={code} className="flex items-center gap-2">
                <span className="w-12 text-xs font-extrabold">{code}</span>
                <input
                  className="input"
                  inputMode="decimal"
                  value={String(effective)}
                  onChange={(event) => updateOverride(code, event.target.value)}
                  aria-label={`${code} units per 1 USD`}
                />
                {isOverridden && <span className="text-xs font-bold text-[color:var(--accent-2)]">override</span>}
              </div>
            );
          })}
          <button className="button-ghost text-xs justify-start" type="button" onClick={resetOverrides}>
            <RotateCcw aria-hidden="true" size={14} />
            Reset to bundled rates
          </button>
        </div>
      )}

      <div className="flex items-end gap-2">
        <label className="label">
          Add currency
          <select className="input" value={addCode} onChange={(event) => setAddCode(event.target.value)}>
            {supportedCurrencies
              .filter((code) => code !== "USD")
              .map((code) => (
                <option key={code} value={code}>
                  {code}
                </option>
              ))}
          </select>
        </label>
        <button className="button-secondary" type="button" onClick={addOverride}>
          Add override
        </button>
      </div>
    </div>
  );
}
