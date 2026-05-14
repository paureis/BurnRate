// v4: pure bulk-update helpers used by the multi-select BulkActionBar.
// Kept side-effect-free so the audit log (Feature 5) can capture before/after.

import type { Subscription } from "./burnrate";
import { mergeTags } from "./tags";

export interface BulkPatch extends Partial<Subscription> {
  tagsAdd?: string[];
  tagsRemove?: string[];
}

export interface BulkPatchResult {
  next: Subscription[];
  changedCount: number;
}

export interface BulkDeleteResult {
  next: Subscription[];
  deleted: Subscription[];
}

const STRUCTURAL_KEYS = new Set([
  "name",
  "costCents",
  "billingCycle",
  "category",
  "nextBillingDate",
  "notes",
  "color",
  "icon",
  "currency",
  "cancellingOn",
]);

/**
 * Apply a single patch to every subscription whose id is in `selectedIds`.
 * Returns a fresh array. Records not in the selection are passed through unchanged.
 *
 * - `tagsAdd` merges new tags onto whatever the record already has (dedup is delegated to mergeTags).
 * - `tagsRemove` strips tags case-insensitively; absent tags are silently ignored.
 * - Any other Subscription field can be assigned wholesale (e.g. `category`, `billingCycle`).
 */
export function applyBulkPatch(
  subs: Subscription[],
  selectedIds: ReadonlySet<string>,
  patch: BulkPatch,
): BulkPatchResult {
  if (selectedIds.size === 0) {
    return { next: subs, changedCount: 0 };
  }

  let changedCount = 0;
  const next = subs.map((sub) => {
    if (!selectedIds.has(sub.id)) return sub;

    const updated: Subscription = { ...sub };
    let touched = false;

    for (const [key, value] of Object.entries(patch)) {
      if (key === "id" || key === "createdAt" || key === "tagsAdd" || key === "tagsRemove") continue;
      if (!STRUCTURAL_KEYS.has(key)) continue;
      if (value === undefined) continue;
      const current = (sub as unknown as Record<string, unknown>)[key];
      if (current === value) continue;
      // Cast through unknown — we've already validated the key is a Subscription field.
      (updated as unknown as Record<string, unknown>)[key] = value;
      touched = true;
    }

    if (patch.tagsAdd && patch.tagsAdd.length > 0) {
      const merged = mergeTags(updated.tags, patch.tagsAdd);
      if (!sameTags(merged, updated.tags)) {
        updated.tags = merged.length > 0 ? merged : undefined;
        touched = true;
      }
    }

    if (patch.tagsRemove && patch.tagsRemove.length > 0 && updated.tags && updated.tags.length > 0) {
      const removeSet = new Set(patch.tagsRemove.map((tag) => tag.toLowerCase()));
      const filtered = updated.tags.filter((tag) => !removeSet.has(tag.toLowerCase()));
      if (filtered.length !== updated.tags.length) {
        updated.tags = filtered.length > 0 ? filtered : undefined;
        touched = true;
      }
    }

    if (touched) {
      changedCount += 1;
      return updated;
    }
    return sub;
  });

  return { next, changedCount };
}

/**
 * Remove every subscription whose id is in `selectedIds`.
 * Returns the surviving list and the deleted records (for audit + undo).
 */
export function applyBulkDelete(subs: Subscription[], selectedIds: ReadonlySet<string>): BulkDeleteResult {
  if (selectedIds.size === 0) {
    return { next: subs, deleted: [] };
  }
  const next: Subscription[] = [];
  const deleted: Subscription[] = [];
  for (const sub of subs) {
    if (selectedIds.has(sub.id)) {
      deleted.push(sub);
    } else {
      next.push(sub);
    }
  }
  return { next, deleted };
}

function sameTags(a: string[] | undefined, b: string[] | undefined): boolean {
  if (a === b) return true;
  if (!a || !b) return (!a || a.length === 0) && (!b || b.length === 0);
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}
