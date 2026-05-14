"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Search } from "lucide-react";
import { clsx } from "clsx";
import type { Subscription, Trial } from "@/lib/burnrate";
import { monthlyCostInBaseCents } from "@/lib/burnrate";
import type { FxContext } from "@/lib/currency";
import {
  PALETTE_OPERATOR_HELP,
  describeParsedQuery,
  hasActiveFilters,
  parsePaletteQuery,
} from "@/lib/palette-query";

export interface CommandItem {
  id: string;
  label: string;
  hint?: string;
  keywords?: string;
  action: () => void;
  /**
   * Optional metadata used by the v4 search-operator filter. When `meta.sub`
   * is present, operators like `cost:>20` or `cycle:yearly` apply to it.
   * When `meta.trial` is present, the `trial:` operator surfaces it.
   * Commands without `meta` are not gated by operators (they always match
   * when the free text portion of the query is empty).
   */
  meta?: { sub?: Subscription; trial?: Trial };
}

export function scoreCommand(command: CommandItem, query: string): number {
  if (!query) return 1;
  const haystack = `${command.label} ${command.keywords ?? ""}`.toLowerCase();
  const needle = query.toLowerCase();
  if (haystack.startsWith(needle)) return 100;
  if (command.label.toLowerCase().startsWith(needle)) return 90;
  if (haystack.includes(needle)) return 50;
  // light fuzzy: each char of needle appears in haystack in order
  let cursor = 0;
  for (const char of needle) {
    const found = haystack.indexOf(char, cursor);
    if (found === -1) return 0;
    cursor = found + 1;
  }
  return 10;
}

