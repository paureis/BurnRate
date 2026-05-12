"use client";

import { Target, Trash2 } from "lucide-react";
import { useState } from "react";
import { clsx } from "clsx";
import { formatCents, toCents } from "@/lib/burnrate";
import {
  buildBudgetFromInput,
  evaluateCap,
  evaluateSavings,
  validateBudgetInput,
  type BudgetGoal,
} from "@/lib/budget";
import type { Subscription } from "@/lib/burnrate";

export function BudgetTracker({
  budget,
  monthlyBurnCents,
  yearlyBurnCents,
  onChangeBudget,
  subscriptions,
}: {
  budget: BudgetGoal;
  monthlyBurnCents: number;
  yearlyBurnCents: number;
  onChangeBudget: (next: BudgetGoal) => void;
  subscriptions: Subscription[];
}) {
  const [editing, setEditing] = useState(false);
  const [capInput, setCapInput] = useState(budget.monthlyCapCents != null ? (budget.monthlyCapCents / 100).toFixed(2) : "");
  const [savingsInput, setSavingsInput] = useState(
    budget.annualSavingsTargetCents != null ? (budget.annualSavingsTargetCents / 100).toFixed(2) : "",
  );
  const [targetDateInput, setTargetDateInput] = useState(budget.targetDate ?? "");
  const [errors, setErrors] = useState<string[]>([]);

  const cap = evaluateCap(monthlyBurnCents, budget);
  const savings = evaluateSavings(yearlyBurnCents, budget);

  function save() {
    const capCents = capInput.trim() ? toCents(capInput) : null;
    const savingsCents = savingsInput.trim() ? toCents(savingsInput) : null;
    const validationErrors = validateBudgetInput({
      monthlyCapCents: capCents,
      annualSavingsTargetCents: savingsCents,
      targetDate: targetDateInput || null,
      subscriptions,
      existingBudget: budget,
    });
    if (validationErrors.length > 0) {
      setErrors(validationErrors.map((error) => error.message));
      return;
    }
    setErrors([]);
    const next = buildBudgetFromInput({
      monthlyCapCents: capCents,
      annualSavingsTargetCents: savingsCents,
      targetDate: targetDateInput || null,
      subscriptions,
      existingBudget: budget,
    });
    onChangeBudget(next);
    setEditing(false);
  }

  function clearGoal() {
    onChangeBudget({
      monthlyCapCents: null,
      annualSavingsTargetCents: null,
      targetDate: null,
      baselineYearlyCents: null,
      createdAt: null,
    });
    setCapInput("");
    setSavingsInput("");
    setTargetDateInput("");
    setErrors([]);
  }

  const showThermometer = cap.hasCap;
  const showSavings = savings.hasGoal;

  return (
    <section className="panel p-5" aria-label="Budget tracker">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Target aria-hidden="true" className="text-[color:var(--accent-3)]" size={20} />
          <h2 className="text-xl font-extrabold">Budget &amp; goals</h2>
        </div>
        <div className="flex flex-wrap gap-2">
          {(showThermometer || showSavings) && (
            <button className="button-secondary" type="button" onClick={clearGoal}>
              <Trash2 aria-hidden="true" size={16} />
              Clear goal
            </button>
          )}
          <button className="button-secondary" type="button" onClick={() => setEditing((current) => !current)}>
            {editing ? "Close" : showThermometer || showSavings ? "Edit goal" : "Set goal"}
          </button>
        </div>
      </div>

      {editing ? (
        <form
          className="grid gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            save();
          }}
        >
          <div className="grid gap-3 md:grid-cols-3">
            <label className="label">
              Monthly cap (USD)
              <input
                className="input"
                inputMode="decimal"
                value={capInput}
                onChange={(event) => setCapInput(event.target.value)}
                placeholder="50.00"
                aria-label="Monthly cap"
              />
            </label>
            <label className="label">
              Annual savings target (USD)
              <input
                className="input"
                inputMode="decimal"
                value={savingsInput}
                onChange={(event) => setSavingsInput(event.target.value)}
                placeholder="200.00"
                aria-label="Annual savings target"
              />
            </label>
            <label className="label">
              Target date
              <input
                className="input"
                type="date"
                value={targetDateInput}
                onChange={(event) => setTargetDateInput(event.target.value)}
                aria-label="Target date"
              />
            </label>
          </div>
          {errors.length > 0 && (
            <ul role="alert" className="grid gap-1 rounded-panel border border-[color:var(--danger)] bg-[color:var(--panel-strong)] p-3 text-sm font-bold text-[color:var(--danger)]">
              {errors.map((error) => (
                <li key={error}>{error}</li>
              ))}
            </ul>
          )}
          <div className="flex gap-2">
            <button className="button-primary" type="submit">
              Save goal
            </button>
            <button className="button-secondary" type="button" onClick={() => setEditing(false)}>
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {showThermometer ? (
            <div className="rounded-panel border border-[color:var(--line)] bg-[color:var(--panel-strong)] p-4">
              <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-[color:var(--muted)]">Monthly cap</p>
              <p className="mt-1 text-2xl font-extrabold">
                {formatCents(monthlyBurnCents)} of {formatCents(cap.capCents)}
              </p>
              <div className="mt-3 h-3 overflow-hidden rounded-full bg-[color:var(--panel-soft)]" aria-hidden="true">
                <div
                  className={clsx(
                    "h-full rounded-full transition-all",
                    cap.tone === "good" && "bg-[color:var(--accent-3)]",
                    cap.tone === "warning" && "bg-[color:var(--accent-2)]",
                    cap.tone === "danger" && "bg-[color:var(--danger)]",
                    cap.tone === "over" && "bg-[color:var(--danger)] pulse-urgent",
                  )}
                  style={{ width: `${Math.min(100, Math.max(0, cap.ratio * 100))}%` }}
                />
              </div>
              <p
                className={clsx(
                  "mt-3 text-sm font-bold",
                  cap.tone === "over" && "text-[color:var(--danger)]",
                  cap.tone !== "over" && "text-[color:var(--muted)]",
                )}
                role="status"
              >
                {cap.tone === "over"
                  ? `Over by ${formatCents(-cap.remainingCents)}`
                  : `${formatCents(cap.remainingCents)} left this month`}
              </p>
            </div>
          ) : (
            <div className="rounded-panel border border-dashed border-[color:var(--line)] bg-[color:var(--panel-strong)] p-4 text-sm font-bold text-[color:var(--muted)]">
              No monthly cap set. Click <em>Set goal</em> to pick one.
            </div>
          )}

          {showSavings ? (
            <div className="rounded-panel border border-[color:var(--line)] bg-[color:var(--panel-strong)] p-4">
              <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-[color:var(--muted)]">
                Cancellation goal
              </p>
              <p className="mt-1 text-2xl font-extrabold">
                {formatCents(Math.max(0, savings.savedYearlyCents))} of {formatCents(savings.targetCents)}
              </p>
              <div className="mt-3 h-3 overflow-hidden rounded-full bg-[color:var(--panel-soft)]" aria-hidden="true">
                <div
                  className="h-full rounded-full bg-[color:var(--accent-3)] transition-all"
                  style={{ width: `${Math.min(100, Math.max(0, savings.ratio * 100))}%` }}
                />
              </div>
              <p className="mt-3 text-sm font-bold text-[color:var(--muted)]" role="status">
                {savings.daysRemaining != null
                  ? savings.daysRemaining >= 0
                    ? `${savings.daysRemaining} days left to ${savings.targetDate}.`
                    : `Target date ${savings.targetDate} has passed.`
                  : "No target date set."}
              </p>
            </div>
          ) : (
            <div className="rounded-panel border border-dashed border-[color:var(--line)] bg-[color:var(--panel-strong)] p-4 text-sm font-bold text-[color:var(--muted)]">
              No annual savings target set.
            </div>
          )}
        </div>
      )}
    </section>
  );
}
