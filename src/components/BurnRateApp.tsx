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
import { Dashboard } from "./Dashboard";
import { HeroMetrics } from "./HeroMetrics";
import { ShareAndData } from "./ShareAndData";
import { Simulator } from "./Simulator";
import { SubscriptionManager } from "./SubscriptionManager";
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
  { id: "share", label: "Share", Icon: Share2 },
];

export function BurnRateApp() {
  const [subscriptions, setSubscriptions] = useLocalStorage<Subscription[]>(storageKeys.subscriptions, []);
  const [trials, setTrials] = useLocalStorage<Trial[]>(storageKeys.trials, []);
  const [theme, setTheme] = useLocalStorage<Theme>(storageKeys.theme, "dark");
  const [activeView, setActiveView] = useState<View>("dashboard");
  const [subscriptionDraft, setSubscriptionDraft] = useState<SubscriptionDraft>(() => newSubscriptionDraft());
  const [trialDraft, setTrialDraft] = useState<TrialDraft>(() => newTrialDraft());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingDraft, setEditingDraft] = useState<SubscriptionDraft>(() => newSubscriptionDraft());
  const [sortKey, setSortKey] = useState<SortKey>("nextBillingDate");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [disabledIds, setDisabledIds] = useState<Set<string>>(() => new Set());
  const [toast, setToast] = useState("");
  const [isImageBusy, setIsImageBusy] = useState(false);
  const importInputRef = useRef<HTMLInputElement>(null);
  const shareCardRef = useRef<HTMLDivElement>(null);

  const metrics = useMemo(() => calculateBurnMetrics(subscriptions, new Date()), [subscriptions]);
  const simulatorImpact = useMemo(
    () => calculateSimulatorImpact(subscriptions, disabledIds),
    [disabledIds, subscriptions],
  );
  const categoryOptions = useMemo(() => {
    const values = new Set<string>(defaultCategories);
    subscriptions.forEach((subscription) => values.add(subscription.category));
    return [...values].sort((a, b) => a.localeCompare(b));
  }, [subscriptions]);
  const visibleSubscriptions = useMemo(() => {
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
  }, [categoryFilter, searchQuery, sortKey, subscriptions]);

  useEffect(() => {
    document.documentElement.style.colorScheme = theme;
  }, [theme]);

  useEffect(() => {
    setDisabledIds((current) => {
      const validIds = new Set(subscriptions.map((subscription) => subscription.id));
      return new Set([...current].filter((id) => validIds.has(id)));
    });
  }, [subscriptions]);

  useEffect(() => {
    if (!toast) {
      return;
    }

    const timeout = window.setTimeout(() => setToast(""), 2400);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  function showToast(message: string) {
    setToast(message);
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
    };

    setSubscriptions((current) => [subscription, ...current]);
    setSubscriptionDraft(newSubscriptionDraft());
    showToast(`${subscription.name} added.`);
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
            }
          : subscription,
      ),
    );
    setEditingId(null);
    showToast("Subscription updated.");
  }

  function deleteSubscription(id: string) {
    const target = subscriptions.find((subscription) => subscription.id === id);
    setSubscriptions((current) => current.filter((subscription) => subscription.id !== id));
    showToast(target ? `${target.name} deleted.` : "Subscription deleted.");
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
    const data: BurnRateData = { subscriptions, trials, theme };
    const blob = new Blob([serializeBurnRateCsv(data)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `burnrate-${todayDateInputValue()}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    showToast("CSV exported.");
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
    setDisabledIds(new Set());
    setEditingId(null);
    showToast("All data reset.");
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
        {activeView === "dashboard" && (
          <Dashboard
            metrics={metrics}
            subscriptions={subscriptions}
            trials={trials}
            onQuickAdd={() => setActiveView("subscriptions")}
          />
        )}

        {activeView === "subscriptions" && (
          <SubscriptionManager
            categoryFilter={categoryFilter}
            categoryOptions={categoryOptions}
            deleteSubscription={deleteSubscription}
            draft={subscriptionDraft}
            editingDraft={editingDraft}
            editingId={editingId}
            onAdd={addSubscription}
            onCancelEdit={() => setEditingId(null)}
            onDraftChange={setSubscriptionDraft}
            onEditDraftChange={setEditingDraft}
            onSaveEdit={saveEditing}
            onStartEdit={startEditing}
            searchQuery={searchQuery}
            setCategoryFilter={setCategoryFilter}
            setSearchQuery={setSearchQuery}
            setSortKey={setSortKey}
            sortKey={sortKey}
            subscriptions={visibleSubscriptions}
          />
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
          <ShareAndData
            exportCsv={exportCsv}
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
        )}
      </main>

      <div
        className={clsx(
          "fixed bottom-4 left-1/2 z-50 -translate-x-1/2 rounded-panel border border-[color:var(--line)] bg-[color:var(--panel)] px-4 py-3 text-sm font-bold shadow-2xl transition",
          toast ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-4 opacity-0",
        )}
        role="status"
        aria-live="polite"
      >
        {toast}
      </div>
    </div>
  );
}
