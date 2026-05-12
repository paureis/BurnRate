"use client";

import { useEffect, useRef } from "react";
import { AlertTriangle, Check, X } from "lucide-react";
import type { SyncSummary } from "@/lib/sync";

export type SyncDecision = "merge" | "replace" | "cancel";

export function SyncModal({
  open,
  summary,
  error,
  onDecision,
}: {
  open: boolean;
  summary: SyncSummary | null;
  error: string | null;
  onDecision: (decision: SyncDecision) => void;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    const root = dialogRef.current;
    const button = root?.querySelector<HTMLButtonElement>("button");
    button?.focus();

    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onDecision("cancel");
      }
    }

    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      previous?.focus?.();
    };
  }, [open, onDecision]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="sync-modal-title"
      className="fixed inset-0 z-[100] grid place-items-center bg-black/60 p-4"
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          onDecision("cancel");
        }
      }}
    >
      <div
        ref={dialogRef}
        className="w-full max-w-lg rounded-panel border border-[color:var(--line)] bg-[color:var(--panel)] p-5 shadow-2xl"
      >
        <div className="mb-2 flex items-center gap-2">
          <AlertTriangle aria-hidden="true" className="text-[color:var(--accent-2)]" size={20} />
          <h2 id="sync-modal-title" className="text-xl font-extrabold">
            BurnRate sync payload
          </h2>
        </div>
        {error ? (
          <p className="rounded-panel border border-[color:var(--danger)] bg-[color:var(--panel-strong)] p-3 text-sm font-bold text-[color:var(--danger)]">
            {error}
          </p>
        ) : summary ? (
          <p className="text-sm text-[color:var(--muted)]">
            This link includes <strong>{summary.subscriptionsCount}</strong> subscriptions and{" "}
            <strong>{summary.trialsCount}</strong> trials. How should we apply it?
          </p>
        ) : null}

        <div className="mt-4 flex flex-wrap gap-2">
          {!error && (
            <>
              <button className="button-primary" type="button" onClick={() => onDecision("merge")}>
                <Check aria-hidden="true" size={16} />
                Merge into my data
              </button>
              <button
                className="button-secondary"
                type="button"
                onClick={() => {
                  if (window.confirm("Replace ALL of your existing BurnRate data with this payload?")) {
                    onDecision("replace");
                  }
                }}
              >
                Replace my data
              </button>
            </>
          )}
          <button className="button-secondary" type="button" onClick={() => onDecision("cancel")}>
            <X aria-hidden="true" size={16} />
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
