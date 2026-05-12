"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Search } from "lucide-react";
import { clsx } from "clsx";

export interface CommandItem {
  id: string;
  label: string;
  hint?: string;
  keywords?: string;
  action: () => void;
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

export function rankCommands(commands: CommandItem[], query: string): CommandItem[] {
  if (!query) return commands.slice(0, 50);
  return commands
    .map((command) => ({ command, score: scoreCommand(command, query) }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 50)
    .map((entry) => entry.command);
}

export function CommandPalette({
  open,
  onClose,
  commands,
}: {
  open: boolean;
  onClose: () => void;
  commands: CommandItem[];
}) {
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const previousActive = useRef<HTMLElement | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  const filtered = useMemo(() => rankCommands(commands, query), [commands, query]);

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
        <p className="border-t border-[color:var(--line)] px-3 py-2 text-xs font-bold text-[color:var(--muted)]">
          ↑↓ navigate · ↵ select · esc close
        </p>
      </div>
    </div>
  );
}
