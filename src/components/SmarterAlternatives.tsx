"use client";

import { ExternalLink, Lightbulb, X } from "lucide-react";
import type { Subscription } from "@/lib/burnrate";
import { bundleRules } from "@/data/bundle-rules";
import { overlapRules } from "@/data/overlap-rules";
import { detectBundles, detectOverlaps } from "@/lib/recommendations";
import { formatMoney, type FxContext } from "@/lib/currency";

export function SmarterAlternatives({
  dismissedIds,
  fx,
  onCancelSubscription,
  onDismiss,
  subscriptions,
}: {
  dismissedIds: string[];
  fx: FxContext;
  onCancelSubscription: (id: string) => void;
  onDismiss: (ruleId: string) => void;
  subscriptions: Subscription[];
}) {
  const bundles = detectBundles(subscriptions, bundleRules, fx).filter(
    (match) => !dismissedIds.includes(match.rule.id),
  );
  const overlaps = detectOverlaps(subscriptions, overlapRules, fx).filter(
    (match) => !dismissedIds.includes(match.rule.id),
  );

  if (bundles.length === 0 && overlaps.length === 0) return null;

  return (
    <section className="panel p-5" aria-label="Smarter alternatives">
      <div className="mb-3 flex items-center gap-2">
        <Lightbulb aria-hidden="true" className="text-[color:var(--accent)]" size={20} />
        <h2 className="text-xl font-extrabold">Smarter alternatives</h2>
      </div>
      <div className="grid gap-3">
        {bundles.map((match) => (
          <article
            key={match.rule.id}
            className="grid gap-2 rounded-panel border border-[color:var(--accent)] bg-[color:var(--panel-strong)] p-4"
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-[color:var(--accent)]">Bundle</p>
                <h3 className="text-lg font-extrabold">{match.rule.label}</h3>
                <p className="text-sm text-[color:var(--muted)]">{match.rule.description}</p>
              </div>
              <button
                className="icon-button"
                type="button"
                aria-label={`Dismiss ${match.rule.label}`}
                onClick={() => onDismiss(match.rule.id)}
              >
                <X aria-hidden="true" size={15} />
              </button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {match.matchedSubscriptions.map((sub) => (
                <span
                  key={sub.id}
                  className="rounded-full border border-[color:var(--line)] bg-[color:var(--panel)] px-2 py-1 text-xs font-bold"
                >
                  {sub.name}
                </span>
              ))}
            </div>
            <p className="text-sm">
              <span className="font-bold">Current:</span>{" "}
              {formatMoney(match.currentMonthlyCents, fx.baseCurrency)}/mo →{" "}
              <span className="font-bold">Bundle:</span>{" "}
              {formatMoney(match.bundleMonthlyCents, fx.baseCurrency)}/mo
            </p>
            <p className="text-sm font-extrabold text-[color:var(--accent)]">
              Save {formatMoney(match.savingsMonthlyCents, fx.baseCurrency)}/mo (~{formatMoney(match.savingsMonthlyCents * 12, fx.baseCurrency)}/yr)
            </p>
            {match.rule.bundleNotes && (
              <p className="text-xs text-[color:var(--subtle)]">{match.rule.bundleNotes}</p>
            )}
            {match.rule.bundleCancelUrl && (
              <a
                className="button-ghost text-xs"
                href={match.rule.bundleCancelUrl}
                rel="noreferrer noopener"
                target="_blank"
              >
                <ExternalLink aria-hidden="true" size={14} />
                Set up {match.rule.label}
              </a>
            )}
          </article>
        ))}
        {overlaps.map((match) => (
          <article
            key={match.rule.id}
            className="grid gap-2 rounded-panel border border-[color:var(--accent-2)] bg-[color:var(--panel-strong)] p-4"
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-[color:var(--accent-2)]">Overlap</p>
                <h3 className="text-lg font-extrabold">{match.rule.label}</h3>
                <p className="text-sm text-[color:var(--muted)]">{match.rule.advice}</p>
              </div>
              <button
                className="icon-button"
                type="button"
                aria-label={`Dismiss ${match.rule.label}`}
                onClick={() => onDismiss(match.rule.id)}
              >
                <X aria-hidden="true" size={15} />
              </button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {match.matchedSubscriptions.map((sub) => (
                <span
                  key={sub.id}
                  className="rounded-full border border-[color:var(--line)] bg-[color:var(--panel)] px-2 py-1 text-xs font-bold"
                >
                  {sub.name}
                </span>
              ))}
            </div>
            <p className="text-sm">
              You spend {formatMoney(match.monthlyCents, fx.baseCurrency)}/mo across {match.matchedSubscriptions.length}{" "}
              services. Cheapest is <span className="font-bold">{match.cheapestSubscription.name}</span>.
            </p>
            <button
              className="button-ghost text-xs"
              type="button"
              onClick={() => onCancelSubscription(match.cheapestSubscription.id)}
            >
              Cancel {match.cheapestSubscription.name}
            </button>
          </article>
        ))}
      </div>
    </section>
  );
}
