"use client";

import { useState } from "react";
import { Tags, FolderTree, CalendarX, Repeat, Trash2, X } from "lucide-react";
import { clsx } from "clsx";
import {
  billingCycles,
  defaultCategories,
  type BillingCycle,
  type Subscription,
} from "@/lib/burnrate";
import { supportedCurrencies } from "@/data/fx-rates";
import type { BulkPatch } from "@/lib/bulk";
import { normalizeTag } from "@/lib/tags";

interface BulkActionBarProps {
  selectedIds: Set<string>;
  subscriptions: Subscription[];
  onApplyPatch: (patch: BulkPatch) => void;
  onDelete: () => void;
  onClear: () => void;
}

type ActiveAction = null | "category" | "cycle" | "currency" | "cancel-on" | "tag-add" | "tag-remove";

export function BulkActionBar({ selectedIds, subscriptions, onApplyPatch, onDelete, onClear }: BulkActionBarProps) {
  const [activeAction, setActiveAction] = useState<ActiveAction>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const count = selectedIds.size;
  if (count === 0) return null;

  const selectedSubs = subscriptions.filter((sub) => selectedIds.has(sub.id));
  const sampleNames = selectedSubs.slice(0, 3).map((sub) => sub.name).join(", ");
  const sampleSuffix = selectedSubs.length > 3 ? `, +${selectedSubs.length - 3} more` : "";

  return (
    <div
      role="region"
      aria-label="Bulk actions"
      className="sticky bottom-0 z-30 -mx-4 mt-2 border-t border-[color:var(--line)] bg-[color:var(--panel)]/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8"
    >
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-3">
        <div className="flex items-center gap-3">
          <span className="rounded-full bg-[color:var(--accent)] px-3 py-1 text-xs font-extrabold text-[#140b08]">
            {count} selected
          </span>
          <span className="hidden truncate text-xs text-[color:var(--muted)] sm:inline">
            {sampleNames}{sampleSuffix}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <ActionButton icon={FolderTree} label="Category" onClick={() => toggle("category")} active={activeAction === "category"} />
          <ActionButton icon={Repeat} label="Cycle" onClick={() => toggle("cycle")} active={activeAction === "cycle"} />
          <ActionButton icon={Tags} label="Currency" onClick={() => toggle("currency")} active={activeAction === "currency"} />
          <ActionButton icon={CalendarX} label="Cancel-on" onClick={() => toggle("cancel-on")} active={activeAction === "cancel-on"} />
          <ActionButton icon={Tags} label="Add tag" onClick={() => toggle("tag-add")} active={activeAction === "tag-add"} />
          <ActionButton icon={Tags} label="Remove tag" onClick={() => toggle("tag-remove")} active={activeAction === "tag-remove"} />
          <button
            type="button"
            className="inline-flex items-center gap-1 rounded-full border border-[color:var(--accent)] bg-[color:var(--panel-strong)] px-3 py-1 text-xs font-extrabold text-[color:var(--accent)]"
            onClick={() => setConfirmingDelete(true)}
          >
            <Trash2 aria-hidden="true" size={13} />
            Delete
          </button>
        </div>

        <button
          type="button"
          className="ml-auto icon-button"
          aria-label="Clear selection"
          onClick={onClear}
        >
          <X aria-hidden="true" size={16} />
        </button>
      </div>

      {activeAction === "category" && (
        <InlineForm
          label="New category"
          onCancel={() => setActiveAction(null)}
          onSubmit={(value) => {
            onApplyPatch({ category: value });
            setActiveAction(null);
          }}
          renderInput={(value, onChange) => (
            <input
              className="input"
              list="bulk-category-list"
              value={value}
              onChange={(event) => onChange(event.target.value)}
            />
          )}
          initial="other"
        >
          <datalist id="bulk-category-list">
            {defaultCategories.map((category) => (
              <option key={category} value={category} />
            ))}
          </datalist>
        </InlineForm>
      )}

      {activeAction === "cycle" && (
        <InlineForm
          label="New cycle"
          onCancel={() => setActiveAction(null)}
          onSubmit={(value) => {
            onApplyPatch({ billingCycle: value as BillingCycle });
            setActiveAction(null);
          }}
          renderInput={(value, onChange) => (
            <select className="input" value={value} onChange={(event) => onChange(event.target.value)}>
              {billingCycles.map((cycle) => (
                <option key={cycle} value={cycle}>
                  {cycle}
                </option>
              ))}
            </select>
          )}
          initial="monthly"
        />
      )}

      {activeAction === "currency" && (
        <InlineForm
          label="New currency"
          onCancel={() => setActiveAction(null)}
          onSubmit={(value) => {
            onApplyPatch({ currency: value });
            setActiveAction(null);
          }}
          renderInput={(value, onChange) => (
            <select className="input" value={value} onChange={(event) => onChange(event.target.value)}>
              {supportedCurrencies.map((code) => (
                <option key={code} value={code}>
                  {code}
                </option>
              ))}
            </select>
          )}
          initial={"USD"}
          hint="Amounts are not converted — only the currency field changes."
        />
      )}

      {activeAction === "cancel-on" && (
        <InlineForm
          label="Cancel on"
          onCancel={() => setActiveAction(null)}
          onSubmit={(value) => {
            if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return;
            onApplyPatch({ cancellingOn: value });
            setActiveAction(null);
          }}
          renderInput={(value, onChange) => (
            <input
              className="input"
              type="date"
              value={value}
              onChange={(event) => onChange(event.target.value)}
            />
          )}
          initial={defaultCancelDate(selectedSubs)}
        />
      )}

      {(activeAction === "tag-add" || activeAction === "tag-remove") && (
        <InlineForm
          label={activeAction === "tag-add" ? "Add tag" : "Remove tag"}
          onCancel={() => setActiveAction(null)}
          onSubmit={(value) => {
            const normalized = normalizeTag(value);
            if (!normalized) return;
            onApplyPatch(activeAction === "tag-add" ? { tagsAdd: [normalized] } : { tagsRemove: [normalized] });
            setActiveAction(null);
          }}
          renderInput={(value, onChange) => (
            <input
              className="input"
              value={value}
              onChange={(event) => onChange(event.target.value)}
              placeholder="work"
            />
          )}
          initial=""
        />
      )}

      {confirmingDelete && (
        <div className="mt-3 flex flex-wrap items-center justify-end gap-2 rounded-panel border border-[color:var(--accent)] bg-[color:var(--panel-strong)] px-3 py-2 text-xs">
          <span className="font-extrabold text-[color:var(--accent)]">
            Delete {count} subscription{count === 1 ? "" : "s"}?
          </span>
          <button type="button" className="text-[color:var(--muted)]" onClick={() => setConfirmingDelete(false)}>
            Cancel
          </button>
          <button
            type="button"
            className="button-primary text-xs"
            onClick={() => {
              onDelete();
              setConfirmingDelete(false);
            }}
          >
            Delete
          </button>
        </div>
      )}
    </div>
  );

  function toggle(action: ActiveAction) {
    setActiveAction((current) => (current === action ? null : action));
    setConfirmingDelete(false);
  }
}

