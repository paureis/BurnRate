"use client";

import { useMemo } from "react";
import { Flame, Ghost, Skull } from "lucide-react";
import { scoreUsage, type RoiBadge } from "@/lib/usage";
import { formatMoney, type FxContext } from "@/lib/currency";
import type { Subscription } from "@/lib/burnrate";

const BADGE_LABELS: Record<RoiBadge, string> = {
  hero: "Hero",
  steady: "Steady",
  mixed: "Mixed",
  zombie: "Zombie",
  ghost: "Ghost",
  untracked: "Untracked",
};

interface UsageInsightsProps {
  subscriptions: Subscription[];
  fx: FxContext;
  onCancelCoach?: (subscriptionId: string) => void;
  now?: Date;
}

export function UsageInsights({ subscriptions, fx, onCancelCoach, now = new Date() }: UsageInsightsProps) {
  const scored = useMemo(
    () => subscriptions.map((sub) => ({ sub, score: scoreUsage(sub, fx, now) })),
    [subscriptions, fx, now],
  );

  const hasAnyTracked = scored.some(({ score }) => score.monthsTracked >= 2);
  if (!hasAnyTracked) return null;

  const heroes = scored
    .filter(({ score }) => score.badge === "hero")
    .sort((a, b) => (a.score.costPerUseCents ?? Infinity) - (b.score.costPerUseCents ?? Infinity))
    .slice(0, 3);
  const zombies = scored
    .filter(({ score }) => score.badge === "zombie")
    .sort((a, b) => b.score.lifetimeSpendCents - a.score.lifetimeSpendCents)
    .slice(0, 3);
  const ghosts = scored
    .filter(({ score }) => score.badge === "ghost")
    .sort((a, b) => b.score.lifetimeSpendCents - a.score.lifetimeSpendCents)
    .slice(0, 3);

  if (heroes.length === 0 && zombies.length === 0 && ghosts.length === 0) return null;

  return (
    <section className="panel p-5">
      <div className="mb-4 flex items-center gap-2">
        <Flame aria-hidden="true" className="text-[color:var(--accent)]" size={20} />
        <h2 className="text-xl font-extrabold">Usage insights</h2>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <Column
          title="Heroes"
          icon={<Flame aria-hidden="true" size={16} className="text-[color:var(--accent)]" />}
          items={heroes.map(({ sub, score }) => ({
            id: sub.id,
            name: sub.name,
            detail: `Cost per use: ${formatMoney(score.costPerUseCents ?? 0, fx.baseCurrency)}`,
          }))}
        />
        <Column
          title="Zombies"
          icon={<Skull aria-hidden="true" size={16} className="text-[color:var(--accent-2)]" />}
          items={zombies.map(({ sub, score }) => ({
            id: sub.id,
            name: sub.name,
            detail: `${score.monthsZeroUse} months unused — ${formatMoney(score.lifetimeSpendCents, fx.baseCurrency)} spent`,
            action: onCancelCoach ? { label: "Coach me", onClick: () => onCancelCoach(sub.id) } : undefined,
          }))}
          emptyHint="No zombies — every used sub is still active."
        />
        <Column
          title="Ghosts"
          icon={<Ghost aria-hidden="true" size={16} className="text-[color:var(--muted)]" />}
          items={ghosts.map(({ sub, score }) => ({
            id: sub.id,
            name: sub.name,
            detail: `Never used — ${formatMoney(score.lifetimeSpendCents, fx.baseCurrency)} spent`,
            action: onCancelCoach ? { label: "Coach me", onClick: () => onCancelCoach(sub.id) } : undefined,
          }))}
          emptyHint="No ghosts."
        />
      </div>
      <p className="mt-4 text-xs text-[color:var(--muted)]">
        Badges update after the monthly check-in. Pick {BADGE_LABELS.hero}/{BADGE_LABELS.zombie}/{BADGE_LABELS.ghost} actions to trim.
      </p>
    </section>
  );
}

function Column({
  title,
  icon,
  items,
  emptyHint,
}: {
  title: string;
  icon: React.ReactNode;
  items: Array<{
    id: string;
    name: string;
    detail: string;
    action?: { label: string; onClick: () => void };
  }>;
  emptyHint?: string;
}) {
  return (
    <div className="rounded-panel border border-[color:var(--line)] bg-[color:var(--panel-strong)] p-3">
      <div className="mb-2 flex items-center gap-2">
        {icon}
        <h3 className="text-sm font-extrabold uppercase tracking-wider text-[color:var(--accent-2)]">{title}</h3>
      </div>
      {items.length === 0 ? (
        <p className="text-xs text-[color:var(--muted)]">{emptyHint ?? "—"}</p>
      ) : (
        <ul className="grid gap-2 text-sm">
          {items.map((item) => (
            <li key={item.id}>
              <p className="font-extrabold">{item.name}</p>
              <p className="text-xs text-[color:var(--muted)]">{item.detail}</p>
              {item.action && (
                <button
                  type="button"
                  className="mt-1 text-xs font-extrabold text-[color:var(--accent-2)] hover:underline"
                  onClick={item.action.onClick}
                >
                  {item.action.label} →
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
