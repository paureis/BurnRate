// v4 Feature 6: custom categories registry. Replaces the hardcoded
// `defaultCategories` const with a persisted list of CategoryDef rows so
// users can add their own, recolor, and reorder.

import { defaultCategories, defaultCategoryColors, type Subscription, type Trial } from "./burnrate";

export interface CategoryDef {
  id: string;            // stable, lowercase-kebab
  label: string;         // user-visible
  color: string;         // hex
  icon: string;          // lucide-react icon name from the bundled iconMap
  builtIn: boolean;
  order: number;
  hidden?: boolean;      // built-ins can be hidden but not deleted
}

// Default icons for each built-in category, sourced from shared.ts's iconMap.
const BUILT_IN_ICONS: Record<string, string> = {
  entertainment: "tv",
  productivity: "briefcase",
  fitness: "dumbbell",
  music: "music",
  "cloud/storage": "cloud",
  "news/media": "newspaper",
  gaming: "gamepad",
  "food delivery": "utensils",
  other: "wallet",
};

export const BUILT_IN_CATEGORY_IDS: readonly string[] = defaultCategories.map((label) => slugify(label));

/**
 * Build the canonical seed list of built-in categories. Mirrors the v3 hardcoded
 * order so existing dashboards look identical after the migration.
 */
export function buildBuiltInCategories(): CategoryDef[] {
  return defaultCategories.map((label, index) => ({
    id: slugify(label),
    label: titleCase(label),
    color: defaultCategoryColors[label] ?? "#9aa4b2",
    icon: BUILT_IN_ICONS[label] ?? "wallet",
    builtIn: true,
    order: index,
  }));
}

/**
 * Load + normalize categories from storage. If storage is empty, returns
 * the built-in seed list. Missing built-ins are appended; user categories
 * stay in their stored order.
 */
export function loadCategories(stored: unknown): CategoryDef[] {
  if (!Array.isArray(stored) || stored.length === 0) {
    return buildBuiltInCategories();
  }
  const seenIds = new Set<string>();
  const out: CategoryDef[] = [];
  for (const raw of stored) {
    const def = sanitizeCategory(raw);
    if (!def || seenIds.has(def.id)) continue;
    seenIds.add(def.id);
    out.push(def);
  }
  // Add any built-ins missing from storage (e.g. a new release adds one).
  for (const builtin of buildBuiltInCategories()) {
    if (!seenIds.has(builtin.id)) {
      out.push({ ...builtin, order: out.length });
      seenIds.add(builtin.id);
    }
  }
  // Re-sort by `order`, falling back to insertion order.
  out.sort((a, b) => a.order - b.order);
  return out;
}

/**
 * True when any sub or trial references the given category id (looked up
 * against both raw `category` strings and slugified labels for migration tolerance).
 */
export function isReferenced(
  catId: string,
  subs: readonly Subscription[],
  trials: readonly Trial[] = [],
): boolean {
  const normalized = catId.toLowerCase();
  for (const sub of subs) {
    if (categoryMatches(sub.category, normalized)) return true;
  }
  for (const trial of trials) {
    if (trial.tags && trial.tags.some((tag) => tag.toLowerCase() === normalized)) return true;
  }
  return false;
}

function categoryMatches(value: string, normalized: string): boolean {
  if (!value) return false;
  if (value.toLowerCase() === normalized) return true;
  if (slugify(value) === normalized) return true;
  return false;
}

/**
 * Merge an incoming category list (e.g. from a profile import) onto an
 * existing one. Built-ins are preserved; user categories are added/updated
 * by id.
 */
export function mergeOnImport(existing: CategoryDef[], incoming: CategoryDef[]): CategoryDef[] {
  const byId = new Map(existing.map((cat) => [cat.id, cat] as const));
  for (const incomingCat of incoming) {
    const previous = byId.get(incomingCat.id);
    if (!previous) {
      byId.set(incomingCat.id, { ...incomingCat, order: byId.size });
    } else {
      byId.set(incomingCat.id, {
        ...previous,
        label: incomingCat.label || previous.label,
        color: incomingCat.color || previous.color,
        icon: incomingCat.icon || previous.icon,
        hidden: incomingCat.hidden ?? previous.hidden,
        // Built-in flag never changes on import.
        builtIn: previous.builtIn,
      });
    }
  }
  return [...byId.values()].sort((a, b) => a.order - b.order);
}

/**
 * Map a freeform category label (which is what v3 stored on the
 * Subscription.category field) onto a stable category id from the registry.
 * Unknown labels create a slugified id; the caller decides whether to add
 * the user category to the registry too.
 */
export function resolveCategoryId(rawLabel: string, registry: readonly CategoryDef[]): string {
  if (!rawLabel) return "other";
  const lower = rawLabel.toLowerCase();
  const direct = registry.find((cat) => cat.id === lower || cat.label.toLowerCase() === lower);
  if (direct) return direct.id;
  return slugify(rawLabel);
}

/**
 * v3 → v4 migration: walk subs/trials, return any unknown labels as freshly
 * minted user categories (deterministic colors from a label hash, default icon).
 */
export function deriveUserCategoriesFromRecords(
  subs: readonly Subscription[],
  trials: readonly Trial[],
  existing: readonly CategoryDef[],
): CategoryDef[] {
  const known = new Set(existing.map((c) => c.id));
  const knownLabels = new Set(existing.map((c) => c.label.toLowerCase()));
  const created = new Map<string, CategoryDef>();
  for (const sub of subs) {
    if (!sub.category) continue;
    const slug = slugify(sub.category);
    if (known.has(slug) || created.has(slug)) continue;
    if (knownLabels.has(sub.category.toLowerCase())) continue;
    created.set(slug, {
      id: slug,
      label: titleCase(sub.category),
      color: colorFromLabel(sub.category),
      icon: "wallet",
      builtIn: false,
      order: existing.length + created.size,
    });
  }
  // Trials don't carry a category string in the v3 schema, but the helper
  // tolerates passing them for future-proofing.
  void trials;
  return [...created.values()];
}

function sanitizeCategory(raw: unknown): CategoryDef | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const id = typeof r.id === "string" ? r.id.toLowerCase() : null;
  if (!id || !/^[a-z0-9-/]+$/.test(id.replace(/\//g, ""))) return null;
  const label = typeof r.label === "string" && r.label.trim() ? r.label.trim() : id;
  const color =
    typeof r.color === "string" && /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(r.color) ? r.color : "#9aa4b2";
  const icon = typeof r.icon === "string" && r.icon ? r.icon : "wallet";
  const builtIn = r.builtIn === true || BUILT_IN_CATEGORY_IDS.includes(id);
  const order = typeof r.order === "number" && Number.isFinite(r.order) ? r.order : 999;
  const hidden = r.hidden === true ? true : undefined;
  return { id, label, color, icon, builtIn, order, ...(hidden ? { hidden } : {}) };
}

function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9/-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function titleCase(value: string): string {
  return value
    .split(/[\s/]+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

const SWATCH_PALETTE = [
  "#ff5a3d",
  "#37f29b",
  "#ffd166",
  "#b388ff",
  "#7cc7ff",
  "#f970a8",
  "#6ee7f9",
  "#ff9f1c",
  "#9aa4b2",
];

function colorFromLabel(label: string): string {
  let hash = 0;
  for (let i = 0; i < label.length; i += 1) {
    hash = (hash * 31 + label.charCodeAt(i)) >>> 0;
  }
  return SWATCH_PALETTE[hash % SWATCH_PALETTE.length];
}

export { slugify as slugifyCategoryLabel };
