"use client";

import { useState } from "react";
import { Clock, RotateCcw, X } from "lucide-react";
import {
  dropEntry,
  isUndoable,
  normalizeHistory,
  type HistoryEntry,
} from "@/lib/history";

interface HistoryDrawerProps {
  open: boolean;
  entries: HistoryEntry[];
  onClose: () => void;
  onUndo: (entry: HistoryEntry) => void;
  onClear?: () => void;
}

export function HistoryDrawer({ open, entries, onClose, onUndo, onClear }: HistoryDrawerProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  if (!open) return null;
  const sorted = [...normalizeHistory(entries)].sort((a, b) => b.ts.localeCompare(a.ts));

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Audit log"
      className="fixed inset-0 z-30 grid place-items-end bg-black/40"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <aside className="flex h-full w-full max-w-md flex-col overflow-y-auto bg-[color:var(--panel)] p-5 shadow-2xl">
        <header className="mb-4 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Clock aria-hidden="true" className="text-[color:var(--accent-2)]" size={20} />
            <h2 className="font-display text-3xl leading-none">History</h2>
          </div>
          <button type="button" className="icon-button" aria-label="Close" onClick={onClose}>
            <X aria-hidden="true" size={18} />
          </button>
        </header>

        {sorted.length === 0 ? (
          <p className="text-sm text-[color:var(--muted)]">No actions yet — your edits appear here as you make them.</p>
        ) : (
          <ul className="grid gap-2">
            {sorted.map((entry) => (
              <li
                key={entry.id}
                className="rounded-panel border border-[color:var(--line)] bg-[color:var(--panel-strong)] p-3"
              >
                <p className="text-xs text-[color:var(--muted)]">{formatTs(entry.ts)} · {entry.op}</p>
                <p className="font-extrabold">{entry.summary}</p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    className="text-xs font-extrabold text-[color:var(--accent-2)] disabled:text-[color:var(--muted)]"
                    disabled={!isUndoable(entry)}
                    onClick={() => onUndo(entry)}
                    title={isUndoable(entry) ? undefined : "Payload too large to undo."}
                  >
                    <RotateCcw aria-hidden="true" size={12} className="inline" />
                    {" "}Undo
                  </button>
                  <button
                    type="button"
                    className="text-xs text-[color:var(--muted)]"
                    onClick={() => setExpandedId((current) => (current === entry.id ? null : entry.id))}
                  >
                    {expandedId === entry.id ? "Hide details" : "Show details"}
                  </button>
                </div>
                {expandedId === entry.id && (
                  <pre className="mt-2 max-h-40 overflow-auto rounded bg-[color:var(--panel)] p-2 text-[10px] leading-tight">
                    {JSON.stringify({ before: entry.before, after: entry.after }, null, 2)}
                  </pre>
                )}
              </li>
            ))}
          </ul>
        )}

        {onClear && sorted.length > 0 && (
          <button type="button" className="button-ghost mt-4 text-xs" onClick={onClear}>
            Clear log
          </button>
        )}
      </aside>
    </div>
  );
}

function formatTs(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString();
}

export { dropEntry };
