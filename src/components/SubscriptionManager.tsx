"use client";

import { CalendarX, ListFilter, Pencil, Plus, RotateCcw, Save, Search, Trash2, WalletCards, X } from "lucide-react";
import { clsx } from "clsx";
import {
  billingCycles,
  defaultCategories,
  defaultCategoryColors,
  formatCents,
  monthlyCostCents,
  monthlyCostInBaseCents,
  type BillingCycle,
  type Subscription,
} from "@/lib/burnrate";
import { supportedCurrencies } from "@/data/fx-rates";
import { formatMoney, type FxContext } from "@/lib/currency";
import { EmptyState } from "./EmptyState";
import { TagInput } from "./TagInput";
import { PriceChangeEditor } from "./PriceChangeEditor";
import { daysUntilDate, iconMap, iconOptions, type SortKey, type SubscriptionDraft } from "./shared";

export function SubscriptionManager({
  categoryFilter,
  categoryOptions,
  deleteSubscription,
  draft,
  editingDraft,
  editingId,
  fx,
  knownTags,
  onAdd,
  onCancelEdit,
  onCancelSubscription,
  onUndoCancellation,
  onDraftChange,
  onEditDraftChange,
  onSaveEdit,
  onStartEdit,
  searchQuery,
  selectedIds,
  onToggleSelect,
  onSelectAll,
  setCategoryFilter,
  setSearchQuery,
  setSortKey,
  sortKey,
  subscriptions,
}: {
  categoryFilter: string;
  categoryOptions: string[];
  deleteSubscription: (id: string) => void;
  draft: SubscriptionDraft;
  editingDraft: SubscriptionDraft;
  editingId: string | null;
  fx: FxContext;
  knownTags?: string[];
  onAdd: () => void;
  onCancelEdit: () => void;
  onCancelSubscription: (id: string, isoDate: string) => void;
  onUndoCancellation: (id: string) => void;
  onDraftChange: (draft: SubscriptionDraft) => void;
  onEditDraftChange: (draft: SubscriptionDraft) => void;
  onSaveEdit: () => void;
  onStartEdit: (subscription: Subscription) => void;
  searchQuery: string;
  selectedIds?: ReadonlySet<string>;
  onToggleSelect?: (id: string, shiftKey: boolean) => void;
  onSelectAll?: (selectAll: boolean) => void;
  setCategoryFilter: (value: string) => void;
  setSearchQuery: (value: string) => void;
  setSortKey: (value: SortKey) => void;
  sortKey: SortKey;
  subscriptions: Subscription[];
}) {
  const allSelected = !!selectedIds && subscriptions.length > 0 && subscriptions.every((sub) => selectedIds.has(sub.id));
  const someSelected = !!selectedIds && subscriptions.some((sub) => selectedIds.has(sub.id)) && !allSelected;
  return (
    <div className="grid gap-4">
      <section className="panel p-5">
        <div className="mb-4 flex items-center gap-2">
          <Plus aria-hidden="true" className="text-[color:var(--accent)]" size={20} />
          <h2 className="text-xl font-extrabold">Add subscription</h2>
        </div>
        <SubscriptionForm
          buttonLabel="Add subscription"
          draft={draft}
          idPrefix="add-subscription"
          knownTags={knownTags}
          onChange={onDraftChange}
          onSubmit={onAdd}
        />
      </section>

      <section className="panel p-5">
        <div className="mb-4 grid gap-3 lg:grid-cols-[1fr_auto_auto]">
          <label className="label">
            Search
            <span className="relative">
              <Search
                aria-hidden="true"
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[color:var(--subtle)]"
                size={17}
              />
              <input
                className="input pl-10"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Service or category"
                type="search"
              />
            </span>
          </label>
          <label className="label min-w-48">
            Filter
            <select
              className="input"
              value={categoryFilter}
              onChange={(event) => setCategoryFilter(event.target.value)}
            >
              <option value="all">All categories</option>
              {categoryOptions.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
          </label>
          <label className="label min-w-48">
            Sort
            <select className="input" value={sortKey} onChange={(event) => setSortKey(event.target.value as SortKey)}>
              <option value="nextBillingDate">Next billing</option>
              <option value="cost">Cost</option>
              <option value="name">Name</option>
              <option value="category">Category</option>
            </select>
          </label>
        </div>

        {subscriptions.length > 0 ? (
          <div className="grid gap-3">
            {onSelectAll && (
              <label className="flex items-center gap-2 px-1 text-xs font-bold text-[color:var(--muted)]">
                <input
                  type="checkbox"
                  checked={allSelected}
                  ref={(node) => {
                    if (node) node.indeterminate = someSelected;
                  }}
                  onChange={(event) => onSelectAll(event.target.checked)}
                />
                Select all ({subscriptions.length})
              </label>
            )}
            {subscriptions.map((subscription) =>
              editingId === subscription.id ? (
                <div key={subscription.id} className="rounded-panel border border-[color:var(--accent-2)] p-4">
                  <SubscriptionForm
                    buttonLabel="Save changes"
                    draft={editingDraft}
                    idPrefix={`edit-${subscription.id}`}
                    knownTags={knownTags}
                    onCancel={onCancelEdit}
                    onChange={onEditDraftChange}
                    onSubmit={onSaveEdit}
                  />
                </div>
              ) : (
                <SubscriptionRow
                  key={subscription.id}
                  deleteSubscription={deleteSubscription}
                  fx={fx}
                  onCancelSubscription={onCancelSubscription}
                  onStartEdit={onStartEdit}
                  onUndoCancellation={onUndoCancellation}
                  subscription={subscription}
                  selected={selectedIds?.has(subscription.id)}
                  onToggleSelect={onToggleSelect}
                />
              ),
            )}
          </div>
        ) : (
          <EmptyState
            Icon={ListFilter}
            title="No subscriptions match"
            body="Adjust filters or add a recurring charge."
          />
        )}
      </section>
    </div>
  );
}

export function SubscriptionForm({
  buttonLabel,
  draft,
  idPrefix,
  knownTags,
  onCancel,
  onChange,
  onSubmit,
}: {
  buttonLabel: string;
  draft: SubscriptionDraft;
  idPrefix: string;
  knownTags?: string[];
  onCancel?: () => void;
  onChange: (draft: SubscriptionDraft) => void;
  onSubmit: () => void;
}) {
  const categoryListId = `${idPrefix}-categories`;

  return (
    <form
      className="grid gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
    >
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <label className="label">
          Service name
          <input
            id={`${idPrefix}-name`}
            className="input"
            value={draft.name}
            onChange={(event) => onChange({ ...draft, name: event.target.value })}
            placeholder="Spotify"
          />
        </label>
        <label className="label">
          Cost
          <input
            className="input"
            inputMode="decimal"
            value={draft.cost}
            onChange={(event) => onChange({ ...draft, cost: event.target.value })}
            placeholder="12.99"
          />
        </label>
        <label className="label">
          Billing cycle
          <select
            className="input"
            value={draft.billingCycle}
            onChange={(event) => onChange({ ...draft, billingCycle: event.target.value as BillingCycle })}
          >
            {billingCycles.map((cycle) => (
              <option key={cycle} value={cycle}>
                {cycle}
              </option>
            ))}
          </select>
        </label>
        <label className="label">
          Next billing
          <input
            className="input"
            type="date"
            value={draft.nextBillingDate}
            onChange={(event) => onChange({ ...draft, nextBillingDate: event.target.value })}
          />
        </label>
      </div>

      <div className="grid gap-3 md:grid-cols-[1fr_auto_auto_auto]">
        <label className="label">
          Category
          <input
            className="input"
            list={categoryListId}
            value={draft.category}
            onChange={(event) => onChange({ ...draft, category: event.target.value })}
          />
          <datalist id={categoryListId}>
            {defaultCategories.map((category) => (
              <option key={category} value={category} />
            ))}
          </datalist>
        </label>
        <label className="label min-w-28">
          Currency
          <select
            className="input"
            value={draft.currency}
            onChange={(event) => onChange({ ...draft, currency: event.target.value })}
          >
            {supportedCurrencies.map((code) => (
              <option key={code} value={code}>
                {code}
              </option>
            ))}
          </select>
        </label>
        <label className="label min-w-32">
          Color
          <input
            className="input h-[46px] p-1"
            type="color"
            value={draft.color}
            onChange={(event) => onChange({ ...draft, color: event.target.value })}
          />
        </label>
        <label className="label min-w-40">
          Icon
          <select className="input" value={draft.icon} onChange={(event) => onChange({ ...draft, icon: event.target.value })}>
            {iconOptions.map((icon) => (
              <option key={icon.value} value={icon.value}>
                {icon.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label className="label">
        Notes
        <textarea
          className="input min-h-24 resize-y"
          value={draft.notes}
          onChange={(event) => onChange({ ...draft, notes: event.target.value })}
          placeholder="Plan details, cancellation path, shared account..."
        />
      </label>

      <div className="label">
        <span>Tags</span>
        <TagInput
          tags={draft.tags}
          knownTags={knownTags}
          onChange={(tags) => onChange({ ...draft, tags })}
          placeholder="Press enter or comma to add"
        />
      </div>

      <PriceChangeEditor
        changes={draft.priceChanges}
        currency={draft.currency}
        onChange={(priceChanges) => onChange({ ...draft, priceChanges })}
      />

      <div className="flex flex-wrap gap-2">
        <button className="button-primary" type="submit">
          <Save aria-hidden="true" size={17} />
          {buttonLabel}
        </button>
        {onCancel && (
          <button className="button-secondary" type="button" onClick={onCancel}>
            <X aria-hidden="true" size={17} />
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}

export function SubscriptionRow({
  deleteSubscription,
  fx,
  onCancelSubscription,
  onStartEdit,
  onUndoCancellation,
  subscription,
  selected,
  onToggleSelect,
}: {
  deleteSubscription: (id: string) => void;
  fx: FxContext;
  onCancelSubscription: (id: string, isoDate: string) => void;
  onStartEdit: (subscription: Subscription) => void;
  onUndoCancellation: (id: string) => void;
  subscription: Subscription;
  selected?: boolean;
  onToggleSelect?: (id: string, shiftKey: boolean) => void;
}) {
  const daysUntil = daysUntilDate(subscription.nextBillingDate);
  const isSoon = daysUntil >= 0 && daysUntil <= 7;
  const subCurrency = subscription.currency ?? fx.baseCurrency;
  const monthlyNative = monthlyCostCents(subscription);
  const monthlyBase = monthlyCostInBaseCents(subscription, fx);
  const showBase = subCurrency !== fx.baseCurrency;
  const isCancelling = Boolean(subscription.cancellingOn);

  return (
    <article
      className={clsx(
        "grid gap-4 rounded-panel border border-[color:var(--line)] bg-[color:var(--panel-strong)] p-4 transition md:grid-cols-[1fr_auto_auto]",
        isSoon && !isCancelling && "border-[color:var(--accent)] shadow-glow",
        isCancelling && "border-[color:var(--accent-2)] opacity-90",
        selected && "outline outline-2 outline-[color:var(--accent)]",
      )}
    >
      <div className="flex min-w-0 gap-3">
        {onToggleSelect && (
          <input
            type="checkbox"
            className="mt-1 h-4 w-4 shrink-0"
            checked={selected ?? false}
            aria-label={`Select ${subscription.name}`}
            onClick={(event) => onToggleSelect(subscription.id, event.shiftKey)}
            onChange={() => {/* handled by onClick to capture shiftKey */}}
          />
        )}
        <SubscriptionGlyph subscription={subscription} />
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className={clsx("truncate text-lg font-extrabold", isCancelling && "line-through")}>
              {subscription.name}
            </h3>
            {isSoon && !isCancelling && (
              <span className="rounded-full bg-[color:var(--accent)] px-2 py-1 text-xs font-extrabold text-[#140b08]">
                {daysUntil === 0 ? "Today" : `${daysUntil}d`}
              </span>
            )}
            {isCancelling && (
              <span className="rounded-full border border-[color:var(--accent-2)] bg-[color:var(--panel)] px-2 py-1 text-xs font-extrabold text-[color:var(--accent-2)]">
                Cancelling {subscription.cancellingOn}
              </span>
            )}
          </div>
          <p className="text-sm text-[color:var(--muted)]">
            {subscription.category} - renews {subscription.nextBillingDate}
          </p>
          {subscription.tags && subscription.tags.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {subscription.tags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-full bg-[color:var(--panel)] px-2 py-0.5 text-xs font-extrabold text-[color:var(--accent-2)]"
                >
                  #{tag}
                </span>
              ))}
            </div>
          )}
          {subscription.notes && <p className="mt-2 text-sm text-[color:var(--subtle)]">{subscription.notes}</p>}
        </div>
      </div>
      <div className="grid content-center gap-1 text-left md:text-right">
        <p className={clsx("text-2xl font-extrabold", isCancelling && "line-through opacity-70")}>
          {formatMoney(monthlyNative, subCurrency)}/mo
        </p>
        {showBase && (
          <p className="text-xs font-bold text-[color:var(--subtle)]">
            ≈ {formatMoney(monthlyBase, fx.baseCurrency)}/mo
          </p>
        )}
        <p className="text-sm text-[color:var(--muted)]">
          {formatMoney(subscription.costCents, subCurrency)} {subscription.billingCycle}
        </p>
      </div>
      <div className="flex items-center gap-2 md:justify-end">
        {isCancelling ? (
          <button
            className="icon-button"
            type="button"
            aria-label={`Undo cancellation of ${subscription.name}`}
            onClick={() => onUndoCancellation(subscription.id)}
          >
            <RotateCcw aria-hidden="true" size={17} />
          </button>
        ) : (
          <CancelOnButton subscription={subscription} onConfirm={(date) => onCancelSubscription(subscription.id, date)} />
        )}
        <button className="icon-button" type="button" aria-label={`Edit ${subscription.name}`} onClick={() => onStartEdit(subscription)}>
          <Pencil aria-hidden="true" size={17} />
        </button>
        <button className="icon-button" type="button" aria-label={`Delete ${subscription.name}`} onClick={() => deleteSubscription(subscription.id)}>
          <Trash2 aria-hidden="true" size={17} />
        </button>
      </div>
    </article>
  );
}

function CancelOnButton({
  subscription,
  onConfirm,
}: {
  subscription: Subscription;
  onConfirm: (isoDate: string) => void;
}) {
  // Default date: nextBillingDate minus 1 day (so it cancels before charge).
  const defaultDate = (() => {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(subscription.nextBillingDate);
    if (!match) return new Date().toISOString().slice(0, 10);
    const d = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
    d.setDate(d.getDate() - 1);
    return d.toISOString().slice(0, 10);
  })();

  return (
    <details className="relative">
      <summary
        className="icon-button list-none cursor-pointer"
        aria-label={`Schedule cancellation for ${subscription.name}`}
        role="button"
      >
        <CalendarX aria-hidden="true" size={17} />
      </summary>
      <form
        className="absolute right-0 z-10 mt-2 grid w-56 gap-2 rounded-panel border border-[color:var(--line)] bg-[color:var(--panel)] p-3 shadow-2xl"
        onSubmit={(event) => {
          event.preventDefault();
          const form = event.currentTarget as HTMLFormElement;
          const input = form.querySelector<HTMLInputElement>("input[type='date']");
          if (input?.value) onConfirm(input.value);
        }}
      >
        <label className="label text-xs">
          Cancel on
          <input className="input" type="date" defaultValue={defaultDate} />
        </label>
        <button className="button-primary text-xs" type="submit">
          Schedule
        </button>
      </form>
    </details>
  );
}

export function SubscriptionGlyph({ subscription }: { subscription: Subscription }) {
  const Icon = iconMap[subscription.icon ?? "wallet"] ?? WalletCards;
  const color = subscription.color ?? defaultCategoryColors[subscription.category] ?? "var(--accent)";
  return (
    <span
      className="grid h-11 w-11 shrink-0 place-items-center rounded-panel border border-[color:var(--line)]"
      style={{ background: `${color}22`, color }}
    >
      <Icon aria-hidden="true" size={20} />
    </span>
  );
}
