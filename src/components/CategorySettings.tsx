"use client";

import { useMemo, useState } from "react";
import { FolderTree, Plus, Trash2, Pencil, EyeOff, Eye } from "lucide-react";
import {
  buildBuiltInCategories,
  isReferenced,
  loadCategories,
  slugifyCategoryLabel,
  type CategoryDef,
} from "@/lib/categories";
import type { Subscription, Trial } from "@/lib/burnrate";
import { iconOptions } from "./shared";

interface CategorySettingsProps {
  stored: CategoryDef[] | undefined;
  subscriptions: Subscription[];
  trials: Trial[];
  onChange: (next: CategoryDef[]) => void;
}

const SWATCH_PALETTE = [
  "#ff5a3d",
  "#37f29b",
  "#ffd166",
  "#b388ff",
  "#7cc7ff",
  "#f970a8",
  "#6ee7f9",
  "#ff9f1c",
  "#9aa4b2",
];

export function CategorySettings({ stored, subscriptions, trials, onChange }: CategorySettingsProps) {
  const categories = useMemo(() => loadCategories(stored), [stored]);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftLabel, setDraftLabel] = useState("");
  const [draftColor, setDraftColor] = useState(SWATCH_PALETTE[0]);
  const [draftIcon, setDraftIcon] = useState("wallet");
  const [adding, setAdding] = useState(false);

  function startEdit(category: CategoryDef) {
    setEditingId(category.id);
    setDraftLabel(category.label);
    setDraftColor(category.color);
    setDraftIcon(category.icon);
    setAdding(false);
  }

  function startAdd() {
    setAdding(true);
    setEditingId(null);
    setDraftLabel("");
    setDraftColor(SWATCH_PALETTE[0]);
    setDraftIcon("wallet");
  }

  function commit() {
    if (!draftLabel.trim()) return;
    if (adding) {
      const id = slugifyCategoryLabel(draftLabel);
      if (categories.some((cat) => cat.id === id)) return;
      onChange([
        ...categories,
        {
          id,
          label: draftLabel.trim(),
          color: draftColor,
          icon: draftIcon,
          builtIn: false,
          order: categories.length,
        },
      ]);
      setAdding(false);
      return;
    }
    if (editingId) {
      onChange(
        categories.map((cat) =>
          cat.id === editingId ? { ...cat, label: draftLabel.trim(), color: draftColor, icon: draftIcon } : cat,
        ),
      );
      setEditingId(null);
    }
  }

  function cancelDraft() {
    setEditingId(null);
    setAdding(false);
  }

  function toggleHidden(category: CategoryDef) {
    onChange(categories.map((cat) => (cat.id === category.id ? { ...cat, hidden: !cat.hidden } : cat)));
  }

  function remove(category: CategoryDef) {
    if (category.builtIn) return;
    if (isReferenced(category.id, subscriptions, trials)) return;
    onChange(categories.filter((cat) => cat.id !== category.id));
  }

  function resetToDefaults() {
    onChange(buildBuiltInCategories());
  }

  return (
    <section className="panel p-5">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <FolderTree aria-hidden="true" className="text-[color:var(--accent-2)]" size={20} />
          <h2 className="text-xl font-extrabold">Categories</h2>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" className="button-ghost text-xs" onClick={resetToDefaults}>
            Reset
          </button>
          <button type="button" className="button-secondary text-xs" onClick={startAdd}>
            <Plus aria-hidden="true" size={13} />
            Add
          </button>
        </div>
      </div>

      <ul className="grid gap-2">
        {categories.map((category) => {
          const referenced = isReferenced(category.id, subscriptions, trials);
          const isEditing = editingId === category.id;
          return (
            <li
              key={category.id}
              className="rounded-panel border border-[color:var(--line)] bg-[color:var(--panel-strong)] p-3"
            >
              {isEditing ? (
                <CategoryForm
                  draftLabel={draftLabel}
                  draftColor={draftColor}
                  draftIcon={draftIcon}
                  onLabel={setDraftLabel}
                  onColor={setDraftColor}
                  onIcon={setDraftIcon}
                  onCommit={commit}
                  onCancel={cancelDraft}
                />
              ) : (
                <div className="flex flex-wrap items-center gap-3">
                  <span
                    className="grid h-8 w-8 place-items-center rounded-panel border border-[color:var(--line)]"
                    style={{ background: `${category.color}22`, color: category.color }}
                  >
                    <span className="text-xs font-extrabold">{category.label.charAt(0).toUpperCase()}</span>
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-extrabold">{category.label}</p>
                    <p className="text-xs text-[color:var(--muted)]">
                      {category.builtIn ? "Built-in" : "Custom"} · {category.icon}
                      {category.hidden ? " · hidden" : ""}
                      {referenced ? " · in use" : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      className="icon-button"
                      aria-label={`Edit ${category.label}`}
                      onClick={() => startEdit(category)}
                    >
                      <Pencil aria-hidden="true" size={14} />
                    </button>
                    {category.builtIn ? (
                      <button
                        type="button"
                        className="icon-button"
                        aria-label={category.hidden ? `Show ${category.label}` : `Hide ${category.label}`}
                        onClick={() => toggleHidden(category)}
                      >
                        {category.hidden ? <Eye aria-hidden="true" size={14} /> : <EyeOff aria-hidden="true" size={14} />}
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="icon-button"
                        aria-label={`Delete ${category.label}`}
                        disabled={referenced}
                        title={referenced ? "Reassign records first" : undefined}
                        onClick={() => remove(category)}
                      >
                        <Trash2 aria-hidden="true" size={14} />
                      </button>
                    )}
                  </div>
                </div>
              )}
            </li>
          );
        })}
        {adding && (
          <li className="rounded-panel border border-[color:var(--accent-2)] bg-[color:var(--panel-strong)] p-3">
            <CategoryForm
              draftLabel={draftLabel}
              draftColor={draftColor}
              draftIcon={draftIcon}
              onLabel={setDraftLabel}
              onColor={setDraftColor}
              onIcon={setDraftIcon}
              onCommit={commit}
              onCancel={cancelDraft}
            />
          </li>
        )}
      </ul>
    </section>
  );
}