export function rankCommands(commands: CommandItem[], query: string, fx?: FxContext): CommandItem[] {
  if (!query) return commands.slice(0, 50);
  const parsed = parsePaletteQuery(query);
  const filtersActive = hasActiveFilters(parsed);
  const freeText = parsed.freeText;
  const filtered = filtersActive
    ? commands.filter((command) => operatorsMatch(command, parsed, fx))
    : commands;
  if (!freeText) return filtered.slice(0, 50);
  return filtered
    .map((command) => ({ command, score: scoreCommand(command, freeText) }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 50)
    .map((entry) => entry.command);
}

function operatorsMatch(
  command: CommandItem,
  parsed: ReturnType<typeof parsePaletteQuery>,
  fx?: FxContext,
): boolean {
  const filters = parsed.filters;
  const sub = command.meta?.sub;
  const trial = command.meta?.trial;
  // Commands without record metadata bypass operators (so app actions like
  // "Open dashboard" remain reachable when the user types `cost:>20`).
  if (!sub && !trial) return true;

  if (filters.trialsOnly && !trial) return false;
  if (sub) {
    if (filters.cycles && filters.cycles.length > 0 && !filters.cycles.includes(sub.billingCycle)) return false;
    if (filters.tags && filters.tags.length > 0) {
      const tags = new Set((sub.tags ?? []).map((t) => t.toLowerCase()));
      if (!filters.tags.every((required) => tags.has(required.toLowerCase()))) return false;
    }
    if (filters.categories && filters.categories.length > 0 && !filters.categories.includes(sub.category)) {
      return false;
    }
    if (filters.currencies && filters.currencies.length > 0) {
      const cur = (sub.currency ?? "USD").toUpperCase();
      if (!filters.currencies.some((code) => code.toUpperCase() === cur)) return false;
    }
    if (filters.cancellingOnly && !sub.cancellingOn) return false;
    if (filters.costMinCents !== undefined || filters.costMaxCents !== undefined) {
      const monthly = monthlyCostInBaseCents(sub, fx);
      if (filters.costMinCents !== undefined && monthly < filters.costMinCents) return false;
      if (filters.costMaxCents !== undefined && monthly > filters.costMaxCents) return false;
    }
  }
  return true;
}

export function CommandPalette({
  open,
  onClose,
  commands,
  fx,
}: {
  open: boolean;
  onClose: () => void;
  commands: CommandItem[];
  fx?: FxContext;
}) {
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const [helpOpen, setHelpOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const previousActive = useRef<HTMLElement | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  const filtered = useMemo(() => rankCommands(commands, query, fx), [commands, query, fx]);
  const parsedSummary = useMemo(() => {
    const parsed = parsePaletteQuery(query);
    return hasActiveFilters(parsed) ? describeParsedQuery(parsed) : "";
  }, [query]);

  useEffect(() => {
    setActive(0);
  }, [query, open]);

  useEffect(() => {
    if (!open) {
      setQuery("");
      previousActive.current?.focus?.();
      return;
    }
    previousActive.current = document.activeElement as HTMLElement | null;
    setTimeout(() => inputRef.current?.focus(), 0);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key === "ArrowDown") {
        event.preventDefault();
        setActive((current) => Math.min(filtered.length - 1, current + 1));
        return;
      }
      if (event.key === "ArrowUp") {
        event.preventDefault();
        setActive((current) => Math.max(0, current - 1));
        return;
      }
      if (event.key === "Tab") {
        event.preventDefault();
        setActive((current) => (current + 1) % Math.max(1, filtered.length));
        return;
      }
      if (event.key === "Enter") {
        event.preventDefault();
        const target = filtered[active];
        if (target) {
          target.action();
          onClose();
        }
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [active, filtered, onClose, open]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Command palette"
      className="fixed inset-0 z-[110] grid place-items-start bg-black/60 p-4 pt-[10vh]"
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        ref={dialogRef}
        className="w-full max-w-xl rounded-panel border border-[color:var(--line)] bg-[color:var(--panel)] shadow-2xl"
      >
        <div className="flex items-center gap-2 border-b border-[color:var(--line)] p-3">
          <Search aria-hidden="true" size={17} className="text-[color:var(--muted)]" />
          <input
            ref={inputRef}
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Type a command…"
            aria-label="Search commands"
            className="w-full bg-transparent text-base font-bold outline-none placeholder:text-[color:var(--subtle)]"
          />
        </div>
        {parsedSummary && (
          <div className="border-b border-[color:var(--line)] bg-[color:var(--panel-strong)] px-3 py-2 text-xs font-bold text-[color:var(--accent-2)]">
            {parsedSummary}
          </div>
        )}
        <ul role="listbox" className="max-h-[60vh] overflow-auto p-2">
          {filtered.length === 0 ? (
            <li className="px-3 py-4 text-sm font-bold text-[color:var(--muted)]">No commands match.</li>
          ) : (
            filtered.map((command, index) => (
              <li key={command.id} role="option" aria-selected={index === active}>
                <button
                  type="button"
                  className={clsx(
                    "flex w-full items-center justify-between gap-3 rounded-panel border border-transparent px-3 py-2 text-left transition",
                    index === active
                      ? "border-[color:var(--accent-2)] bg-[color:var(--panel-strong)]"
                      : "hover:bg-[color:var(--panel-strong)]",
                  )}
                  onMouseEnter={() => setActive(index)}
                  onClick={() => {
                    command.action();
                    onClose();
                  }}
                >
                  <span className="font-extrabold">{command.label}</span>
                  {command.hint && (
                    <span className="text-xs font-bold text-[color:var(--muted)]">{command.hint}</span>
                  )}
                </button>
              </li>
            ))
          )}
        </ul>
        <div className="border-t border-[color:var(--line)] px-3 py-2">
          <div className="flex items-center justify-between text-xs font-bold text-[color:var(--muted)]">
            <span>↑↓ navigate · ↵ select · esc close</span>
            <button
              type="button"
              className="rounded px-2 py-1 text-[color:var(--accent-2)] hover:bg-[color:var(--panel-strong)]"
              onClick={() => setHelpOpen((current) => !current)}
            >
              {helpOpen ? "Hide operators" : "Show operators"}
            </button>
          </div>
          {helpOpen && (
            <ul className="mt-2 grid gap-1 text-xs font-bold">
              {PALETTE_OPERATOR_HELP.map((entry) => (
                <li key={entry.syntax} className="flex items-baseline gap-2">
                  <code className="rounded bg-[color:var(--panel-strong)] px-1.5 py-0.5 text-[color:var(--accent)]">
                    {entry.syntax}
                  </code>
                  <span className="text-[color:var(--muted)]">{entry.description}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
