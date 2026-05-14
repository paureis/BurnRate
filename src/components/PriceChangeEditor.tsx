"use client";

import { useState } from "react";
import { CalendarPlus, Trash2 } from "lucide-react";
import { buildPriceChange, validatePriceChange } from "@/lib/price-changes";
import { formatMoney } from "@/lib/currency";
import { toCents, type PlannedPriceChange } from "@/lib/burnrate";

interface PriceChangeEditorProps {
  changes: PlannedPriceChange[];
  currency: string;
  onChange: (next: PlannedPriceChange[]) => void;
  now?: Date;
}

export function PriceChangeEditor({ changes, currency, onChange, now = new Date() }: PriceChangeEditorProps) {
  const [draftDate, setDraftDate] = useState("");
  const [draftCost, setDraftCost] = useState("");
  const [draftNote, setDraftNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  function commit() {
    setError(null);
    const newCostCents = toCents(draftCost);
    const result = validatePriceChange({ effectiveDate: draftDate, newCostCents }, now);
    if (!result.ok) {
      setError(result.reason);
      return;
    }
    const built = buildPriceChange({
      effectiveDate: draftDate,
      newCostCents,
      ...(draftNote.trim() ? { note: draftNote.trim() } : {}),
    });
    onChange([...changes, built]);
    setDraftDate("");
    setDraftCost("");
    setDraftNote("");
  }

  return (
    <div className="rounded-panel border border-[color:var(--line)] bg-[color:var(--panel-strong)] p-3">
      <div className="mb-2 flex items-center gap-2">
        <CalendarPlus aria-hidden="true" size={16} className="text-[color:var(--accent-2)]" />
        <h3 className="text-sm font-extrabold uppercase tracking-wider text-[color:var(--accent-2)]">
          Planned price changes
        </h3>
      </div>
      {changes.length === 0 ? (
        <p className="mb-3 text-xs text-[color:var(--muted)]">No price changes queued.</p>
      ) : (
        <ul className="mb-3 grid gap-1 text-sm">
          {changes.map((change) => (
            <li
              key={change.id}
              className="flex items-center justify-between gap-2 rounded-panel border border-[color:var(--line)] bg-[color:var(--panel)] px-3 py-2"
            >
              <div>
                <p className="font-extrabold">
                  {change.effectiveDate}: {formatMoney(change.newCostCents, currency)}
                </p>
                {change.note && <p className="text-xs text-[color:var(--muted)]">{change.note}</p>}
              </div>
              <button
                type="button"
                className="icon-button"
                aria-label="Remove price change"
                onClick={() => onChange(changes.filter((c) => c.id !== change.id))}
              >
                <Trash2 aria-hidden="true" size={13} />
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="grid gap-2 md:grid-cols-[1fr_1fr_2fr_auto]">
        <label className="label text-xs">
          Effective
          <input
            type="date"
            className="input"
            value={draftDate}
            onChange={(event) => setDraftDate(event.target.value)}
          />
        </label>
        <label className="label text-xs">
          New cost
          <input
            type="text"
            inputMode="decimal"
            className="input"
            value={draftCost}
            onChange={(event) => setDraftCost(event.target.value)}
            placeholder="17.99"
          />
        </label>
        <label className="label text-xs">
          Note (optional)
          <input
            type="text"
            className="input"
            value={draftNote}
            onChange={(event) => setDraftNote(event.target.value)}
            placeholder="Announced increase"
          />
        </label>
        <div className="flex items-end">
          <button type="button" className="button-secondary text-xs" onClick={commit}>
            Add
          </button>
        </div>
      </div>
      {error && <p className="mt-2 text-xs font-bold text-[color:var(--accent)]">{error}</p>}
    </div>
  );
}
