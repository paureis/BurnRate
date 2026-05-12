"use client";

import { Check, Plus, Search, X } from "lucide-react";
import { useMemo, useState } from "react";
import { clsx } from "clsx";
import { addDaysDateInputValue, billingCycles, formatCents, type BillingCycle, type Subscription } from "@/lib/burnrate";
import { iconMap } from "./shared";
import { popularServices, type PopularService } from "@/data/popular-services";

export interface PopularServiceAdd {
  name: string;
  costCents: number;
  billingCycle: BillingCycle;
  category: string;
  nextBillingDate: string;
  color: string;
  icon: string;
}

function isAlreadyAdded(name: string, existing: Subscription[]): boolean {
  const target = name.toLowerCase();
  return existing.some((subscription) => subscription.name.toLowerCase() === target);
}

export function PopularServicesPicker({
  existing,
  onAdd,
}: {
  existing: Subscription[];
  onAdd: (payload: PopularServiceAdd) => void;
}) {
  const [query, setQuery] = useState("");
  const [activeName, setActiveName] = useState<string | null>(null);

  const visible = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) {
      return popularServices;
    }
    return popularServices.filter(
      (service) =>
        service.name.toLowerCase().includes(normalized) ||
        service.category.toLowerCase().includes(normalized),
    );
  }, [query]);

  return (
    <section className="panel p-5" aria-label="Popular services picker">
      <div className="mb-4">
        <h2 className="text-xl font-extrabold">Add from popular services</h2>
        <p className="text-sm text-[color:var(--muted)]">Tap a service, adjust price, and confirm. Already-added services are dimmed.</p>
      </div>

      <label className="label mb-3 block">
        Search popular services
        <span className="relative">
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[color:var(--subtle)]"
            size={17}
          />
          <input
            className="input pl-10"
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Filter by service or category"
          />
        </span>
      </label>

      {visible.length > 0 ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" role="list">
          {visible.map((service) => {
            const added = isAlreadyAdded(service.name, existing);
            const isActive = activeName === service.name;
            return (
              <div key={service.name} role="listitem" className="grid gap-2">
                <ServiceTile
                  active={isActive}
                  added={added}
                  service={service}
                  onClick={() => setActiveName(isActive ? null : service.name)}
                />
                {isActive && !added && (
                  <ServiceForm
                    service={service}
                    onCancel={() => setActiveName(null)}
                    onAdd={(payload) => {
                      onAdd(payload);
                      setActiveName(null);
                    }}
                  />
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <p className="rounded-panel border border-[color:var(--line)] bg-[color:var(--panel-strong)] p-4 text-sm font-bold text-[color:var(--muted)]">
          No popular services match that filter.
        </p>
      )}
    </section>
  );
}

function ServiceTile({
  active,
  added,
  onClick,
  service,
}: {
  active: boolean;
  added: boolean;
  onClick: () => void;
  service: PopularService;
}) {
  const Icon = iconMap[service.icon] ?? iconMap.wallet;
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={added}
      aria-pressed={active}
      className={clsx(
        "grid w-full grid-cols-[auto_1fr_auto] items-center gap-3 rounded-panel border border-[color:var(--line)] bg-[color:var(--panel-strong)] p-3 text-left transition",
        active && !added && "border-[color:var(--accent-2)]",
        added && "opacity-50",
      )}
    >
      <span
        className="grid h-11 w-11 shrink-0 place-items-center rounded-panel border border-[color:var(--line)]"
        style={{ background: `${service.color}22`, color: service.color }}
      >
        <Icon aria-hidden="true" size={20} />
      </span>
      <span className="min-w-0">
        <span className="block truncate font-extrabold">{service.name}</span>
        <span className="block truncate text-xs font-bold uppercase tracking-[0.16em] text-[color:var(--muted)]">
          {service.category}
        </span>
        <span className="mt-1 block text-sm font-bold text-[color:var(--muted)]">
          {formatCents(service.defaultCents)} / {service.defaultBillingCycle}
        </span>
      </span>
      {added ? (
        <span
          className="rounded-full bg-[color:var(--accent-3)] px-2 py-1 text-xs font-extrabold text-[#0f1115]"
          aria-label={`${service.name} already added`}
        >
          Added
        </span>
      ) : (
        <Plus aria-hidden="true" size={18} className="text-[color:var(--accent)]" />
      )}
    </button>
  );
}

function ServiceForm({
  onAdd,
  onCancel,
  service,
}: {
  onAdd: (payload: PopularServiceAdd) => void;
  onCancel: () => void;
  service: PopularService;
}) {
  const [cost, setCost] = useState((service.defaultCents / 100).toFixed(2));
  const [billingCycle, setBillingCycle] = useState<BillingCycle>(service.defaultBillingCycle);
  const [nextBillingDate, setNextBillingDate] = useState(addDaysDateInputValue(30));
  const [error, setError] = useState("");

  function submit() {
    const cents = Math.round(Number.parseFloat(cost.replace(/[^0-9.\-]/g, "")) * 100);
    if (!Number.isFinite(cents) || cents <= 0) {
      setError("Enter a cost greater than $0.");
      return;
    }
    if (!nextBillingDate) {
      setError("Pick a renewal date.");
      return;
    }
    setError("");
    onAdd({
      name: service.name,
      costCents: cents,
      billingCycle,
      category: service.category,
      nextBillingDate,
      color: service.color,
      icon: service.icon,
    });
  }

  return (
    <form
      className="grid gap-3 rounded-panel border border-[color:var(--accent-2)] bg-[color:var(--panel)] p-4"
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      <div className="grid gap-2 sm:grid-cols-3">
        <label className="label">
          Cost
          <input
            className="input"
            inputMode="decimal"
            value={cost}
            onChange={(event) => setCost(event.target.value)}
            placeholder="9.99"
            aria-label={`${service.name} cost`}
          />
        </label>
        <label className="label">
          Billing
          <select
            className="input"
            value={billingCycle}
            onChange={(event) => setBillingCycle(event.target.value as BillingCycle)}
            aria-label={`${service.name} billing cycle`}
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
            value={nextBillingDate}
            onChange={(event) => setNextBillingDate(event.target.value)}
            aria-label={`${service.name} next billing date`}
          />
        </label>
      </div>
      {error && (
        <p className="rounded-panel border border-[color:var(--danger)] bg-[color:var(--panel-strong)] p-2 text-xs font-bold text-[color:var(--danger)]" role="alert">
          {error}
        </p>
      )}
      <div className="flex gap-2">
        <button className="button-primary" type="submit">
          <Check aria-hidden="true" size={16} />
          Add {service.name}
        </button>
        <button className="button-secondary" type="button" onClick={onCancel}>
          <X aria-hidden="true" size={16} />
          Cancel
        </button>
      </div>
    </form>
  );
}
