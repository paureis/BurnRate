"use client";

import {
  BarChart3,
  BellRing,
  Flame,
  Moon,
  Plus,
  RefreshCcw,
  Share2,
  Sun,
  WalletCards,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { clsx } from "clsx";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import {
  calculateBurnMetrics,
  calculateSimulatorImpact,
  createId,
  defaultCategories,
  defaultCategoryColors,
  formatCents,
  getPendingTrialAlerts,
  monthlyCostCents,
  parseBurnRateCsv,
  serializeBurnRateCsv,
  toCents,
  todayDateInputValue,
  type BurnRateData,
  type Subscription,
  type Theme,
  type Trial,
} from "@/lib/burnrate";
import { serializeBurnRateIcs } from "@/lib/ics";
import { decodeSyncPayload, encodeSyncPayload, mergeSync, SyncDecodeError, summarizeSyncPayload, type SyncSummary } from "@/lib/sync";
import { emptyBudget, evaluateCap, evaluateSavings, isBudgetSet, type BudgetGoal } from "@/lib/budget";
import {
  applyDueCancellations,
  buildManualLedgerRecord,
  type CancellationRecord,
} from "@/lib/ledger";
import {
  buildFxContext,
  DEFAULT_BASE_CURRENCY,
} from "@/lib/currency";
import { collectAllTags } from "@/lib/tags";
import { applyView, normalizeViews, type SavedView } from "@/lib/views";
import { SavedViewsPills } from "./SavedViewsPills";
import { applyBulkDelete, applyBulkPatch, type BulkPatch } from "@/lib/bulk";
import { applyDuePriceChanges } from "@/lib/price-changes";
import { BulkActionBar } from "./BulkActionBar";
import { buildBuiltInCategories, loadCategories, type CategoryDef } from "@/lib/categories";
import type { ProfileSettingsState } from "@/lib/profile";
import { ProfileSettings } from "./ProfileSettings";
import { CategorySettings } from "./CategorySettings";
import { DashboardLayoutEditor } from "./DashboardLayoutEditor";
import type { DashboardLayoutEntry } from "@/lib/dashboard-layout";
import { PeerSyncFlow } from "./PeerSyncFlow";
import { GoalsPanel } from "./GoalsPanel";
import type { Goal } from "@/lib/goals";
import { ProfilesPanel } from "./ProfilesPanel";
import { PerProfileBurn } from "./PerProfileBurn";
import { normalizeProfiles, type Profile } from "@/lib/profiles";
import { DecoySetup } from "./DecoySetup";
import type { VaultMetaWithDecoy } from "@/lib/decoy";
import { VaultManager } from "./VaultManager";
import { normalizeRegistry, type VaultRegistry } from "@/lib/vault-registry";
import { HistoryDrawer } from "./HistoryDrawer";
import { append, normalizeHistory, dropEntry, type HistoryEntry, type HistoryOp } from "@/lib/history";
import { UsageInsights } from "./UsageInsights";
import { RetentionLog } from "./RetentionLog";
import { ChargeCalendarPanel } from "./ChargeCalendarPanel";
import { NotificationSettings, defaultNotifySettings } from "./NotificationSettings";
import type { NotifySettings } from "@/lib/notify";
import { CancellationCoach } from "./CancellationCoach";
import {
  buildAttempt,
  type CancellationAttempt,
  type CancellationOutcome,
} from "@/lib/cancellation-attempts";
import { buildManualLedgerRecord as buildLedgerEntry } from "@/lib/ledger";
void buildAttempt; void buildLedgerEntry;
import {
  defaultPreferences,
  normalizePreferences,
  type BurnRatePreferences,
} from "@/lib/preferences";
import {
  buildSnapshot,
  captureSnapshotIfNeeded,
  loadSnapshots,
  persistSnapshot,
  removeSnapshot,
  type MonthlySnapshot,
} from "@/lib/snapshots";
import { isIndexedDbAvailable } from "@/lib/idb";
import {
  createVaultMeta,
  emptyVaultMeta,
  unlockVault,
  type VaultMeta,
} from "@/lib/crypto";
import { BudgetTracker } from "./BudgetTracker";
import { LockScreen } from "./LockScreen";
import { ChargesImporter } from "./ChargesImporter";
import { CommandPalette, type CommandItem } from "./CommandPalette";
import { CurrencySettings } from "./CurrencySettings";
import { Dashboard } from "./Dashboard";
import { HeroMetrics } from "./HeroMetrics";
import { PendingCancellations } from "./PendingCancellations";
import { PopularServicesPicker, type PopularServiceAdd } from "./PopularServicesPicker";
import { SavingsLedger } from "./SavingsLedger";
import { SecuritySettings } from "./SecuritySettings";
import { ServiceWorkerRegistrar } from "./ServiceWorkerRegistrar";
import { ShareAndData } from "./ShareAndData";
import { SmarterAlternatives } from "./SmarterAlternatives";
import { SyncModal, type SyncDecision } from "./SyncModal";
import { Simulator } from "./Simulator";
import { SubscriptionManager } from "./SubscriptionManager";
import { TrendsPanel } from "./TrendsPanel";
import { TrialAlerts, type NotificationPermissionState } from "./TrialAlerts";
import { TrialTracker } from "./TrialTracker";
import {
  newSubscriptionDraft,
  newTrialDraft,
  storageKeys,
  type SortKey,
  type SubscriptionDraft,
  type TrialDraft,
  type View,
} from "./shared";

const views: Array<{ id: View; label: string; Icon: LucideIcon }> = [
  { id: "dashboard", label: "Dashboard", Icon: BarChart3 },
  { id: "subscriptions", label: "Subscriptions", Icon: WalletCards },
  { id: "trials", label: "Trials", Icon: BellRing },
  { id: "simulator", label: "What If", Icon: RefreshCcw },
  { id: "share", label: "Settings", Icon: Share2 },
];

export function BurnRateApp() {
  const [subscriptions, setSubscriptions] = useLocalStorage<Subscription[]>(storageKeys.subscriptions, []);
  const [trials, setTrials] = useLocalStorage<Trial[]>(storageKeys.trials, []);
  const [theme, setTheme] = useLocalStorage<Theme>(storageKeys.theme, "dark");
  const [dismissedAlerts, setDismissedAlerts] = useLocalStorage<Record<string, boolean>>(
    storageKeys.trialAlertsDismissed,
    {},
  );
  const [budget, setBudget] = useLocalStorage<BudgetGoal>(storageKeys.budget, emptyBudget);
  const [storedPreferences, setStoredPreferences] = useLocalStorage<BurnRatePreferences>(
    storageKeys.preferences,
    defaultPreferences,
  );
  const preferences = useMemo(() => normalizePreferences(storedPreferences), [storedPreferences]);
  const [ledger, setLedger] = useLocalStorage<CancellationRecord[]>(storageKeys.ledger, []);
  const [dismissedRecommendations, setDismissedRecommendations] = useLocalStorage<string[]>(
    storageKeys.recommendationsDismissed,
    [],
  );
  const [storedViews, setStoredViews] = useLocalStorage<SavedView[]>(storageKeys.views, []);
  const savedViews = useMemo(() => normalizeViews(storedViews), [storedViews]);
  const [storedCategories, setStoredCategories] = useLocalStorage<CategoryDef[]>(storageKeys.categories, []);
  const categories = useMemo(() => loadCategories(storedCategories), [storedCategories]);
  const [storedLayout, setStoredLayout] = useLocalStorage<DashboardLayoutEntry[] | undefined>(
    "burnrate.dashboard-layout.v1",
    undefined,
  );
  const [storedGoals, setStoredGoals] = useLocalStorage<Goal[]>("burnrate.goals.v2", []);
  const [storedProfiles, setStoredProfiles] = useLocalStorage<Profile[] | undefined>(
    "burnrate.profiles.v1",
    undefined,
  );
  const profiles = useMemo(() => normalizeProfiles(storedProfiles), [storedProfiles]);
  const [storedVaultRegistry, setStoredVaultRegistry] = useLocalStorage<VaultRegistry | undefined>(
    "burnrate.vault-registry.v1",
    undefined,
  );
  const vaultRegistry = useMemo(() => normalizeRegistry(storedVaultRegistry), [storedVaultRegistry]);
  const [storedHistory, setStoredHistory] = useLocalStorage<HistoryEntry[]>(storageKeys.history, []);
  const historyEntries = useMemo(() => normalizeHistory(storedHistory), [storedHistory]);
  const [historyOpen, setHistoryOpen] = useState(false);

  function recordHistory(op: HistoryOp, summary: string, before: unknown, after: unknown, affectedRecordIds?: string[]) {
    setStoredHistory((current) =>
      append(current, { op, summary, before, after, ...(affectedRecordIds ? { affectedRecordIds } : {}) }),
    );
  }

  function undoFromHistory(entry: HistoryEntry) {
    switch (entry.op) {
      case "addSubscription": {
        const after = entry.after as { id?: string };
        if (after?.id) setSubscriptions((current) => current.filter((sub) => sub.id !== after.id));
        break;
      }
      case "deleteSubscription": {
        const before = entry.before as { id?: string } | null;
        if (before && typeof before === "object") setSubscriptions((current) => [before as never, ...current]);
        break;
      }
      case "bulkDelete": {
        const before = entry.before as unknown[];
        if (Array.isArray(before)) {
          setSubscriptions((current) => [...(before as never[]), ...current]);
        }
        break;
      }
      case "bulkUpdate": {
        const before = entry.before as unknown[];
        if (Array.isArray(before)) {
          setSubscriptions((current) => {
            const beforeIds = new Set((before as Array<{ id: string }>).map((s) => s.id));
            return current.map((sub) => {
              if (!beforeIds.has(sub.id)) return sub;
              const original = (before as Array<{ id: string }>).find((s) => s.id === sub.id);
              return (original as never) ?? sub;
            });
          });
        }
        break;
      }
      default:
        showToast("This entry can't be undone automatically.");
        return;
    }
    setStoredHistory((current) => dropEntry(current, entry.id));
    showToast("Undone.");
  }
  const [activeViewId, setActiveViewId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const lastSelectedRef = useRef<string | null>(null);
  const [notifySettings, setNotifySettings] = useLocalStorage<NotifySettings>(
    "burnrate.notify.v1",
    defaultNotifySettings,
  );
  const [cancellationAttempts, setCancellationAttempts] = useLocalStorage<CancellationAttempt[]>(
    "burnrate.cancellation-attempts.v1",
    [],
  );
  const [coachSubId, setCoachSubId] = useState<string | null>(null);
  const coachSub = useMemo(
    () => (coachSubId ? subscriptions.find((sub) => sub.id === coachSubId) ?? null : null),
    [coachSubId, subscriptions],
  );

  function openCancellationCoach(subscriptionId: string) {
    setCoachSubId(subscriptionId);
  }

  function handleCoachComplete(attempt: CancellationAttempt, outcome: CancellationOutcome) {
    setCancellationAttempts((current) => [attempt, ...current]);
    if (outcome === "cancelled") {
      const target = subscriptions.find((sub) => sub.id === attempt.subscriptionId);
      if (target) {
        setCancellingOn(target.id, todayDateInputValue(new Date(Date.now() + 24 * 60 * 60 * 1000)));
      }
    }
    setCoachSubId(null);
    showToast(`Logged "${attempt.outcome}" attempt for ${attempt.serviceName}.`);
  }
  const [snapshots, setSnapshots] = useState<MonthlySnapshot[]>([]);
  const [vaultMeta, setVaultMeta] = useLocalStorage<VaultMeta>(storageKeys.vault, emptyVaultMeta);
  const [cryptoKey, setCryptoKey] = useState<CryptoKey | null>(null);
  const [failedUnlockAttempts, setFailedUnlockAttempts] = useState(0);
  const [unlockCooldownSeconds, setUnlockCooldownSeconds] = useState(0);
  const isLocked = vaultMeta.enabled && cryptoKey === null;
  const [now, setNow] = useState(() => new Date());
  const fxContext = useMemo(
    () => buildFxContext(preferences.baseCurrency, preferences.fxOverrides),
    [preferences.baseCurrency, preferences.fxOverrides],
  );
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermissionState>("unsupported");
  const [hasHydrated, setHasHydrated] = useState(false);
  const [activeView, setActiveView] = useState<View>("dashboard");
  const [subscriptionDraft, setSubscriptionDraft] = useState<SubscriptionDraft>(() => newSubscriptionDraft());
  const [trialDraft, setTrialDraft] = useState<TrialDraft>(() => newTrialDraft());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingDraft, setEditingDraft] = useState<SubscriptionDraft>(() => newSubscriptionDraft());
  const [sortKey, setSortKey] = useState<SortKey>("nextBillingDate");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [disabledIds, setDisabledIds] = useState<Set<string>>(() => new Set());
  const [toasts, setToasts] = useState<Array<{ id: number; message: string }>>([]);
  const toastIdRef = useRef(0);
  const [isImageBusy, setIsImageBusy] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [syncModalOpen, setSyncModalOpen] = useState(false);
  const [syncSummary, setSyncSummary] = useState<SyncSummary | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [pendingSyncPayload, setPendingSyncPayload] = useState<string | null>(null);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const importInputRef = useRef<HTMLInputElement>(null);
  const importBurnInputRef = useRef<HTMLInputElement>(null);
  const shareCardRef = useRef<HTMLDivElement>(null);

  const metrics = useMemo(() => calculateBurnMetrics(subscriptions, now), [subscriptions, now]);
  const pendingAlerts = useMemo(
    () => getPendingTrialAlerts(trials, dismissedAlerts, now),
    [dismissedAlerts, now, trials],
  );
  const simulatorImpact = useMemo(
    () => calculateSimulatorImpact(subscriptions, disabledIds),
    [disabledIds, subscriptions],
  );

  const paletteCommands = useMemo<CommandItem[]>(() => {
    const items: CommandItem[] = [
      {
        id: "open-dashboard",
        label: "Open dashboard",
        keywords: "view home metrics",
        action: () => setActiveView("dashboard"),
      },
      {
        id: "open-subscriptions",
        label: "Open subscriptions",
        keywords: "view list manage",
        action: () => setActiveView("subscriptions"),
      },
      {
        id: "open-trials",
        label: "Open trials",
        keywords: "view free",
        action: () => setActiveView("trials"),
      },
      {
        id: "open-simulator",
        label: "Open simulator",
        keywords: "view what if",
        action: () => setActiveView("simulator"),
      },
      {
        id: "open-share",
        label: "Open settings and data",
        keywords: "share view export",
        action: () => setActiveView("share"),
      },
      {
        id: "add-subscription",
        label: "Add subscription",
        keywords: "new recurring",
        action: () => {
          setActiveView("subscriptions");
          window.setTimeout(() => document.getElementById("add-subscription-name")?.focus(), 50);
        },
      },
      {
        id: "add-trial",
        label: "Add free trial",
        keywords: "new trial countdown",
        action: () => {
          setActiveView("trials");
          window.setTimeout(() => {
            const target = document.querySelector<HTMLInputElement>("input[placeholder*='Notion']");
            target?.focus();
          }, 50);
        },
      },
      {
        id: "toggle-theme",
        label: "Toggle dark/light mode",
        keywords: "color scheme",
        action: () => setTheme((current) => (current === "dark" ? "light" : "dark")),
      },
      {
        id: "export-csv",
        label: "Export CSV",
        keywords: "download backup",
        action: () => exportCsv(),
      },
      {
        id: "export-ics",
        label: "Export ICS calendar",
        keywords: "calendar download",
        action: () => exportIcs(),
      },
      {
        id: "generate-sync-link",
        label: "Generate sync link",
        keywords: "url share device",
        action: () => void generateSyncLink(),
      },
      {
        id: "generate-share-link",
        label: "Create public share link",
        keywords: "public og",
        action: () => void generateShareLink(),
      },
      {
        id: "download-share-image",
        label: "Download share image",
        keywords: "png screenshot",
        action: () => void downloadSummaryPng(),
      },
      {
        id: "set-monthly-cap",
        label: "Set monthly budget cap",
        keywords: "limit ceiling",
        action: () => setActiveView("dashboard"),
      },
      {
        id: "set-savings-goal",
        label: "Set savings goal",
        keywords: "annual target",
        action: () => setActiveView("dashboard"),
      },
      {
        id: "open-popular",
        label: "Open popular services picker",
        keywords: "add quick netflix",
        action: () => {
          setActiveView("subscriptions");
          setPickerOpen(true);
        },
      },
      {
        id: "reset-data",
        label: "Reset all data",
        keywords: "danger clear wipe",
        action: () => resetAllData(),
      },
    ];

    for (const subscription of subscriptions) {
      items.push({
        id: `edit-${subscription.id}`,
        label: `Edit ${subscription.name}`,
        keywords: `${subscription.category} ${(subscription.tags ?? []).join(" ")}`,
        action: () => {
          setActiveView("subscriptions");
          startEditing(subscription);
        },
        meta: { sub: subscription },
      });
      items.push({
        id: `delete-${subscription.id}`,
        label: `Delete ${subscription.name}`,
        keywords: `${subscription.category} ${(subscription.tags ?? []).join(" ")}`,
        action: () => deleteSubscription(subscription.id),
        meta: { sub: subscription },
      });
    }

    return items;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subscriptions]);
  const categoryOptions = useMemo(() => {
    const values = new Set<string>(defaultCategories);
    subscriptions.forEach((subscription) => values.add(subscription.category));
    return [...values].sort((a, b) => a.localeCompare(b));
  }, [subscriptions]);
  const knownTags = useMemo(() => collectAllTags(subscriptions, trials), [subscriptions, trials]);
  const visibleSubscriptions = useMemo(() => {
    // When a saved view is active, it provides the filter + sort.
    const activeView = activeViewId ? savedViews.find((v) => v.id === activeViewId) : null;
    if (activeView) {
      return applyView(subscriptions, activeView, fxContext);
    }
    const normalizedSearch = searchQuery.trim().toLowerCase();
    const filtered = subscriptions.filter((subscription) => {
      const matchesCategory = categoryFilter === "all" || subscription.category === categoryFilter;
      const matchesSearch =
        !normalizedSearch ||
        subscription.name.toLowerCase().includes(normalizedSearch) ||
        subscription.category.toLowerCase().includes(normalizedSearch);
      return matchesCategory && matchesSearch;
    });

    return [...filtered].sort((a, b) => {
      switch (sortKey) {
        case "cost":
          return monthlyCostCents(b) - monthlyCostCents(a);
        case "name":
          return a.name.localeCompare(b.name);
        case "category":
          return a.category.localeCompare(b.category) || a.name.localeCompare(b.name);
        case "nextBillingDate":
          return a.nextBillingDate.localeCompare(b.nextBillingDate);
      }
    });
  }, [activeViewId, categoryFilter, fxContext, savedViews, searchQuery, sortKey, subscriptions]);

  function saveCurrentAsView(name: string) {
    const filter: SavedView["filter"] = {};
    if (searchQuery.trim()) filter.query = searchQuery.trim();
    if (categoryFilter !== "all") filter.categories = [categoryFilter];
    const view: SavedView = {
      id: `view-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
      name,
      scope: "subscriptions",
      filter,
      sort: { by: sortKey, dir: sortKey === "cost" ? "desc" : "asc" },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    setStoredViews((current) => [...current, view]);
    setActiveViewId(view.id);
    showToast(`Saved view "${name}".`);
  }

  function deleteSavedView(id: string) {
    setStoredViews((current) => current.filter((view) => view.id !== id));
    if (activeViewId === id) setActiveViewId(null);
    showToast("View deleted.");
  }

  function toggleSelectedId(id: string, shiftKey: boolean) {
    setSelectedIds((current) => {
      const next = new Set(current);
      // Shift+click range select from the last toggled id.
      const anchor = lastSelectedRef.current;
      if (shiftKey && anchor && anchor !== id) {
        const ids = visibleSubscriptions.map((sub) => sub.id);
        const a = ids.indexOf(anchor);
        const b = ids.indexOf(id);
        if (a >= 0 && b >= 0) {
          const [start, end] = a < b ? [a, b] : [b, a];
          for (let i = start; i <= end; i += 1) next.add(ids[i]);
          lastSelectedRef.current = id;
          return next;
        }
      }
      if (next.has(id)) next.delete(id);
      else next.add(id);
      lastSelectedRef.current = id;
      return next;
    });
  }

  function selectAllVisible(selectAll: boolean) {
    setSelectedIds((current) => {
      if (!selectAll) {
        const next = new Set(current);
        for (const sub of visibleSubscriptions) next.delete(sub.id);
        return next;
      }
      const next = new Set(current);
      for (const sub of visibleSubscriptions) next.add(sub.id);
      return next;
    });
  }

  function applyBulkPatchToSelection(patch: BulkPatch) {
    const before = subscriptions.filter((sub) => selectedIds.has(sub.id));
    const result = applyBulkPatch(subscriptions, selectedIds, patch);
    if (result.changedCount > 0) {
      setSubscriptions(result.next);
      showToast(`Updated ${result.changedCount} subscription${result.changedCount === 1 ? "" : "s"}.`);
      const after = result.next.filter((sub) => selectedIds.has(sub.id));
      recordHistory("bulkUpdate", `Updated ${result.changedCount} subscriptions.`, before, after, [...selectedIds]);
    }
  }

  function applyBulkDeleteToSelection() {
    const result = applyBulkDelete(subscriptions, selectedIds);
    if (result.deleted.length > 0) {
      setSubscriptions(result.next);
      setSelectedIds(new Set());
      showToast(`Deleted ${result.deleted.length} subscription${result.deleted.length === 1 ? "" : "s"}.`);
      recordHistory(
        "bulkDelete",
        `Deleted ${result.deleted.length} subscription${result.deleted.length === 1 ? "" : "s"}.`,
        result.deleted,
        null,
        result.deleted.map((sub) => sub.id),
      );
    }
  }

  useEffect(() => {
    document.documentElement.style.colorScheme = theme;
    document.documentElement.classList.toggle("theme-light", theme === "light");
    document.documentElement.classList.toggle("theme-dark", theme === "dark");
  }, [theme]);

  useEffect(() => {
    setDisabledIds((current) => {
      const validIds = new Set(subscriptions.map((subscription) => subscription.id));
      return new Set([...current].filter((id) => validIds.has(id)));
    });
  }, [subscriptions]);

  useEffect(() => {
    if (toasts.length === 0) {
      return;
    }
    const oldest = toasts[0];
    const timeout = window.setTimeout(() => {
      setToasts((current) => current.filter((entry) => entry.id !== oldest.id));
    }, 2400);
    return () => window.clearTimeout(timeout);
  }, [toasts]);

  useEffect(() => {
    setHasHydrated(true);
    if (typeof window === "undefined" || typeof Notification === "undefined") {
      return;
    }
    setNotificationPermission(Notification.permission as NotificationPermissionState);
  }, []);

  // Lock-cooldown countdown.
  useEffect(() => {
    if (unlockCooldownSeconds <= 0) return;
    const timer = window.setTimeout(() => setUnlockCooldownSeconds((current) => Math.max(0, current - 1)), 1000);
    return () => window.clearTimeout(timer);
  }, [unlockCooldownSeconds]);

  // Apply any due cancellations on boot — silent + adds to ledger.
  useEffect(() => {
    if (!hasHydrated) return;
    const today = todayDateInputValue();
    const due = subscriptions.filter((sub) => sub.cancellingOn && sub.cancellingOn <= today);
    if (due.length === 0) return;
    const { remaining, added } = applyDueCancellations(subscriptions);
    setSubscriptions(remaining);
    setLedger((current) => [...added, ...current]);
    if (added.length > 0) {
      showToast(`${added.length} subscription${added.length === 1 ? "" : "s"} auto-cancelled. Undo in the ledger.`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasHydrated]);

  // v5: apply any due price changes on boot. Idempotent on the same day.
  useEffect(() => {
    if (!hasHydrated) return;
    const result = applyDuePriceChanges(subscriptions);
    if (result.applied.length === 0) return;
    setSubscriptions(result.next);
    showToast(
      result.applied.length === 1
        ? `${result.applied[0].subscriptionId.startsWith("sub-") ? "A subscription" : result.applied[0].subscriptionId} price changed as scheduled.`
        : `${result.applied.length} subscriptions had scheduled price changes apply today.`,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasHydrated]);

  // Snapshot capture on boot. IndexedDB only; silent failure if unavailable.
  useEffect(() => {
    if (!hasHydrated || !isIndexedDbAvailable()) return;
    let cancelled = false;
    (async () => {
      try {
        const existing = await loadSnapshots();
        if (cancelled) return;
        const result = captureSnapshotIfNeeded(
          existing,
          () => buildSnapshot(subscriptions, trials, fxContext, new Date()),
          new Date(),
        );
        if (result.added) {
          await persistSnapshot(result.added);
          // Prune snapshots that fell out of retention.
          const droppedMonths = existing
            .map((snap) => snap.snapshotMonth)
            .filter((month) => !result.snapshots.some((kept) => kept.snapshotMonth === month));
          for (const month of droppedMonths) {
            await removeSnapshot(month);
          }
        }
        setSnapshots(result.snapshots);
      } catch {
        // IDB failures should not break the app.
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasHydrated]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    function onKey(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setPaletteOpen((current) => !current);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const hash = window.location.hash;
    if (!hash.startsWith("#sync=")) return;
    const payload = hash.slice("#sync=".length);
    setPendingSyncPayload(payload);
    try {
      const summary = summarizeSyncPayload(payload);
      setSyncSummary(summary);
      setSyncError(null);
    } catch (error) {
      const message = error instanceof SyncDecodeError ? error.message : "Sync payload could not be read.";
      setSyncSummary(null);
      setSyncError(message);
    }
    setSyncModalOpen(true);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const refresh = () => setNow(new Date());
    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        refresh();
      }
    };
    const interval = window.setInterval(refresh, 6 * 60 * 60 * 1000);
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("focus", refresh);

    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("focus", refresh);
    };
  }, []);

  useEffect(() => {
    if (notificationPermission !== "granted" || pendingAlerts.length === 0) {
      return;
    }
    if (typeof window === "undefined" || typeof Notification === "undefined") {
      return;
    }

    const justFired: string[] = [];
    for (const alert of pendingAlerts) {
      try {
        new Notification(`${alert.trial.name} trial ending`, {
          body:
            alert.daysRemaining === 0
              ? `Ends today — becomes ${formatCents(alert.trial.costAfterTrialCents)}/mo.`
              : `${alert.daysRemaining} day${alert.daysRemaining === 1 ? "" : "s"} left — becomes ${formatCents(alert.trial.costAfterTrialCents)}/mo.`,
          tag: alert.key,
        });
        justFired.push(alert.key);
      } catch {
        // Notification constructor can throw on some platforms — fall back to the in-app banner.
      }
    }

    if (justFired.length > 0) {
      setDismissedAlerts((current) => {
        const next = { ...current };
        for (const key of justFired) {
          next[key] = true;
        }
        return next;
      });
    }
  }, [notificationPermission, pendingAlerts, setDismissedAlerts]);

  function showToast(message: string) {
    const id = ++toastIdRef.current;
    setToasts((current) => {
      const next = [...current, { id, message }];
      return next.slice(-3);
    });
  }

  function buildBudgetInsights(monthlyCents: number, yearlyCents: number, currentBudget: BudgetGoal) {
    if (!isBudgetSet(currentBudget)) return [];
    const cap = evaluateCap(monthlyCents, currentBudget);
    const savings = evaluateSavings(yearlyCents, currentBudget);
    const insights: Array<{ id: string; title: string; detail: string; tone: "good" | "neutral" | "warning" | "danger" }> = [];
    if (cap.hasCap) {
      if (cap.tone === "over") {
        insights.push({
          id: "budget-over",
          title: `Over your ${formatCents(cap.capCents)} cap`,
          detail: `Your monthly burn exceeds the cap by ${formatCents(-cap.remainingCents)}.`,
          tone: "danger",
        });
      } else if (cap.tone === "danger" || cap.tone === "warning") {
        insights.push({
          id: "budget-near",
          title: `${Math.round(cap.ratio * 100)}% of monthly cap used`,
          detail: `${formatCents(cap.remainingCents)} is left before you hit the ${formatCents(cap.capCents)} ceiling.`,
          tone: cap.tone === "danger" ? "danger" : "warning",
        });
      } else {
        insights.push({
          id: "budget-good",
          title: `Comfortably under your monthly cap`,
          detail: `${formatCents(cap.remainingCents)} of headroom this month.`,
          tone: "good",
        });
      }
    }
    if (savings.hasGoal) {
      const percent = Math.max(0, Math.round(savings.ratio * 100));
      const remaining = Math.max(0, savings.targetCents - savings.savedYearlyCents);
      insights.push({
        id: "budget-savings",
        title: `${percent}% to your ${formatCents(savings.targetCents)} savings goal`,
        detail:
          savings.targetDate != null
            ? `${formatCents(remaining)} to go by ${savings.targetDate}.`
            : `${formatCents(remaining)} to go.`,
        tone: percent >= 100 ? "good" : "neutral",
      });
      if (savings.savedYearlyCents > 0) {
        insights.push({
          id: "budget-saved",
          title: `You've saved ${formatCents(savings.savedYearlyCents)} per year`,
          detail: savings.baselineDate ? `Since ${savings.baselineDate.slice(0, 10)}.` : "Since you set the baseline.",
          tone: "good",
        });
      }
    }
    return insights;
  }

  function addFromPopular(payload: PopularServiceAdd) {
    const subscription: Subscription = {
      id: createId("sub"),
      name: payload.name,
      costCents: payload.costCents,
      billingCycle: payload.billingCycle,
      category: payload.category,
      nextBillingDate: payload.nextBillingDate,
      notes: "",
      color: payload.color,
      icon: payload.icon,
      createdAt: new Date().toISOString(),
      currency: fxContext.baseCurrency,
    };

    setSubscriptions((current) => [subscription, ...current]);
    showToast(`${subscription.name} added.`);
  }

  function addImportedSubscription(subscription: Subscription) {
    setSubscriptions((current) => [subscription, ...current]);
    showToast(`${subscription.name} added.`);
  }

  function addSubscription() {
    const costCents = toCents(subscriptionDraft.cost);
    if (!subscriptionDraft.name.trim() || costCents <= 0 || !subscriptionDraft.nextBillingDate) {
      showToast("Add a service name, cost, and billing date.");
      return;
    }

    const subscription: Subscription = {
      id: createId("sub"),
      name: subscriptionDraft.name.trim(),
      costCents,
      billingCycle: subscriptionDraft.billingCycle,
      category: subscriptionDraft.category.trim() || "other",
      nextBillingDate: subscriptionDraft.nextBillingDate,
      notes: subscriptionDraft.notes.trim(),
      color: subscriptionDraft.color,
      icon: subscriptionDraft.icon,
      createdAt: new Date().toISOString(),
      currency: subscriptionDraft.currency || fxContext.baseCurrency,
      ...(subscriptionDraft.cancellingOn ? { cancellingOn: subscriptionDraft.cancellingOn } : {}),
      ...(subscriptionDraft.tags && subscriptionDraft.tags.length > 0 ? { tags: subscriptionDraft.tags } : {}),
      ...(subscriptionDraft.priceChanges && subscriptionDraft.priceChanges.length > 0
        ? { priceChanges: subscriptionDraft.priceChanges }
        : {}),
    };

    setSubscriptions((current) => [subscription, ...current]);
    setSubscriptionDraft(newSubscriptionDraft(fxContext.baseCurrency));
    showToast(`${subscription.name} added.`);
    recordHistory("addSubscription", `Added ${subscription.name}.`, null, subscription, [subscription.id]);
  }

  function startEditing(subscription: Subscription) {
    setEditingId(subscription.id);
    setEditingDraft({
      name: subscription.name,
      cost: (subscription.costCents / 100).toFixed(2),
      billingCycle: subscription.billingCycle,
      category: subscription.category,
      nextBillingDate: subscription.nextBillingDate,
      notes: subscription.notes,
      color: subscription.color ?? defaultCategoryColors[subscription.category] ?? "#ff5a3d",
      icon: subscription.icon ?? "wallet",
      currency: subscription.currency ?? fxContext.baseCurrency,
      cancellingOn: subscription.cancellingOn ?? "",
      tags: subscription.tags ? [...subscription.tags] : [],
      priceChanges: subscription.priceChanges ? [...subscription.priceChanges] : [],
    });
  }

  function saveEditing() {
    if (!editingId) {
      return;
    }

    const costCents = toCents(editingDraft.cost);
    if (!editingDraft.name.trim() || costCents <= 0 || !editingDraft.nextBillingDate) {
      showToast("Edited subscriptions need a name, cost, and billing date.");
      return;
    }

    setSubscriptions((current) =>
      current.map((subscription) =>
        subscription.id === editingId
          ? {
              ...subscription,
              name: editingDraft.name.trim(),
              costCents,
              billingCycle: editingDraft.billingCycle,
              category: editingDraft.category.trim() || "other",
              nextBillingDate: editingDraft.nextBillingDate,
              notes: editingDraft.notes.trim(),
              color: editingDraft.color,
              icon: editingDraft.icon,
              currency: editingDraft.currency || fxContext.baseCurrency,
              cancellingOn: editingDraft.cancellingOn || undefined,
              tags: editingDraft.tags.length > 0 ? editingDraft.tags : undefined,
              priceChanges: editingDraft.priceChanges.length > 0 ? editingDraft.priceChanges : undefined,
            }
          : subscription,
      ),
    );
    setEditingId(null);
    showToast("Subscription updated.");
  }

  function setCancellingOn(id: string, isoDate: string) {
    setSubscriptions((current) =>
      current.map((sub) => (sub.id === id ? { ...sub, cancellingOn: isoDate } : sub)),
    );
    const target = subscriptions.find((sub) => sub.id === id);
    showToast(target ? `${target.name} will cancel ${isoDate}.` : "Cancellation scheduled.");
  }

  function undoCancellation(id: string) {
    setSubscriptions((current) =>
      current.map((sub) => (sub.id === id ? { ...sub, cancellingOn: undefined } : sub)),
    );
    showToast("Cancellation undone.");
  }

  function deleteLedgerRow(recordId: string) {
    setLedger((current) => current.filter((row) => row.id !== recordId));
  }

  function undoLedgerRow(record: CancellationRecord) {
    const restored: Subscription = {
      id: createId("sub"),
      name: record.subscriptionName,
      costCents: record.monthlyCostCents,
      billingCycle: "monthly",
      category: record.category,
      nextBillingDate: todayDateInputValue(),
      notes: "",
      color: defaultCategoryColors[record.category] ?? "#9aa4b2",
      icon: "wallet",
      createdAt: new Date().toISOString(),
      currency: record.currency,
    };
    setSubscriptions((current) => [restored, ...current]);
    deleteLedgerRow(record.id);
    showToast(`${record.subscriptionName} restored.`);
  }

  function addManualLedgerEntry(input: {
    subscriptionName: string;
    category: string;
    monthlyCostCents: number;
    currency: string;
    cancelledOn: string;
    note?: string;
  }) {
    const record = buildManualLedgerRecord(input);
    setLedger((current) => [record, ...current]);
    showToast(`Logged ${record.subscriptionName} to savings ledger.`);
  }

  function dismissRecommendation(ruleId: string) {
    setDismissedRecommendations((current) => (current.includes(ruleId) ? current : [...current, ruleId]));
  }

  function updatePreferences(next: BurnRatePreferences) {
    setStoredPreferences(next);
  }

  async function enableVault(passphrase: string) {
    const { meta, key } = await createVaultMeta(passphrase);
    setVaultMeta(meta);
    setCryptoKey(key);
    showToast("Passphrase lock enabled.");
  }

  async function disableVault(passphrase: string) {
    try {
      await unlockVault(passphrase, vaultMeta);
    } catch {
      throw new Error("Incorrect passphrase.");
    }
    setVaultMeta(emptyVaultMeta);
    setCryptoKey(null);
    showToast("Passphrase lock disabled.");
  }

  function wipeAndDisableVault() {
    setVaultMeta(emptyVaultMeta);
    setCryptoKey(null);
    resetAllData();
  }

  async function handleUnlock(passphrase: string) {
    try {
      const key = await unlockVault(passphrase, vaultMeta);
      setCryptoKey(key);
      setFailedUnlockAttempts(0);
      showToast("Unlocked.");
    } catch {
      setFailedUnlockAttempts((current) => {
        const next = current + 1;
        if (next >= 5) {
          setUnlockCooldownSeconds(30);
        }
        return next;
      });
    }
  }

  function deleteSubscription(id: string) {
    const target = subscriptions.find((subscription) => subscription.id === id);
    setSubscriptions((current) => current.filter((subscription) => subscription.id !== id));
    showToast(target ? `${target.name} deleted.` : "Subscription deleted.");
    if (target) recordHistory("deleteSubscription", `Deleted ${target.name}.`, target, null, [target.id]);
  }

  function addTrial() {
    const costAfterTrialCents = toCents(trialDraft.costAfterTrial);
    if (!trialDraft.name.trim() || !trialDraft.trialStartDate || !trialDraft.trialEndDate) {
      showToast("Add a trial name and dates.");
      return;
    }

    const trial: Trial = {
      id: createId("trial"),
      name: trialDraft.name.trim(),
      trialStartDate: trialDraft.trialStartDate,
      trialEndDate: trialDraft.trialEndDate,
      costAfterTrialCents,
      remindMe: trialDraft.remindMe,
      createdAt: new Date().toISOString(),
      currency: fxContext.baseCurrency,
    };

    setTrials((current) => [trial, ...current]);
    setTrialDraft(newTrialDraft());
    showToast(`${trial.name} trial added.`);
  }

  function convertTrial(trial: Trial) {
    const subscription: Subscription = {
      id: createId("sub"),
      name: trial.name,
      costCents: trial.costAfterTrialCents,
      billingCycle: "monthly",
      category: "other",
      nextBillingDate: trial.trialEndDate < todayDateInputValue() ? todayDateInputValue() : trial.trialEndDate,
      notes: "Converted from free trial.",
      color: "#37f29b",
      icon: "sparkles",
      createdAt: new Date().toISOString(),
      currency: trial.currency ?? fxContext.baseCurrency,
    };

    setSubscriptions((current) => [subscription, ...current]);
    setTrials((current) => current.filter((item) => item.id !== trial.id));
    setActiveView("subscriptions");
    showToast(`${trial.name} converted.`);
  }

  function deleteTrial(id: string) {
    const target = trials.find((trial) => trial.id === id);
    setTrials((current) => current.filter((trial) => trial.id !== id));
    showToast(target ? `${target.name} trial removed.` : "Trial removed.");
  }

  function toggleSimulatorId(id: string) {
    setDisabledIds((current) => {
      const next = new Set(current);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function exportCsv() {
    const data: BurnRateData = { subscriptions, trials, theme, budget };
    const blob = new Blob([serializeBurnRateCsv(data)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `burnrate-${todayDateInputValue()}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    showToast("CSV exported.");
  }

  async function generateSyncLink() {
    const data: BurnRateData = { subscriptions, trials, theme };
    const payload = encodeSyncPayload(data);
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const url = `${origin}/#sync=${payload}`;
    try {
      if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
        showToast(`Sync link copied (${payload.length} chars).`);
        if (payload.length > 30000) {
          showToast("Sync payload is large — consider saving a .burn file instead.");
        }
      } else {
        showToast("Clipboard unavailable — save a .burn file instead.");
      }
    } catch {
      showToast("Clipboard blocked — save a .burn file instead.");
    }
  }

  async function generateLiveCalendarUrl() {
    const stripped: BurnRateData = {
      subscriptions: subscriptions.map((subscription) => ({ ...subscription, notes: "" })),
      trials: trials.map((trial) => ({ ...trial })),
      theme,
    };
    const payload = encodeSyncPayload(stripped);
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const httpsUrl = `${origin}/s/${payload}/calendar.ics`;
    const webcalUrl = httpsUrl.replace(/^https?:\/\//, "webcal://");
    try {
      if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(webcalUrl);
        showToast("Live calendar URL copied — paste into Google/Apple/Outlook Calendar.");
      } else {
        showToast("Clipboard unavailable.");
      }
    } catch {
      showToast("Could not copy live calendar URL.");
    }
  }

  async function generateShareLink() {
    const stripped: BurnRateData = {
      subscriptions: subscriptions.map((subscription) => ({ ...subscription, notes: "" })),
      trials: trials.map((trial) => ({ ...trial })),
      theme,
    };
    const payload = encodeSyncPayload(stripped);
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const url = `${origin}/s/${payload}`;
    try {
      if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
        showToast("Public share link copied.");
      } else {
        showToast("Clipboard unavailable.");
      }
    } catch {
      showToast("Could not copy share link.");
    }
  }

  function exportBurnFile() {
    const data: BurnRateData = { subscriptions, trials, theme };
    const payload = encodeSyncPayload(data);
    const blob = new Blob([payload], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `burnrate-${todayDateInputValue()}.burn`;
    link.click();
    URL.revokeObjectURL(url);
    showToast("Saved .burn file.");
  }

  async function importBurnFile(file: File | null) {
    if (!file) return;
    try {
      const payload = (await file.text()).trim();
      const summary = summarizeSyncPayload(payload);
      setPendingSyncPayload(payload);
      setSyncSummary(summary);
      setSyncError(null);
      setSyncModalOpen(true);
    } catch (error) {
      const message = error instanceof SyncDecodeError ? error.message : "Could not read .burn file.";
      setPendingSyncPayload(null);
      setSyncSummary(null);
      setSyncError(message);
      setSyncModalOpen(true);
    } finally {
      if (importBurnInputRef.current) {
        importBurnInputRef.current.value = "";
      }
    }
  }

  function handleSyncDecision(decision: SyncDecision) {
    if (decision === "cancel" || !pendingSyncPayload) {
      setSyncModalOpen(false);
      setPendingSyncPayload(null);
      setSyncSummary(null);
      setSyncError(null);
      if (typeof window !== "undefined" && window.location.hash.startsWith("#sync=")) {
        window.history.replaceState(null, "", window.location.pathname + window.location.search);
      }
      return;
    }
    try {
      const incoming = decodeSyncPayload(pendingSyncPayload);
      const current: BurnRateData = { subscriptions, trials, theme };
      const next = decision === "replace" ? incoming : mergeSync(current, incoming);
      setSubscriptions(next.subscriptions);
      setTrials(next.trials);
      if (decision === "replace") {
        setTheme(next.theme);
      }
      showToast(decision === "replace" ? "Data replaced from sync link." : "Data merged from sync link.");
    } catch (error) {
      const message = error instanceof SyncDecodeError ? error.message : "Sync failed.";
      showToast(message);
    } finally {
      setSyncModalOpen(false);
      setPendingSyncPayload(null);
      setSyncSummary(null);
      setSyncError(null);
      if (typeof window !== "undefined" && window.location.hash.startsWith("#sync=")) {
        window.history.replaceState(null, "", window.location.pathname + window.location.search);
      }
    }
  }

  function exportIcs() {
    const data: BurnRateData = { subscriptions, trials, theme };
    const blob = new Blob([serializeBurnRateIcs(data)], { type: "text/calendar;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `burnrate-calendar-${todayDateInputValue()}.ics`;
    link.click();
    URL.revokeObjectURL(url);
    showToast("Calendar exported.");
  }

  async function importCsv(file: File | null) {
    if (!file) {
      return;
    }

    try {
      const parsed = parseBurnRateCsv(await file.text());
      setSubscriptions(parsed.subscriptions);
      setTrials(parsed.trials);
      setTheme(parsed.theme);
      setBudget(parsed.budget ?? emptyBudget);
      setDisabledIds(new Set());
      showToast("CSV imported.");
    } catch {
      showToast("That CSV could not be imported.");
    } finally {
      if (importInputRef.current) {
        importInputRef.current.value = "";
      }
    }
  }

  function resetAllData() {
    const confirmed = window.confirm("Reset all BurnRate data stored in this browser?");
    if (!confirmed) {
      return;
    }

    setSubscriptions([]);
    setTrials([]);
    setDismissedAlerts({});
    setBudget(emptyBudget);
    setDisabledIds(new Set());
    setEditingId(null);
    showToast("All data reset.");
  }

  function dismissAlert(key: string) {
    setDismissedAlerts((current) => ({ ...current, [key]: true }));
  }

  async function requestNotificationPermission() {
    if (typeof window === "undefined" || typeof Notification === "undefined") {
      showToast("Notifications aren't supported in this browser.");
      return;
    }
    try {
      const result = await Notification.requestPermission();
      setNotificationPermission(result as NotificationPermissionState);
      if (result === "granted") {
        showToast("Browser notifications enabled.");
      } else if (result === "denied") {
        showToast("Browser notifications blocked.");
      }
    } catch {
      showToast("Could not request notification permission.");
    }
  }

  async function downloadSummaryPng() {
    if (!shareCardRef.current || isImageBusy) {
      return;
    }

    setIsImageBusy(true);
    try {
      const { default: html2canvas } = await import("html2canvas");
      const canvas = await html2canvas(shareCardRef.current, {
        backgroundColor: null,
        scale: 2,
      });

      canvas.toBlob((blob) => {
        if (!blob) {
          showToast("Summary image failed.");
          return;
        }
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `burnrate-summary-${todayDateInputValue()}.png`;
        link.click();
        URL.revokeObjectURL(url);
        showToast("Summary image downloaded.");
      }, "image/png");
    } catch {
      showToast("Summary image failed.");
    } finally {
      setIsImageBusy(false);
    }
  }

  // Before first client paint, render a neutral shell so subscription data never
  // flashes when the vault is enabled. After hydration, branch to the lock screen
  // when locked, otherwise fall through to the main app.
  if (!hasHydrated) {
    return (
      <div
        className={clsx("app-shell", theme === "light" ? "theme-light" : "theme-dark")}
        aria-busy="true"
      />
    );
  }

  if (isLocked) {
    return (
      <LockScreen
        attemptsRemaining={Math.max(0, 5 - failedUnlockAttempts)}
        cooldownSeconds={unlockCooldownSeconds}
        onUnlock={handleUnlock}
        recoveryHint="If you have a sync link from another device, you can recover with it."
      />
    );
  }

  return (
    <div className={clsx("app-shell", theme === "light" ? "theme-light" : "theme-dark")}>
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>

      <header className="mx-auto grid w-full max-w-7xl gap-5 px-4 pb-4 pt-5 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <div className="grid h-12 w-12 place-items-center rounded-panel border border-[color:var(--line)] bg-[color:var(--panel-strong)] text-[color:var(--accent)] shadow-glow">
              <Flame aria-hidden="true" size={28} />
            </div>
            <div>
              <p className="text-xs font-extrabold uppercase tracking-[0.28em] text-[color:var(--accent-2)]">
                Static local tracker
              </p>
              <h1 className="font-display text-5xl leading-none tracking-normal sm:text-6xl">BurnRate</h1>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <ServiceWorkerRegistrar />
            <button
              type="button"
              className="icon-button"
              aria-label="Open history"
              onClick={() => setHistoryOpen(true)}
            >
              <span className="text-xs font-extrabold tracking-tight">⟲</span>
            </button>
            <button
              type="button"
              className="icon-button"
              aria-label="Open command palette"
              onClick={() => setPaletteOpen(true)}
            >
              <span className="text-xs font-extrabold tracking-tight">⌘K</span>
            </button>
            <button
              className="button-secondary"
              type="button"
              onClick={() => {
                setActiveView("subscriptions");
                window.setTimeout(() => document.getElementById("add-subscription-name")?.focus(), 50);
              }}
            >
              <Plus aria-hidden="true" size={18} />
              Quick add
            </button>
            <button
              className="icon-button"
              type="button"
              aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
              onClick={() => setTheme((current) => (current === "dark" ? "light" : "dark"))}
            >
              {theme === "dark" ? <Sun aria-hidden="true" size={18} /> : <Moon aria-hidden="true" size={18} />}
            </button>
          </div>
        </div>

        <HeroMetrics monthlyCents={metrics.monthlyBurnCents} yearlyCents={metrics.yearlyBurnCents} />

        <nav className="flex flex-wrap gap-2 pb-1" aria-label="Primary">
          {views.map(({ id, label, Icon }) => (
            <button
              key={id}
              className={clsx(
                "button-ghost shrink-0",
                activeView === id && "border-[color:var(--accent)] bg-[color:var(--panel-strong)] text-[color:var(--text)]",
              )}
              type="button"
              aria-pressed={activeView === id}
              onClick={() => setActiveView(id)}
            >
              <Icon aria-hidden="true" size={17} />
              {label}
            </button>
          ))}
        </nav>
      </header>

      <main id="main-content" className="mx-auto w-full max-w-7xl px-4 pb-12 sm:px-6 lg:px-8">
        {hasHydrated && pendingAlerts.length > 0 && (
          <div className="mb-5">
            <TrialAlerts
              alerts={pendingAlerts}
              onConvert={convertTrial}
              onDismiss={dismissAlert}
              onRequestPermission={requestNotificationPermission}
              permission={notificationPermission}
            />
          </div>
        )}

        {activeView === "dashboard" && (
          <div className="grid gap-4">
            {subscriptions.length === 0 && (
              <PopularServicesPicker existing={subscriptions} onAdd={addFromPopular} />
            )}
            <BudgetTracker
              budget={budget}
              monthlyBurnCents={metrics.monthlyBurnCents}
              yearlyBurnCents={metrics.yearlyBurnCents}
              onChangeBudget={setBudget}
              subscriptions={subscriptions}
            />
            <PendingCancellations fx={fxContext} onUndo={undoCancellation} subscriptions={subscriptions} />
            <SmarterAlternatives
              dismissedIds={dismissedRecommendations}
              fx={fxContext}
              onCancelSubscription={(id) => {
                setActiveView("subscriptions");
                const sub = subscriptions.find((s) => s.id === id);
                if (sub) {
                  const date = (() => {
                    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(sub.nextBillingDate);
                    if (!match) return todayDateInputValue();
                    const d = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
                    d.setDate(d.getDate() - 1);
                    return todayDateInputValue(d);
                  })();
                  setCancellingOn(id, date);
                }
              }}
              onDismiss={dismissRecommendation}
              subscriptions={subscriptions}
            />
            <TrendsPanel fx={fxContext} monthlyBurnCents={metrics.monthlyBurnCents} snapshots={snapshots} />
            <ChargeCalendarPanel subscriptions={subscriptions} fx={fxContext} now={now} />
            <GoalsPanel
              goals={storedGoals}
              state={{
                subscriptions,
                snapshots,
                monthlyBurnCents: metrics.monthlyBurnCents,
                yearlyBurnCents: metrics.yearlyBurnCents,
              }}
              fx={fxContext}
              onChange={setStoredGoals}
              now={now}
            />
            <UsageInsights
              subscriptions={subscriptions}
              fx={fxContext}
              now={now}
              onCancelCoach={openCancellationCoach}
            />
            <RetentionLog subscriptions={subscriptions} fx={fxContext} now={now} />
            <PerProfileBurn profiles={profiles} subscriptions={subscriptions} fx={fxContext} />
            <SavingsLedger fx={fxContext} onDelete={deleteLedgerRow} onUndo={undoLedgerRow} records={ledger} />
            <Dashboard
              budgetInsights={buildBudgetInsights(metrics.monthlyBurnCents, metrics.yearlyBurnCents, budget)}
              metrics={metrics}
              subscriptions={subscriptions}
              trials={trials}
              onQuickAdd={() => setActiveView("subscriptions")}
            />
          </div>
        )}

        {activeView === "subscriptions" && (
          <div className="grid gap-4">
            <div className="flex justify-end">
              <button
                className="button-secondary"
                type="button"
                aria-expanded={pickerOpen}
                onClick={() => setPickerOpen((current) => !current)}
              >
                <Plus aria-hidden="true" size={17} />
                {pickerOpen ? "Hide popular services" : "Add from popular services"}
              </button>
            </div>
            {pickerOpen && <PopularServicesPicker existing={subscriptions} onAdd={addFromPopular} />}
            <SavedViewsPills
              views={savedViews}
              activeViewId={activeViewId}
              onSelect={setActiveViewId}
              onClear={() => setActiveViewId(null)}
              onSave={saveCurrentAsView}
              onDelete={deleteSavedView}
            />
            <SubscriptionManager
              categoryFilter={categoryFilter}
              categoryOptions={categoryOptions}
              deleteSubscription={deleteSubscription}
              draft={subscriptionDraft}
              editingDraft={editingDraft}
              editingId={editingId}
              fx={fxContext}
              knownTags={knownTags}
              onAdd={addSubscription}
              onCancelEdit={() => setEditingId(null)}
              onCancelSubscription={setCancellingOn}
              onUndoCancellation={undoCancellation}
              onDraftChange={setSubscriptionDraft}
              onEditDraftChange={setEditingDraft}
              onSaveEdit={saveEditing}
              onStartEdit={startEditing}
              searchQuery={searchQuery}
              selectedIds={selectedIds}
              onToggleSelect={toggleSelectedId}
              onSelectAll={selectAllVisible}
              setCategoryFilter={setCategoryFilter}
              setSearchQuery={setSearchQuery}
              setSortKey={setSortKey}
              sortKey={sortKey}
              subscriptions={visibleSubscriptions}
            />
            <BulkActionBar
              selectedIds={selectedIds}
              subscriptions={subscriptions}
              onApplyPatch={applyBulkPatchToSelection}
              onDelete={applyBulkDeleteToSelection}
              onClear={() => setSelectedIds(new Set())}
            />
          </div>
        )}

        {activeView === "trials" && (
          <TrialTracker
            convertTrial={convertTrial}
            deleteTrial={deleteTrial}
            draft={trialDraft}
            onAdd={addTrial}
            onDraftChange={setTrialDraft}
            trials={trials}
          />
        )}

        {activeView === "simulator" && (
          <Simulator
            disabledIds={disabledIds}
            impact={simulatorImpact}
            subscriptions={subscriptions}
            toggleId={toggleSimulatorId}
          />
        )}

        {activeView === "share" && (
          <div className="grid gap-4">
            <div className="grid gap-4 lg:grid-cols-2">
              <section className="panel p-5">
                <CurrencySettings
                  onChange={updatePreferences}
                  preferences={preferences}
                  subscriptions={subscriptions}
                  trials={trials}
                />
              </section>
              <section className="panel p-5">
                <SecuritySettings
                  controls={{
                    enabled: vaultMeta.enabled,
                    onEnable: enableVault,
                    onDisableWithPassphrase: disableVault,
                    onWipe: wipeAndDisableVault,
                  }}
                  onPreferencesChange={updatePreferences}
                  preferences={preferences}
                />
              </section>
            </div>
            <ProfileSettings
              state={{
                theme,
                preferences,
                views: savedViews,
                categories: buildBuiltInCategories(),
              }}
              appVersion="4.0.0"
              onApply={(next: ProfileSettingsState) => {
                if (next.theme !== theme) setTheme(next.theme);
                updatePreferences(next.preferences);
                setStoredViews(next.views.filter((view) => !["all-subs", "yearly-only", "cancelling-soon"].includes(view.id)));
                showToast("Profile applied.");
              }}
            />
            <CategorySettings
              stored={storedCategories}
              subscriptions={subscriptions}
              trials={trials}
              onChange={setStoredCategories}
            />
            <ProfilesPanel
              profiles={profiles}
              subscriptions={subscriptions}
              onProfilesChange={setStoredProfiles}
              onSubsChange={setSubscriptions}
            />
            <DecoySetup
              vaultMeta={vaultMeta as VaultMetaWithDecoy}
              onChange={(next) => setVaultMeta(next)}
            />
            <VaultManager registry={vaultRegistry} onChange={setStoredVaultRegistry} />
            <DashboardLayoutEditor layout={storedLayout} onChange={setStoredLayout} />
            <PeerSyncFlow
              buildPayload={() =>
                encodeSyncPayload({
                  subscriptions,
                  trials,
                  theme,
                })
              }
              onPayloadReceived={(payload) => {
                try {
                  setPendingSyncPayload(payload);
                  setSyncSummary(summarizeSyncPayload(payload));
                  setSyncError(null);
                  setSyncModalOpen(true);
                } catch (error) {
                  const message = error instanceof SyncDecodeError ? error.message : "Could not read payload.";
                  setSyncError(message);
                  setSyncSummary(null);
                  setSyncModalOpen(true);
                }
              }}
            />
            <NotificationSettings
              settings={notifySettings}
              onChange={setNotifySettings}
              supportsPeriodicSync={
                typeof window !== "undefined" &&
                typeof ServiceWorkerRegistration !== "undefined" &&
                "periodicSync" in ServiceWorkerRegistration.prototype
              }
              onTest={() => {
                if (typeof Notification === "undefined") return;
                if (Notification.permission === "granted") {
                  try {
                    new Notification("BurnRate test notification", { body: "Notifications are working." });
                  } catch {
                    showToast("Test notification blocked by browser.");
                  }
                } else {
                  showToast("Grant notification permission first.");
                }
              }}
            />
            <ChargesImporter
              baseCurrency={fxContext.baseCurrency}
              onAdd={addImportedSubscription}
              subscriptions={subscriptions}
            />
            <ShareAndData
              exportBurnFile={exportBurnFile}
              exportCsv={exportCsv}
              exportIcs={exportIcs}
              generateLiveCalendarUrl={generateLiveCalendarUrl}
              generateShareLink={generateShareLink}
              generateSyncLink={generateSyncLink}
              importBurnFile={importBurnFile}
              importBurnInputRef={importBurnInputRef}
              importCsv={importCsv}
              importInputRef={importInputRef}
              isImageBusy={isImageBusy}
              metrics={metrics}
              onDownloadImage={downloadSummaryPng}
              resetAllData={resetAllData}
              shareCardRef={shareCardRef}
              subscriptions={subscriptions}
              trials={trials}
            />
          </div>
        )}
      </main>

      <SyncModal
        open={syncModalOpen}
        summary={syncSummary}
        error={syncError}
        onDecision={handleSyncDecision}
      />

      <CommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        commands={paletteCommands}
        fx={fxContext}
      />

      <CancellationCoach
        open={Boolean(coachSub)}
        subscription={coachSub}
        onClose={() => setCoachSubId(null)}
        onComplete={handleCoachComplete}
      />

      <HistoryDrawer
        open={historyOpen}
        entries={historyEntries}
        onClose={() => setHistoryOpen(false)}
        onUndo={undoFromHistory}
        onClear={() => setStoredHistory([])}
      />

      <div
        className="pointer-events-none fixed bottom-4 left-1/2 z-50 flex -translate-x-1/2 flex-col items-center gap-2"
        role="status"
        aria-live="polite"
      >
        {toasts.map((entry) => (
          <div
            key={entry.id}
            className="rounded-panel border border-[color:var(--line)] bg-[color:var(--panel)] px-4 py-3 text-sm font-bold shadow-2xl"
          >
            {entry.message}
          </div>
        ))}
      </div>
    </div>
  );
}
