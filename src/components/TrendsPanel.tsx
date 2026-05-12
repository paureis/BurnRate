"use client";

import { TrendingUp } from "lucide-react";
import { useMemo } from "react";
import { formatMoney, type FxContext } from "@/lib/currency";
import { buildForecastPoints, type MonthlySnapshot } from "@/lib/snapshots";

export function TrendsPanel({
  fx,
  monthlyBurnCents,
  snapshots,
}: {
  fx: FxContext;
  monthlyBurnCents: number;
  snapshots: MonthlySnapshot[];
}) {
  const points = useMemo(
    () => buildForecastPoints(snapshots, monthlyBurnCents),
    [monthlyBurnCents, snapshots],
  );

  const maxCents = useMemo(
    () => Math.max(1, ...points.map((p) => p.monthlyCents)),
    [points],
  );

  // ASCII-ish bar chart fallback — we keep Recharts off this surface to avoid bundling
  // it twice. The grid does the visual job; users get hover-readable rows.
  if (snapshots.length === 0) {
    return (
      <section className="panel p-5" aria-label="Trends">
        <div className="mb-3 flex items-center gap-2">
          <TrendingUp aria-hidden="true" className="text-[color:var(--accent-2)]" size={20} />
          <h2 className="text-xl font-extrabold">Trends</h2>
        </div>
        <p className="text-sm text-[color:var(--muted)]">
          We&apos;ll start drawing your trend after we have a month of history. Come back next month — your first
          snapshot was captured today.
        </p>
      </section>
    );
  }

  return (
    <section className="panel p-5" aria-label="Trends">
      <div className="mb-3 flex items-center gap-2">
        <TrendingUp aria-hidden="true" className="text-[color:var(--accent-2)]" size={20} />
        <h2 className="text-xl font-extrabold">Trends</h2>
      </div>

      <div className="grid gap-2">
        {points.map((point) => {
          const cents = point.monthlyCents;
          const ratio = cents / maxCents;
          return (
            <div key={`${point.month}-${point.projection ? "proj" : "hist"}`} className="grid grid-cols-[80px_1fr_120px] items-center gap-3">
              <span className="text-xs font-extrabold text-[color:var(--muted)]">{point.month}</span>
              <div className="h-3 rounded-full bg-[color:var(--panel-strong)]">
                <div
                  className={point.projection ? "h-3 rounded-full bg-[color:var(--accent-2)]/60" : "h-3 rounded-full bg-[color:var(--accent)]"}
                  style={{ width: `${Math.max(2, ratio * 100)}%` }}
                />
              </div>
              <span className="text-right text-xs font-bold">
                {formatMoney(cents, fx.baseCurrency)}
                {point.projection && <span className="ml-1 text-[color:var(--subtle)]">est.</span>}
              </span>
            </div>
          );
        })}
      </div>
      <p className="mt-3 text-xs text-[color:var(--subtle)]">
        Dashed bars are a 12-month projection at your current burn rate.
      </p>
    </section>
  );
}
