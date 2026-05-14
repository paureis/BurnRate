"use client";

import { useState } from "react";
import { clsx } from "clsx";
import { Bookmark, BookmarkPlus, MoreHorizontal, Trash2 } from "lucide-react";
import { isBuiltinView, type SavedView } from "@/lib/views";

interface SavedViewsPillsProps {
  views: SavedView[];
  activeViewId: string | null;
  onSelect: (viewId: string) => void;
  onClear: () => void;
  onSave: (name: string) => void;
  onDelete: (viewId: string) => void;
}

export function SavedViewsPills({
  views,
  activeViewId,
  onSelect,
  onClear,
  onSave,
  onDelete,
}: SavedViewsPillsProps) {
  const [saveOpen, setSaveOpen] = useState(false);
  const [draftName, setDraftName] = useState("");

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        className={clsx(
          "rounded-full border px-3 py-1 text-xs font-extrabold transition",
          activeViewId === null
            ? "border-[color:var(--accent)] bg-[color:var(--panel-strong)] text-[color:var(--text)]"
            : "border-[color:var(--line)] text-[color:var(--muted)] hover:border-[color:var(--accent-2)]",
        )}
        onClick={onClear}
      >
        All
      </button>
      {views.map((view) => {
        const active = view.id === activeViewId;
        const builtIn = isBuiltinView(view);
        return (
          <div key={view.id} className="flex items-center gap-1">
            <button
              type="button"
              className={clsx(
                "inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-extrabold transition",
                active
                  ? "border-[color:var(--accent)] bg-[color:var(--panel-strong)] text-[color:var(--text)]"
                  : "border-[color:var(--line)] text-[color:var(--muted)] hover:border-[color:var(--accent-2)]",
              )}
              onClick={() => onSelect(view.id)}
            >
              <Bookmark aria-hidden="true" size={12} />
              {view.name}
            </button>
            {!builtIn && active && (
              <button
                type="button"
                aria-label={`Delete view ${view.name}`}
                className="icon-button text-[color:var(--muted)]"
                onClick={() => onDelete(view.id)}
              >
                <Trash2 aria-hidden="true" size={13} />
              </button>
            )}
          </div>
        );
      })}
      {saveOpen ? (
        <form
          className="flex items-center gap-1"
          onSubmit={(event) => {
            event.preventDefault();
            const name = draftName.trim();
            if (!name) return;
            onSave(name);
            setDraftName("");
            setSaveOpen(false);
          }}
        >
          <input
            autoFocus
            type="text"
            value={draftName}
            onChange={(event) => setDraftName(event.target.value)}
            placeholder="View name"
            aria-label="View name"
            className="input h-7 px-2 py-0 text-xs"
          />
          <button type="submit" className="button-primary text-xs">
            Save
          </button>
          <button type="button" className="text-xs text-[color:var(--muted)]" onClick={() => setSaveOpen(false)}>
            Cancel
          </button>
        </form>
      ) : (
        <button
          type="button"
          className="inline-flex items-center gap-1 rounded-full border border-dashed border-[color:var(--line)] px-3 py-1 text-xs font-extrabold text-[color:var(--accent-2)] hover:border-[color:var(--accent-2)]"
          onClick={() => setSaveOpen(true)}
          aria-label="Save current filters as a view"
        >
          <BookmarkPlus aria-hidden="true" size={12} />
          Save view
        </button>
      )}
    </div>
  );
}

export { MoreHorizontal as _MoreHorizontalUnused };