function CategoryForm({
  draftLabel,
  draftColor,
  draftIcon,
  onLabel,
  onColor,
  onIcon,
  onCommit,
  onCancel,
}: {
  draftLabel: string;
  draftColor: string;
  draftIcon: string;
  onLabel: (value: string) => void;
  onColor: (value: string) => void;
  onIcon: (value: string) => void;
  onCommit: () => void;
  onCancel: () => void;
}) {
  return (
    <form
      className="grid gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        onCommit();
      }}
    >
      <label className="label text-xs">
        Label
        <input className="input" value={draftLabel} onChange={(event) => onLabel(event.target.value)} />
      </label>
      <div className="flex flex-wrap items-center gap-1">
        {SWATCH_PALETTE.map((color) => (
          <button
            key={color}
            type="button"
            className="h-6 w-6 rounded-full border border-[color:var(--line)]"
            style={{ background: color, outline: color === draftColor ? "2px solid var(--accent)" : undefined }}
            aria-label={`Color ${color}`}
            onClick={() => onColor(color)}
          />
        ))}
        <input
          type="color"
          className="h-6 w-8 border border-[color:var(--line)]"
          value={draftColor}
          onChange={(event) => onColor(event.target.value)}
          aria-label="Custom color"
        />
      </div>
      <label className="label text-xs">
        Icon
        <select className="input" value={draftIcon} onChange={(event) => onIcon(event.target.value)}>
          {iconOptions.map((icon) => (
            <option key={icon.value} value={icon.value}>
              {icon.label}
            </option>
          ))}
        </select>
      </label>
      <div className="flex justify-end gap-2">
        <button type="button" className="button-ghost text-xs" onClick={onCancel}>
          Cancel
        </button>
        <button type="submit" className="button-primary text-xs">
          Save
        </button>
      </div>
    </form>
  );
}
