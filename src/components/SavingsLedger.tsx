"use client";

import { PiggyBank, Trash2, Undo2 } from "lucide-react";
import {
  earliestCancelledOn,
  isUndoEligible,
  totalSavedMonthlyCents,
  totalSavedYearlyCents,
  type CancellationRecord,
} from "@/lib/ledger";
import { convertCents, formatMoney, type FxContext } from "@/lib/currency";

export function SavingsLedger({
  fx,
  onDelete,
  onUndo,
  records,
}: {
  fx: FxContext;
  onDelete: (id: string) => void;
  onUndo: (record: CancellationRecord) => void;
  records: CancellationRecord[];
}) {
  if (records.length === 0) return null;

  const totalMonthly = totalSavedMonthlyCents(records);
  const totalYearly = totalSavedYearlyCents(records);
  const since = earliestCancelledOn(records);

  return (
    <section className="panel p-5" aria-label="Savings ledger">
      <div className="mb-3 flex items-center gap-2">
        <PiggyBank aria-hidden="true" className="text-[color:var(--accent)]" size={20} />
        <h2 className="text-xl font-extrabold">Saved since {since}</h2>
      </div>
      <div className="grid gap-2 md:grid-cols-2">
        <div className="rounded-panel border border-[color:var(--line)] bg-[color:var(--panel-strong)] p-3">
          <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-[color:var(--muted)]">Monthly</p>
          <p className="mt-1 text-2xl font-extrabold">{formatMoney(totalMonthly, fx.baseCurrency)}</p>
        </div>
        <div className="rounded-panel border border-[color:var(--line)] bg-[color:var(--panel-strong)] p-3">
          <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-[color:var(--muted)]">Annualized</p>
          <p className="mt-1 text-2xl font-extrabold">{formatMoney(totalYearly, fx.baseCurrency)}</p>
        </div>
      </div>
      <details className="mt-3">
        <summary className="cursor-pointer text-sm font-bold text-[color:var(--accent-2)]">
          See all ({records.length})
        </summary>
        <ul className="mt-2 grid gap-2">
          {records.map((record) => {
            const base = convertCents(record.monthlyCostCents, record.currency, fx.baseCurrency, fx.rates);
            const canUndo = isUndoEligible(record);
            return (
              <li
                key={record.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-panel border border-[color:var(--line)] bg-[color:var(--panel-strong)] p-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-extrabold">{record.subscriptionName}</p>
                  <p className="text-xs text-[color:var(--muted)]">
                    Cancelled {record.cancelledOn} · {formatMoney(base, fx.baseCurrency)}/mo
                    {record.auto ? " · auto" : " · manual"}
                  </p>
                  {record.note && <p className="text-xs text-[color:var(--subtle)]">{record.note}</p>}
                </div>
                <div className="flex items-center gap-1">
                  {canUndo && (
                    <button
                      className="icon-button"
                      type="button"
                      aria-label={`Undo cancellation of ${record.subscriptionName}`}
                      onClick={() => onUndo(record)}
                    >
                      <Undo2 aria-hidden="true" size={15} />
                    </button>
                  )}
                  <button
                    className="icon-button"
                    type="button"
                    aria-label={`Remove ${record.subscriptionName} from the ledger`}
                    onClick={() => onDelete(record.id)}
                  >
                    <Trash2 aria-hidden="true" size={15} />
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      </details>
    </section>
  );
}
