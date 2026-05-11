"use client";

import { BellRing, CalendarClock, Plus, Sparkles, WalletCards } from "lucide-react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { clsx } from "clsx";
import {
  calculateBurnMetrics,
  defaultCategoryColors,
  formatCents,
  type CategoryBreakdown,
  type Insight,
  type Renewal,
  type Subscription,
  type Trial,
} from "@/lib/burnrate";
import { EmptyState } from "./EmptyState";
import { TrialCard } from "./TrialTracker";

export function Dashboard({
  metrics,
  onQuickAdd,
  subscriptions,
  trials,
}: {
  metrics: ReturnType<typeof calculateBurnMetrics>;
  onQuickAdd: () => void;
  subscriptions: Subscription[];
  trials: Trial[];
}) {
  return (
    <div className="grid gap-4 lg:grid-cols-[1.05fr_0.95fr]">
      <section className="panel p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-extrabold">Category breakdown</h2>
            <p className="text-sm text-[color:var(--muted)]">{subscriptions.length} active subscriptions</p>
          </div>
          <button className="button-secondary" type="button" onClick={onQuickAdd}>
            <Plus aria-hidden="true" size={17} />
            Add
          </button>
        </div>
        {metrics.categoryBreakdown.length > 0 ? (
          <div className="grid gap-5 md:grid-cols-[1fr_0.9fr]">
            <div className="h-72 min-h-72">
              <ResponsiveContainer
                width="100%"
                height="100%"
                minWidth={0}
                minHeight={280}
                initialDimension={{ width: 360, height: 280 }}
              >
                <PieChart>
                  <Pie
                    data={metrics.categoryBreakdown}
                    dataKey="monthlyCents"
                    nameKey="category"
                    innerRadius="58%"
                    outerRadius="86%"
                    paddingAngle={3}
                    stroke="var(--panel)"
                    strokeWidth={4}
                  >
                    {metrics.categoryBreakdown.map((entry) => (
                      <Cell
                        key={entry.category}
                        fill={defaultCategoryColors[entry.category] ?? "#ff5a3d"}
                      />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => formatCents(Number(value))} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <CategoryLegend breakdown={metrics.categoryBreakdown} />
          </div>
        ) : (
          <EmptyState
            Icon={WalletCards}
            title="No recurring charges yet"
            body="Add your first subscription and the burn chart will build itself."
            actionLabel="Add subscription"
            onAction={onQuickAdd}
          />
        )}
      </section>

      <section className="panel p-5">
        <div className="mb-4">
          <h2 className="text-xl font-extrabold">Upcoming renewals</h2>
          <p className="text-sm text-[color:var(--muted)]">Next 7 and 30 days</p>
        </div>
        <RenewalList renewals={metrics.upcomingRenewals.next7} title="Next 7 days" />
        <div className="my-4 h-px bg-[color:var(--line)]" />
        <RenewalList renewals={metrics.upcomingRenewals.next30} title="Next 30 days" />
      </section>

      <section className="panel p-5 lg:col-span-2">
        <div className="mb-4 flex items-center gap-2">
          <Sparkles aria-hidden="true" className="text-[color:var(--accent-2)]" size={20} />
          <h2 className="text-xl font-extrabold">Smart insights</h2>
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          {metrics.insights.slice(0, 3).map((insight) => (
            <InsightTile key={insight.id} insight={insight} />
          ))}
        </div>
      </section>

      <section className="panel p-5 lg:col-span-2">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-extrabold">Trial watch</h2>
            <p className="text-sm text-[color:var(--muted)]">{trials.length} free trials tracked</p>
          </div>
        </div>
        {trials.length > 0 ? (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {trials.slice(0, 3).map((trial) => (
              <TrialCard key={trial.id} convertTrial={() => undefined} deleteTrial={() => undefined} trial={trial} compact />
            ))}
          </div>
        ) : (
          <EmptyState Icon={BellRing} title="No trial timers" body="Track free trials before they become paid plans." />
        )}
      </section>
    </div>
  );
}

export function CategoryLegend({ breakdown }: { breakdown: CategoryBreakdown[] }) {
  return (
    <div className="grid content-center gap-3">
      {breakdown.map((category) => (
        <div key={category.category} className="grid grid-cols-[auto_1fr_auto] items-center gap-3">
          <span
            className="h-3 w-3 rounded-full"
            style={{ background: defaultCategoryColors[category.category] ?? "var(--accent)" }}
          />
          <span className="min-w-0 truncate text-sm font-bold">{category.category}</span>
          <span className="text-sm font-extrabold">{formatCents(category.monthlyCents)}</span>
        </div>
      ))}
    </div>
  );
}

export function RenewalList({ renewals, title }: { renewals: Renewal[]; title: string }) {
  return (
    <div>
      <h3 className="mb-3 text-sm font-extrabold uppercase tracking-[0.18em] text-[color:var(--accent-2)]">{title}</h3>
      {renewals.length > 0 ? (
        <div className="grid gap-2">
          {renewals.map((renewal) => (
            <div
              key={`${title}-${renewal.subscription.id}`}
              className="grid grid-cols-[auto_1fr_auto] items-center gap-3 rounded-panel border border-[color:var(--line)] bg-[color:var(--panel-strong)] p-3"
            >
              <CalendarClock aria-hidden="true" className="text-[color:var(--accent)]" size={18} />
              <div className="min-w-0">
                <p className="truncate font-extrabold">{renewal.subscription.name}</p>
                <p className="text-sm text-[color:var(--muted)]">{renewal.subscription.nextBillingDate}</p>
              </div>
              <div className="text-right">
                <p className="font-extrabold">{formatCents(renewal.subscription.costCents)}</p>
                <p className="text-xs font-bold text-[color:var(--muted)]">
                  {renewal.daysUntil === 0 ? "today" : `${renewal.daysUntil}d`}
                </p>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="rounded-panel border border-[color:var(--line)] bg-[color:var(--panel-strong)] p-4 text-sm font-bold text-[color:var(--muted)]">
          No renewals in this window.
        </p>
      )}
    </div>
  );
}

export function InsightTile({ insight }: { insight: Insight }) {
  const toneClass = {
    good: "border-[color:var(--accent-3)]",
    neutral: "border-[color:var(--line)]",
    warning: "border-[color:var(--accent-2)]",
    danger: "border-[color:var(--danger)]",
  }[insight.tone];

  return (
    <article className={clsx("rounded-panel border bg-[color:var(--panel-strong)] p-4", toneClass)}>
      <p className="text-base font-extrabold">{insight.title}</p>
      <p className="mt-2 text-sm text-[color:var(--muted)]">{insight.detail}</p>
    </article>
  );
}
