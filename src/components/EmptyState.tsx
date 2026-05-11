"use client";

import { Plus, type LucideIcon } from "lucide-react";

export function EmptyState({
  Icon,
  actionLabel,
  body,
  onAction,
  title,
}: {
  Icon: LucideIcon;
  actionLabel?: string;
  body: string;
  onAction?: () => void;
  title: string;
}) {
  return (
    <div className="grid min-h-56 place-items-center rounded-panel border border-dashed border-[color:var(--line)] bg-[color:var(--panel-strong)] p-6 text-center">
      <div className="max-w-sm">
        <Icon aria-hidden="true" className="mx-auto mb-4 text-[color:var(--accent)]" size={32} />
        <h3 className="text-lg font-extrabold">{title}</h3>
        <p className="mt-2 text-sm text-[color:var(--muted)]">{body}</p>
        {actionLabel && onAction && (
          <button className="button-primary mt-4" type="button" onClick={onAction}>
            <Plus aria-hidden="true" size={17} />
            {actionLabel}
          </button>
        )}
      </div>
    </div>
  );
}
