// v4 Feature 3: canonical dashboard module enumeration and layout resolver.
//
// The layout is persisted inside BurnRatePreferences as an ordered list of
// { moduleId, visible } pairs. resolveDashboardLayout() merges stored state
// with the latest DASHBOARD_MODULES enum so that newly-released modules
// (e.g. v5's `usage`, `calendar`, `retention`) get a sensible default slot
// without erasing the user's reordering.

export type DashboardModuleId =
  | "hero"
  | "budget"
  | "pending"
  | "smarter"
  | "trends"
  | "ledger"
  | "insights"
  | "donut"
  | "renewals"
  // Reserved for v5+:
  | "usage"
  | "calendar"
  | "retention"
  // Reserved for v6:
  | "per-profile";

export interface DashboardModuleMeta {
  id: DashboardModuleId;
  label: string;
  description: string;
  defaultVisible: boolean;
}

export const DASHBOARD_MODULES: readonly DashboardModuleMeta[] = [
  { id: "hero", label: "Hero metrics", description: "Monthly and yearly burn at the top of the dashboard.", defaultVisible: true },
  { id: "budget", label: "Budget tracker", description: "Monthly cap thermometer and savings goal progress.", defaultVisible: true },
  { id: "pending", label: "Pending cancellations", description: "Subscriptions scheduled to cancel.", defaultVisible: true },
  { id: "smarter", label: "Smarter alternatives", description: "Bundle and overlap recommendations.", defaultVisible: true },
  { id: "trends", label: "Trends", description: "Monthly burn history with a 12-month forecast.", defaultVisible: true },
  { id: "ledger", label: "Savings ledger", description: "Running tally of cancellation savings.", defaultVisible: true },
  { id: "insights", label: "Insights", description: "Rule-based smart insights.", defaultVisible: true },
  { id: "donut", label: "Category donut", description: "Yearly burn split by category.", defaultVisible: true },
  { id: "renewals", label: "Upcoming renewals", description: "What renews in the next 30 days.", defaultVisible: true },
  { id: "usage", label: "Usage insights", description: "ROI badges for ghosts, zombies, and heroes.", defaultVisible: true },
  { id: "calendar", label: "Charge calendar", description: "Heatmap of charge days over the last year.", defaultVisible: true },
  { id: "retention", label: "Retention log", description: "Active discounts and expiring deals.", defaultVisible: false },
  { id: "per-profile", label: "Per-profile burn", description: "Burn split across household profiles.", defaultVisible: false },
] as const;

export const DASHBOARD_MODULE_IDS: readonly DashboardModuleId[] = DASHBOARD_MODULES.map((m) => m.id);

export interface DashboardLayoutEntry {
  moduleId: DashboardModuleId;
  visible: boolean;
}

/**
 * Merge a stored layout with the canonical module set:
 * - Stored modules keep their order + visibility.
 * - New modules (released after the layout was stored) are appended with
 *   their meta's `defaultVisible`.
 * - Modules that no longer exist in the canonical set are dropped.
 */
export function resolveDashboardLayout(
  stored: DashboardLayoutEntry[] | undefined,
  available: readonly DashboardModuleId[] = DASHBOARD_MODULE_IDS,
): DashboardLayoutEntry[] {
  const availableSet = new Set(available);
  const out: DashboardLayoutEntry[] = [];
  const seen = new Set<DashboardModuleId>();

  if (Array.isArray(stored)) {
    for (const entry of stored) {
      if (!entry || typeof entry !== "object") continue;
      const id = entry.moduleId as DashboardModuleId;
      if (!availableSet.has(id) || seen.has(id)) continue;
      seen.add(id);
      out.push({ moduleId: id, visible: entry.visible !== false });
    }
  }

  for (const id of available) {
    if (seen.has(id)) continue;
    const meta = DASHBOARD_MODULES.find((m) => m.id === id);
    out.push({ moduleId: id, visible: meta?.defaultVisible ?? true });
    seen.add(id);
  }

  return out;
}

/**
 * Return a layout with the given module moved by `delta` positions (negative
 * = up, positive = down). Out-of-bound moves clamp to the ends.
 */
export function moveLayoutEntry(
  layout: DashboardLayoutEntry[],
  moduleId: DashboardModuleId,
  delta: number,
): DashboardLayoutEntry[] {
  const index = layout.findIndex((e) => e.moduleId === moduleId);
  if (index < 0) return layout;
  const next = [...layout];
  const target = Math.max(0, Math.min(next.length - 1, index + delta));
  if (target === index) return layout;
  const [entry] = next.splice(index, 1);
  next.splice(target, 0, entry);
  return next;
}

/**
 * Toggle visibility for one module. Returns a fresh array.
 */
export function toggleLayoutVisibility(
  layout: DashboardLayoutEntry[],
  moduleId: DashboardModuleId,
): DashboardLayoutEntry[] {
  return layout.map((entry) =>
    entry.moduleId === moduleId ? { ...entry, visible: !entry.visible } : entry,
  );
}

/**
 * Return the canonical default order. Useful for "Reset to default."
 */
export function defaultDashboardLayout(): DashboardLayoutEntry[] {
  return DASHBOARD_MODULES.map((m) => ({ moduleId: m.id, visible: m.defaultVisible }));
}