function ActionButton({
  icon: Icon,
  label,
  active,
  onClick,
}: {
  icon: typeof Tags;
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={clsx(
        "inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-extrabold transition",
        active
          ? "border-[color:var(--accent)] bg-[color:var(--panel-strong)] text-[color:var(--text)]"
          : "border-[color:var(--line)] text-[color:var(--muted)] hover:border-[color:var(--accent-2)]",
      )}
    >
      <Icon aria-hidden="true" size={13} />
      {label}
    </button>
  );
}

function InlineForm({
  label,
  initial,
  hint,
  onCancel,
  onSubmit,
  renderInput,
  children,
}: {
  label: string;
  initial: string;
  hint?: string;
  onCancel: () => void;
  onSubmit: (value: string) => void;
  renderInput: (value: string, onChange: (next: string) => void) => React.ReactNode;
  children?: React.ReactNode;
}) {
  const [value, setValue] = useState(initial);
  return (
    <form
      className="mt-3 flex flex-wrap items-end gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit(value);
      }}
    >
      <label className="label text-xs">
        {label}
        {renderInput(value, setValue)}
      </label>
      {hint && <span className="text-xs text-[color:var(--muted)]">{hint}</span>}
      {children}
      <button type="submit" className="button-primary text-xs">
        Apply
      </button>
      <button type="button" className="text-xs text-[color:var(--muted)]" onClick={onCancel}>
        Cancel
      </button>
    </form>
  );
}

function defaultCancelDate(subs: Subscription[]): string {
  // 1 day before the soonest nextBillingDate.
  let earliest = "";
  for (const sub of subs) {
    if (!earliest || sub.nextBillingDate < earliest) earliest = sub.nextBillingDate;
  }
  if (!earliest) return new Date().toISOString().slice(0, 10);
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(earliest);
  if (!match) return new Date().toISOString().slice(0, 10);
  const d = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
}
