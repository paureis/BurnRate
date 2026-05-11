"use client";

import { RefreshCcw } from "lucide-react";
import { clsx } from "clsx";
import {
  calculateSimulatorImpact,
  formatCents,
  monthlyCostCents,
  type Subscription,
} from "@/lib/burnrate";
import { EmptyState } from "./EmptyState";
import { AnimatedMoney } from "./HeroMetrics";
import { SubscriptionGlyph } from "./SubscriptionManager";

export function Simulator({
  disabledIds,
  impact,
  subscriptions,
  toggleId,
}: {
  disabledIds: Set<string>;
  impact: ReturnType<typeof calculateSimulatorImpact>;
  subscriptions: Subscription[];
  toggleId: (id: string) => void;
}) {
  return (
    <div className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
      <section className="panel p-5">
        <h2 className="text-xl font-extrabold">What if?</h2>
        <div className="mt-5 grid gap-4">
          <CompareNumber label="Current burn" value={impact.currentMonthlyCents} suffix="/mo" />
          <CompareNumber label="After toggles" value={impact.projectedMonthlyCents} suffix="/mo" accent />
          <CompareNumber label="Yearly savings" value={impact.yearlySavingsCents} suffix="/yr" danger />
        </div>
        <p className="mt-5 rounded-panel border border-[color:var(--line)] bg-[color:var(--panel-strong)] p-4 text-sm font-bold text-[color:var(--muted)]">
          Current burn: {formatCents(impact.currentMonthlyCents)}/mo - If you cancel these:{" "}
          {formatCents(impact.projectedMonthlyCents)}/mo - You'd save {formatCents(impact.yearlySavingsCents)}/year
        </p>
      </section>

      <section className="panel p-5">
        <h2 className="mb-4 text-xl font-extrabold">Toggle subscriptions</h2>
        {subscriptions.length > 0 ? (
          <div className="grid gap-3">
            {subscriptions.map((subscription) => {
              const disabled = disabledIds.has(subscription.id);
              return (
                <label
                  key={subscription.id}
                  className={clsx(
                    "flex items-center justify-between gap-3 rounded-panel border border-[color:var(--line)] bg-[color:var(--panel-strong)] p-4 transition",
                    disabled && "border-[color:var(--accent)] opacity-70",
                  )}
                >
                  <span className="flex min-w-0 items-center gap-3">
                    <input
                      checked={!disabled}
                      className="h-5 w-5 accent-[color:var(--accent)]"
                      onChange={() => toggleId(subscription.id)}
                      type="checkbox"
                    />
                    <SubscriptionGlyph subscription={subscription} />
                    <span className="min-w-0">
                      <span className="block truncate font-extrabold">{subscription.name}</span>
                      <span className="block text-sm text-[color:var(--muted)]">{subscription.category}</span>
                    </span>
                  </span>
                  <span className="shrink-0 text-right font-extrabold">
                    {formatCents(monthlyCostCents(subscription))}
                  </span>
                </label>
              );
            })}
          </div>
        ) : (
          <EmptyState Icon={RefreshCcw} title="Simulator is waiting" body="Add subscriptions to model cancellations." />
        )}
      </section>
    </div>
  );
}

export function CompareNumber({
  accent = false,
  danger = false,
  label,
  suffix,
  value,
}: {
  accent?: boolean;
  danger?: boolean;
  label: string;
  suffix: string;
  value: number;
}) {
  return (
    <div className="rounded-panel border border-[color:var(--line)] bg-[color:var(--panel-strong)] p-4">
      <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-[color:var(--muted)]">{label}</p>
      <div className="mt-2 flex items-end gap-2">
        <AnimatedMoney
          className={clsx("stat-number text-6xl", accent && "text-[color:var(--accent-3)]", danger && "text-[color:var(--danger)]")}
          value={value}
        />
        <span className="pb-2 text-sm font-extrabold text-[color:var(--muted)]">{suffix}</span>
      </div>
    </div>
  );
}
