"use client";

import { useMemo, useState } from "react";
import { Copy, ExternalLink, X } from "lucide-react";
import { CANCELLATION_PLAYBOOKS, GENERIC_PLAYBOOK, findPlaybook } from "@/data/cancellation-playbooks";
import {
  buildAttempt,
  closeAttempt,
  type CancellationAttempt,
  type CancellationOutcome,
} from "@/lib/cancellation-attempts";
import type { Subscription } from "@/lib/burnrate";

interface CancellationCoachProps {
  open: boolean;
  subscription: Subscription | null;
  onClose: () => void;
  onComplete: (attempt: CancellationAttempt, outcome: CancellationOutcome) => void;
}

const OUTCOMES: Array<{ id: CancellationOutcome; label: string; description: string }> = [
  { id: "cancelled", label: "Cancelled", description: "Service is gone." },
  { id: "downgraded", label: "Downgraded", description: "Switched to a cheaper tier." },
  { id: "discount-accepted", label: "Took a discount", description: "Logged a retention offer." },
  { id: "kept", label: "Kept it", description: "Decided not to cancel." },
  { id: "abandoned", label: "Abandoned", description: "Stepped away without deciding." },
];

export function CancellationCoach({ open, subscription, onClose, onComplete }: CancellationCoachProps) {
  const playbook = useMemo(() => {
    if (!subscription) return null;
    return findPlaybook(subscription.name) ?? GENERIC_PLAYBOOK;
  }, [subscription]);

  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());
  const [outcomeNote, setOutcomeNote] = useState("");
  const [retentionOffer, setRetentionOffer] = useState("");

  if (!open || !subscription || !playbook) return null;

  function copyScript(body: string) {
    void navigator.clipboard?.writeText(body);
  }

  function applyOutcome(outcome: CancellationOutcome) {
    if (!subscription) return;
    const attempt = closeAttempt(buildAttempt({ subscriptionId: subscription.id, serviceName: subscription.name }), outcome, {
      note: outcomeNote.trim() || undefined,
      retentionOfferText: retentionOffer.trim() || undefined,
    });
    onComplete(attempt, outcome);
    setCompletedSteps(new Set());
    setOutcomeNote("");
    setRetentionOffer("");
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Cancellation coach for ${subscription.name}`}
      className="fixed inset-0 z-40 grid place-items-end bg-black/50"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <aside className="flex h-full w-full max-w-md flex-col overflow-y-auto bg-[color:var(--panel)] p-5 shadow-2xl">
        <header className="mb-4 flex items-start justify-between gap-2">
          <div>
            <p className="text-xs font-extrabold uppercase tracking-[0.22em] text-[color:var(--accent-2)]">
              Cancellation coach
            </p>
            <h2 className="font-display text-3xl leading-none">{subscription.name}</h2>
            <p className="mt-1 text-xs text-[color:var(--muted)]">
              Playbook: {playbook.id} · est. {playbook.estimatedMinutes} min · last verified {playbook.lastVerifiedOn}
            </p>
          </div>
          <button type="button" className="icon-button" aria-label="Close" onClick={onClose}>
            <X aria-hidden="true" size={18} />
          </button>
        </header>

        {playbook.cancelUrl && (
          <a
            href={playbook.cancelUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="button-primary mb-4 justify-start"
          >
            <ExternalLink aria-hidden="true" size={16} />
            Open cancellation page
          </a>
        )}

        <section className="mb-5">
          <h3 className="mb-2 text-sm font-extrabold uppercase tracking-wider text-[color:var(--accent-2)]">Steps</h3>
          <ol className="grid gap-2 text-sm">
            {playbook.steps.map((step, index) => (
              <li key={index} className="flex items-start gap-2">
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={completedSteps.has(index)}
                  onChange={(event) =>
                    setCompletedSteps((current) => {
                      const next = new Set(current);
                      if (event.target.checked) next.add(index);
                      else next.delete(index);
                      return next;
                    })
                  }
                />
                <span className={completedSteps.has(index) ? "line-through text-[color:var(--muted)]" : ""}>
                  {step}
                </span>
              </li>
            ))}
          </ol>
        </section>

        {playbook.scripts.length > 0 && (
          <section className="mb-5">
            <h3 className="mb-2 text-sm font-extrabold uppercase tracking-wider text-[color:var(--accent-2)]">Scripts</h3>
            <ul className="grid gap-2">
              {playbook.scripts.map((script) => (
                <li key={script.label} className="rounded-panel border border-[color:var(--line)] bg-[color:var(--panel-strong)] p-3 text-sm">
                  <p className="mb-1 text-xs font-extrabold uppercase tracking-wider text-[color:var(--muted)]">
                    {script.label}
                  </p>
                  <p className="mb-2 italic">{script.body}</p>
                  <button
                    type="button"
                    className="text-xs font-extrabold text-[color:var(--accent-2)]"
                    onClick={() => copyScript(script.body)}
                  >
                    <Copy aria-hidden="true" size={12} className="inline" /> Copy
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className="mb-5">
          <h3 className="mb-2 text-sm font-extrabold uppercase tracking-wider text-[color:var(--accent-2)]">Gotchas</h3>
          <ul className="grid gap-1 text-sm text-[color:var(--muted)]">
            {playbook.gotchas.map((gotcha, index) => (
              <li key={index} className="list-disc ml-5">{gotcha}</li>
            ))}
          </ul>
          {playbook.expectedRetentionOffer && (
            <p className="mt-3 rounded-panel border border-[color:var(--accent-2)] bg-[color:var(--panel-strong)] p-2 text-xs">
              Expected retention offer: <strong>{playbook.expectedRetentionOffer.valueText}</strong>
            </p>
          )}
        </section>

        <section>
          <h3 className="mb-2 text-sm font-extrabold uppercase tracking-wider text-[color:var(--accent-2)]">Outcome</h3>
          <label className="label text-xs">
            Retention offer text (optional)
            <input
              type="text"
              className="input"
              value={retentionOffer}
              onChange={(event) => setRetentionOffer(event.target.value)}
              placeholder="50% off for 6 months"
            />
          </label>
          <label className="label text-xs mt-2">
            Notes
            <textarea
              className="input min-h-16 resize-y"
              value={outcomeNote}
              onChange={(event) => setOutcomeNote(event.target.value)}
              placeholder="What did they say?"
            />
          </label>
          <div className="mt-3 grid gap-2">
            {OUTCOMES.map((outcome) => (
              <button
                key={outcome.id}
                type="button"
                className="button-secondary justify-start"
                onClick={() => applyOutcome(outcome.id)}
              >
                <span className="font-extrabold">{outcome.label}</span>
                <span className="ml-auto text-xs text-[color:var(--muted)]">{outcome.description}</span>
              </button>
            ))}
          </div>
        </section>
      </aside>
    </div>
  );
}

// Keep playbook export reachable for downstream callers without an extra import.
export { CANCELLATION_PLAYBOOKS };
