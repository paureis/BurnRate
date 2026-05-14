"use client";

import { useMemo } from "react";
import { Receipt, AlertTriangle } from "lucide-react";
import { isExpiringSoon, summarizeDiscount, totalActiveDiscountsCents } from "@/lib/discounts";
import { formatMoney, type FxContext } from "@/lib/currency";
import type { Subscription } from "@/lib/burnrate";

interface RetentionLogProps {
  subscriptions: Subscription[];
  fx: FxContext;
  now?: Date;
}

export function RetentionLog({ subscriptions, fx, now = new Date() }: RetentionLogProps) {
  const rows = useMemo(
    () =>
      subscriptions
        .filter((sub) => sub.activeDiscount)
        .map((sub) => ({ sub, summary: summarizeDiscount(sub, fx, now) }))
        .filter((row): row is { sub: Subscription; summary: NonNullable<ReturnType<typeof summarizeDiscount>> } => row.summary !== null),
    [subscriptions, fx, now],
  );

  const totals = useMemo(() => totalActiveDiscountsCents(subscriptions, fx, now), [subscriptions, fx, now]);

  if (rows.length === 0) return null;

  const expiringSoon = rows.filter(({ sub }) => isExpiringSoon(sub, now));

  return (
    <section className="panel p-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Receipt aria-hidden="true" className="text-[color:var(--accent-2)]" size={20} />
          <h2 className="text-xl font-extrabold">Retention log</h2>
        </div>
        <p className="text-sm font-bold text-[color:var(--accent-2)]">
          Saving {formatMoney(totals.monthly, fx.baseCurrency)}/mo · {formatMoney(totals.yearly, fx.baseCurrency)}/yr
        </p>
      </div>

      {expiringSoon.length > 0 && (
        <div className="mb-3 flex items-start gap-2 rounded-panel border border-[color:var(--accent)] bg-[color:var(--panel-strong)] p-3">
          <AlertTriangle aria-hidden="true" size={18} className="mt-0.5 text-[color:var(--accent)]" />
          <p className="text-sm font-bold">
            {expiringSoon.length} discount{expiringSoon.length === 1 ? "" : "s"} expiring in the next 14 days.
          </p>
        </div>
      )}

      <ul className="grid gap-3">
        {rows.map(({ sub, summary }) => (
          <li
            key={sub.id}
            className="rounded-panel border border-[color:var(--line)] bg-[color:var(--panel-strong)] p-3"
          >
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <p className="text-base font-extrabold">{sub.name}</p>
              <p className="text-sm font-bold text-[color:var(--accent-2)]">
                Saves {formatMoney(summary.monthlySavingsCents, fx.baseCurrency)}/mo
              </p>
            </div>
            <p className="text-xs text-[color:var(--muted)]">
              {sub.activeDiscount?.source} • since {sub.activeDiscount?.negotiatedOn}
              {sub.activeDiscount?.expiresOn ? ` • expires ${sub.activeDiscount.expiresOn}` : ""}
            </p>
            {summary.publicPriceDeltaCents !== null && summary.publicPriceDeltaCents > 0 && (
              <p className="mt-1 text-xs text-[color:var(--accent-2)]">
                Public price is {formatMoney(summary.publicPriceComparisonCents ?? 0, fx.baseCurrency)} — your locked
                rate saves {formatMoney(summary.publicPriceDeltaCents, fx.baseCurrency)}/mo vs current public.
              </p>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
