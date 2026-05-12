"use client";

import { CalendarClock, RotateCcw } from "lucide-react";
import { monthlyCostInBaseCents, type Subscription } from "@/lib/burnrate";
import { formatMoney, type FxContext } from "@/lib/currency";

export function PendingCancellations({
  fx,
  onUndo,
  subscriptions,
}: {
  fx: FxContext;
  onUndo: (id: string) => void;
  subscriptions: Subscription[];
}) {
  const pending = subscriptions.filter((sub) => sub.cancellingOn);
  if (pending.length === 0) return null;

  const savingsMonthly = pending.reduce((sum, sub) => sum + monthlyCostInBaseCents(sub, fx), 0);
  const earliest = pending.reduce((min, sub) => (sub.cancellingOn! < min ? sub.cancellingOn! : min), pending[0].cancellingOn!);

  return (
    <section className="panel p-5" aria-label="Pending cancellations">
      <div className="mb-3 flex items-center gap-2">
        <CalendarClock aria-hidden="true" className="text-[color:var(--accent-2)]" size={20} />
        <h2 className="text-xl font-extrabold">Pending cancellations</h2>
      </div>
      <p className="text-sm text-[color:var(--muted)]">
        You&apos;ll save {formatMoney(savingsMonthly, fx.baseCurrency)}/mo starting {earliest}.
      </p>
      <ul className="mt-3 grid gap-2">
        {pending.map((sub) => (
          <li
            key={sub.id}
            className="flex flex-wrap items-center justify-between gap-2 rounded-panel border border-[color:var(--line)] bg-[color:var(--panel-strong)] p-3"
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-extrabold">{sub.name}</p>
              <p className="text-xs text-[color:var(--muted)]">
                Cancels {sub.cancellingOn} · saves {formatMoney(monthlyCostInBaseCents(sub, fx), fx.baseCurrency)}/mo
              </p>
            </div>
            <button className="button-ghost text-xs" type="button" onClick={() => onUndo(sub.id)}>
              <RotateCcw aria-hidden="true" size={14} />
              Undo
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
