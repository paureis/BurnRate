"use client";

import { BellRing, Check, Plus, Trash2 } from "lucide-react";
import { clsx } from "clsx";
import { formatCents, getTrialStatus, type Trial } from "@/lib/burnrate";
import { EmptyState } from "./EmptyState";
import { type TrialDraft } from "./shared";

export function TrialTracker({
  convertTrial,
  deleteTrial,
  draft,
  onAdd,
  onDraftChange,
  trials,
}: {
  convertTrial: (trial: Trial) => void;
  deleteTrial: (id: string) => void;
  draft: TrialDraft;
  onAdd: () => void;
  onDraftChange: (draft: TrialDraft) => void;
  trials: Trial[];
}) {
  return (
    <div className="grid gap-4">
      <section className="panel p-5">
        <div className="mb-4 flex items-center gap-2">
          <BellRing aria-hidden="true" className="text-[color:var(--accent-2)]" size={20} />
          <h2 className="text-xl font-extrabold">Add free trial</h2>
        </div>
        <form
          className="grid gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            onAdd();
          }}
        >
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <label className="label">
              Service name
              <input
                className="input"
                value={draft.name}
                onChange={(event) => onDraftChange({ ...draft, name: event.target.value })}
                placeholder="Notion AI"
              />
            </label>
            <label className="label">
              Start date
              <input
                className="input"
                type="date"
                value={draft.trialStartDate}
                onChange={(event) => onDraftChange({ ...draft, trialStartDate: event.target.value })}
              />
            </label>
            <label className="label">
              End date
              <input
                className="input"
                type="date"
                value={draft.trialEndDate}
                onChange={(event) => onDraftChange({ ...draft, trialEndDate: event.target.value })}
              />
            </label>
            <label className="label">
              Cost after trial
              <input
                className="input"
                inputMode="decimal"
                value={draft.costAfterTrial}
                onChange={(event) => onDraftChange({ ...draft, costAfterTrial: event.target.value })}
                placeholder="20.00"
              />
            </label>
          </div>
          <label className="flex items-center gap-3 text-sm font-bold text-[color:var(--muted)]">
            <input
              checked={draft.remindMe}
              className="h-4 w-4 accent-[color:var(--accent)]"
              onChange={(event) => onDraftChange({ ...draft, remindMe: event.target.checked })}
              type="checkbox"
            />
            Remind me
          </label>
          <button className="button-primary w-fit" type="submit">
            <Plus aria-hidden="true" size={17} />
            Add trial
          </button>
        </form>
      </section>

      <section className="panel p-5">
        <h2 className="mb-4 text-xl font-extrabold">Trial countdowns</h2>
        {trials.length > 0 ? (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {trials.map((trial) => (
              <TrialCard key={trial.id} convertTrial={convertTrial} deleteTrial={deleteTrial} trial={trial} />
            ))}
          </div>
        ) : (
          <EmptyState Icon={BellRing} title="No free trials tracked" body="Add a trial before it turns into surprise spend." />
        )}
      </section>
    </div>
  );
}

export function TrialCard({
  compact = false,
  convertTrial,
  deleteTrial,
  trial,
}: {
  compact?: boolean;
  convertTrial: (trial: Trial) => void;
  deleteTrial: (id: string) => void;
  trial: Trial;
}) {
  const trialStatus = getTrialStatus(trial);
  const urgent = trialStatus.status === "urgent";

  return (
    <article
      className={clsx(
        "rounded-panel border border-[color:var(--line)] bg-[color:var(--panel-strong)] p-4",
        urgent && "pulse-urgent border-[color:var(--danger)]",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-extrabold">{trial.name}</h3>
          <p className="text-sm text-[color:var(--muted)]">
            Ends {trial.trialEndDate} - {formatCents(trial.costAfterTrialCents)}/mo after
          </p>
        </div>
        {trial.remindMe && <BellRing aria-label="Reminder enabled" className="text-[color:var(--accent-2)]" size={18} />}
      </div>
      <div className="mt-5">
        <p className={clsx("stat-number text-6xl", urgent && "text-[color:var(--danger)]")}>
          {trialStatus.hasEnded ? 0 : trialStatus.daysRemaining}
        </p>
        <p className="text-sm font-bold uppercase tracking-[0.16em] text-[color:var(--muted)]">
          {trialStatus.hasEnded ? "ended" : "days left"}
        </p>
      </div>
      {!compact && (
        <div className="mt-5 flex flex-wrap gap-2">
          <button className="button-secondary" type="button" onClick={() => convertTrial(trial)}>
            <Check aria-hidden="true" size={17} />
            Convert
          </button>
          <button className="icon-button" type="button" aria-label={`Delete ${trial.name} trial`} onClick={() => deleteTrial(trial.id)}>
            <Trash2 aria-hidden="true" size={17} />
          </button>
        </div>
      )}
    </article>
  );
}
