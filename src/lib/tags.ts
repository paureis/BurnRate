// v4: tag normalization + collection helpers shared by bulk patches, the
// tag-chip input, and saved views.

import type { Subscription, Trial } from "./burnrate";

const TAG_PATTERN = /^[a-z0-9-]+$/;
const MAX_TAG_LENGTH = 20;
const MAX_TAGS_PER_RECORD = 10;

/**
 * Normalize a single tag input. Returns null when the candidate cannot be
 * normalized (empty, too long, contains forbidden characters).
 */
export function normalizeTag(input: string): string | null {
  if (typeof input !== "string") return null;
  const trimmed = input.trim().toLowerCase().replace(/\s+/g, "-");
  if (!trimmed) return null;
  if (trimmed.length > MAX_TAG_LENGTH) return null;
  if (!TAG_PATTERN.test(trimmed)) return null;
  return trimmed;
}

/**
 * Merge new tags into an existing list. Order is preserved and duplicates
 * (case-insensitive) are dropped. Invalid candidates are skipped.
 */
export function mergeTags(existing: string[] | undefined, incoming: readonly string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  if (existing) {
    for (const tag of existing) {
      const normalized = normalizeTag(tag);
      if (!normalized || seen.has(normalized)) continue;
      seen.add(normalized);
      out.push(normalized);
    }
  }
  for (const tag of incoming) {
    const normalized = normalizeTag(tag);
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    out.push(normalized);
    if (out.length >= MAX_TAGS_PER_RECORD) break;
  }
  return out;
}

/**
 * Collect every unique tag across subs and trials, sorted alphabetically.
 */
export function collectAllTags(subs: readonly Subscription[], trials: readonly Trial[]): string[] {
  const seen = new Set<string>();
  for (const sub of subs) {
    if (!sub.tags) continue;
    for (const tag of sub.tags) {
      const normalized = normalizeTag(tag);
      if (normalized) seen.add(normalized);
    }
  }
  for (const trial of trials) {
    if (!trial.tags) continue;
    for (const tag of trial.tags) {
      const normalized = normalizeTag(tag);
      if (normalized) seen.add(normalized);
    }
  }
  return [...seen].sort();
}

/**
 * Compare two tag lists for set equality (order ignored).
 */
export function tagsEqual(a: readonly string[] | undefined, b: readonly string[] | undefined): boolean {
  const left = new Set((a ?? []).map((t) => t.toLowerCase()));
  const right = new Set((b ?? []).map((t) => t.toLowerCase()));
  if (left.size !== right.size) return false;
  for (const value of left) {
    if (!right.has(value)) return false;
  }
  return true;
}

export const TAG_LIMITS = {
  maxLength: MAX_TAG_LENGTH,
  maxPerRecord: MAX_TAGS_PER_RECORD,
} as const;
