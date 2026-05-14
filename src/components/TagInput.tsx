"use client";

import { useMemo, useState, type KeyboardEvent } from "react";
import { X } from "lucide-react";
import { collectAllTags, mergeTags, normalizeTag } from "@/lib/tags";
import type { Subscription, Trial } from "@/lib/burnrate";

interface TagInputProps {
  tags: string[];
  onChange: (next: string[]) => void;
  /** All known tags across subs + trials, for autocomplete. */
  knownTags?: string[];
  placeholder?: string;
}

export function TagInput({ tags, onChange, knownTags, placeholder = "Add tag…" }: TagInputProps) {
  const [draft, setDraft] = useState("");

  const suggestions = useMemo(() => {
    if (!draft.trim() || !knownTags) return [];
    const lower = draft.toLowerCase();
    const used = new Set(tags.map((t) => t.toLowerCase()));
    return knownTags.filter((tag) => tag.toLowerCase().includes(lower) && !used.has(tag.toLowerCase())).slice(0, 6);
  }, [draft, knownTags, tags]);

  function commit(input: string) {
    const normalized = normalizeTag(input);
    if (!normalized) return;
    onChange(mergeTags(tags, [normalized]));
    setDraft("");
  }

  function onKey(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter" || event.key === "," || (event.key === " " && draft.length > 0)) {
      event.preventDefault();
      commit(draft);
      return;
    }
    if (event.key === "Backspace" && draft.length === 0 && tags.length > 0) {
      event.preventDefault();
      onChange(tags.slice(0, -1));
    }
  }

  return (
    <div className="grid gap-1">
      <div className="flex flex-wrap items-center gap-1 rounded-panel border border-[color:var(--line)] bg-[color:var(--panel-strong)] p-2">
        {tags.map((tag) => (
          <span
            key={tag}
            className="inline-flex items-center gap-1 rounded-full bg-[color:var(--panel)] px-2 py-0.5 text-xs font-extrabold text-[color:var(--accent-2)]"
          >
            #{tag}
            <button
              type="button"
              aria-label={`Remove tag ${tag}`}
              className="text-[color:var(--muted)] hover:text-[color:var(--text)]"
              onClick={() => onChange(tags.filter((existing) => existing !== tag))}
            >
              <X aria-hidden="true" size={12} />
            </button>
          </span>
        ))}
        <input
          type="text"
          className="min-w-[120px] flex-1 bg-transparent text-sm font-bold outline-none placeholder:text-[color:var(--subtle)]"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={onKey}
          onBlur={() => commit(draft)}
          placeholder={tags.length === 0 ? placeholder : ""}
          aria-label="Add tag"
        />
      </div>
      {suggestions.length > 0 && (
        <div className="flex flex-wrap gap-1 text-xs">
          {suggestions.map((tag) => (
            <button
              key={tag}
              type="button"
              className="rounded-full bg-[color:var(--panel-strong)] px-2 py-0.5 font-extrabold text-[color:var(--accent-2)] hover:bg-[color:var(--panel)]"
              onClick={() => commit(tag)}
            >
              #{tag}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function useKnownTags(subs: readonly Subscription[], trials: readonly Trial[]): string[] {
  return useMemo(() => collectAllTags(subs, trials), [subs, trials]);
}
