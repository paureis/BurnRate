"use client";

import { useMemo, useState } from "react";
import { Flag, Plus, Trash2, Archive } from "lucide-react";
import {
  buildGoalId,
  progressOfGoal,
  type AppStateForGoals,
  type Goal,
  type GoalType,
} from "@/lib/goals";
import { formatMoney, type FxContext } from "@/lib/currency";
import { toCents } from "@/lib/burnrate";

interface GoalsPanelProps {
  goals: Goal[];
  state: AppStateForGoals;
  fx: FxContext;
  onChange: (next: Goal[]) => void;
  now?: Date;
}

const GOAL_TYPES: Array<{ id: GoalType; label: string; description: string }> = [
  { id: "monthly-cap", label: "Monthly cap", description: "Stay under $X/month total." },
  { id: "category-cap", label: "Category cap", description: "Stay under $X/month in one category." },
  { id: "annual-savings", label: "Annual savings", description: "Save $X by a target date." },
  { id: "no-new-subs-streak", label: "No new subs", description: "N days without adding a subscription." },
  { id: "monthly-cap-streak", label: "Cap streak", description: "N consecutive months under cap." },
];

export function GoalsPanel({ goals, state, fx, onChange, now = new Date() }: GoalsPanelProps) {
  const [adding, setAdding] = useState(false);
  const [draftType, setDraftType] = useState<GoalType>("monthly-cap");
  const [draftLabel, setDraftLabel] = useState("");
  const [draftCents, setDraftCents] = useState("");
  const [draftCategory, setDraftCategory] = useState("entertainment");
  const [draftDays, setDraftDays] = useState("30");
  const [draftMonths, setDraftMonths] = useState("3");
  const [draftDate, setDraftDate] = useState("");

  const visible = useMemo(() => goals.filter((g) => g.state !== "archived"), [goals]);

  function addGoal() {
    if (!draftLabel.trim()) return;
    const id = buildGoalId();
    const base: Goal = {
      id,
      type: draftType,
      label: draftLabel.trim(),
      createdAt: new Date().toISOString(),
      state: "active",
      history: [{ at: new Date().toISOString(), event: "created" }],
    };
    switch (draftType) {
      case "monthly-cap":
      case "category-cap":
        base.targetCents = toCents(draftCents);
        if (draftType === "category-cap") base.categoryId = draftCategory;
        break;
      case "annual-savings":
        base.targetCents = toCents(draftCents);
        if (draftDate) base.targetDate = draftDate;
        base.baselineCents = state.yearlyBurnCents;
        break;
      case "no-new-subs-streak":
        base.targetDays = Math.max(1, Number.parseInt(draftDays, 10) || 30);
        break;
      case "monthly-cap-streak":
        base.targetCents = toCents(draftCents);
        base.targetMonths = Math.max(1, Number.parseInt(draftMonths, 10) || 3);
        break;
    }
    onChange([...goals, base]);
    setAdding(false);
    setDraftLabel("");
    setDraftCents("");
    setDraftDate("");
  }

  function removeGoal(id: string) {
    onChange(goals.filter((g) => g.id !== id));
  }

  function archiveGoal(id: string) {
    onChange(goals.map((g) => (g.id === id ? { ...g, state: "archived" } : g)));
  }

  return (
    <section className="panel p-5">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Flag aria-hidden="true" className="text-[color:var(--accent-2)]" size={20} />
          <h2 className="text-xl font-extrabold">Goals</h2>
        </div>
        <button type="button" className="button-secondary text-xs" onClick={() => setAdding(true)}>
          <Plus aria-hidden="true" size={13} />
          Add goal
        </button>
      </div>

      {visible.length === 0 && !adding && (
        <p className="text-sm text-[color:var(--muted)]">
          No goals yet. Add a no-new-subs streak or a category cap to start coaching yourself.
        </p>
      )}

      {visible.length > 0 && (
        <ul className="grid gap-2">
          {visible.map((goal) => {
            const progress = progressOfGoal(goal, state, fx, now);
            return (
              <li
                key={goal.id}
                className="rounded-panel border border-[color:var(--line)] bg-[color:var(--panel-strong)] p-3"
              >
                <div className="flex items-baseline justify-between gap-2">
                  <p className="font-extrabold">{goal.label}</p>
                  <p className="text-xs font-bold uppercase tracking-wider text-[color:var(--muted)]">{goal.type}</p>
                </div>
                <p className="text-xs text-[color:var(--muted)]">{progress.label}</p>
                <div className="mt-2 h-2 rounded bg-[color:var(--panel)]">
                  <div
                    className={
                      progress.color === "green"
                        ? "h-2 rounded bg-[color:var(--accent)]"
                        : progress.color === "amber"
                          ? "h-2 rounded bg-[color:var(--accent-2)]"
                          : "h-2 rounded bg-[color:var(--danger,red)]"
                    }
                    style={{ width: `${Math.min(100, progress.pct * 100)}%` }}
                  />
                </div>
                {goal.state === "achieved" && (
                  <p className="mt-1 text-xs font-extrabold text-[color:var(--accent)]">🎉 Achieved</p>
                )}
                {goal.state === "failed" && (
                  <p className="mt-1 text-xs font-extrabold text-[color:var(--danger,red)]">Expired without success</p>
                )}
                <div className="mt-2 flex justify-end gap-1">
                  <button
                    type="button"
                    className="icon-button"
                    aria-label={`Archive ${goal.label}`}
                    onClick={() => archiveGoal(goal.id)}
                  >
                    <Archive aria-hidden="true" size={13} />
                  </button>
                  <button
                    type="button"
                    className="icon-button"
                    aria-label={`Delete ${goal.label}`}
                    onClick={() => removeGoal(goal.id)}
                  >
                    <Trash2 aria-hidden="true" size={13} />
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {adding && (
        <form
          className="mt-3 grid gap-3 rounded-panel border border-[color:var(--accent-2)] bg-[color:var(--panel-strong)] p-3"
          onSubmit={(event) => {
            event.preventDefault();
            addGoal();
          }}
        >
          <label className="label text-xs">
            Type
            <select className="input" value={draftType} onChange={(event) => setDraftType(event.target.value as GoalType)}>
              {GOAL_TYPES.map((type) => (
                <option key={type.id} value={type.id}>
                  {type.label} — {type.description}
                </option>
              ))}
            </select>
          </label>
          <label className="label text-xs">
            Label
            <input
              className="input"
              value={draftLabel}
              onChange={(event) => setDraftLabel(event.target.value)}
              placeholder="My monthly cap"
            />
          </label>
          {(draftType === "monthly-cap" || draftType === "category-cap" || draftType === "annual-savings" || draftType === "monthly-cap-streak") && (
            <label className="label text-xs">
              Target amount
              <input
                className="input"
                inputMode="decimal"
                value={draftCents}
                onChange={(event) => setDraftCents(event.target.value)}
                placeholder="50"
              />
            </label>
          )}
          {draftType === "category-cap" && (
            <label className="label text-xs">
              Category id
              <input
                className="input"
                value={draftCategory}
                onChange={(event) => setDraftCategory(event.target.value)}
                placeholder="entertainment"
              />
            </label>
          )}
          {draftType === "no-new-subs-streak" && (
            <label className="label text-xs">
              Target days
              <input
                className="input"
                type="number"
                min={1}
                value={draftDays}
                onChange={(event) => setDraftDays(event.target.value)}
              />
            </label>
          )}
          {draftType === "monthly-cap-streak" && (
            <label className="label text-xs">
              Target months
              <input
                className="input"
                type="number"
                min={1}
                value={draftMonths}
                onChange={(event) => setDraftMonths(event.target.value)}
              />
            </label>
          )}
          {draftType === "annual-savings" && (
            <label className="label text-xs">
              Target date (optional)
              <input className="input" type="date" value={draftDate} onChange={(event) => setDraftDate(event.target.value)} />
            </label>
          )}
          <div className="flex justify-end gap-2">
            <button type="button" className="button-ghost text-xs" onClick={() => setAdding(false)}>
              Cancel
            </button>
            <button type="submit" className="button-primary text-xs">
              Save goal
            </button>
          </div>
        </form>
      )}
    </section>
  );
}

// Re-export formatMoney to keep this module's dep graph self-contained for tests.
export { formatMoney };
