"use client";

import {
  Activity,
  ArrowDownToLine,
  BarChart3,
  BellRing,
  BriefcaseBusiness,
  CalendarClock,
  Check,
  Cloud,
  Code2,
  Download,
  Dumbbell,
  Flame,
  Gamepad2,
  ListFilter,
  Moon,
  Music,
  Newspaper,
  Pencil,
  Plus,
  RefreshCcw,
  Save,
  Search,
  Share2,
  Sparkles,
  Sun,
  Trash2,
  Tv,
  Upload,
  Utensils,
  WalletCards,
  X,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { clsx } from "clsx";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import {
  addDaysDateInputValue,
  billingCycles,
  calculateBurnMetrics,
  calculateSimulatorImpact,
  createId,
  defaultCategories,
  defaultCategoryColors,
  formatCents,
  getTrialStatus,
  monthlyCostCents,
  parseBurnRateCsv,
  serializeBurnRateCsv,
  toCents,
  todayDateInputValue,
  yearlyCostCents,
  type BillingCycle,
  type BurnRateData,
  type CategoryBreakdown,
  type Insight,
  type Renewal,
  type Subscription,
  type Theme,
  type Trial,
} from "@/lib/burnrate";

type View = "dashboard" | "subscriptions" | "trials" | "simulator" | "share";
type SortKey = "cost" | "name" | "nextBillingDate" | "category";

interface SubscriptionDraft {
  name: string;
  cost: string;
  billingCycle: BillingCycle;
  category: string;
  nextBillingDate: string;
  notes: string;
  color: string;
  icon: string;
}

interface TrialDraft {
  name: string;
  trialStartDate: string;
  trialEndDate: string;
  costAfterTrial: string;
  remindMe: boolean;
}

const storageKeys = {
  subscriptions: "burnrate.subscriptions.v1",
  trials: "burnrate.trials.v1",
  theme: "burnrate.theme.v1",
};

const views: Array<{ id: View; label: string; Icon: LucideIcon }> = [
  { id: "dashboard", label: "Dashboard", Icon: BarChart3 },
  { id: "subscriptions", label: "Subscriptions", Icon: WalletCards },
  { id: "trials", label: "Trials", Icon: BellRing },
  { id: "simulator", label: "What If", Icon: RefreshCcw },
  { id: "share", label: "Share", Icon: Share2 },
];

const iconMap: Record<string, LucideIcon> = {
  tv: Tv,
  briefcase: BriefcaseBusiness,
  dumbbell: Dumbbell,
  music: Music,
  cloud: Cloud,
  newspaper: Newspaper,
  gamepad: Gamepad2,
  utensils: Utensils,
  wallet: WalletCards,
  code: Code2,
  activity: Activity,
  sparkles: Sparkles,
};

const iconOptions = [
  { value: "wallet", label: "Wallet" },
  { value: "tv", label: "TV" },
  { value: "briefcase", label: "Work" },
  { value: "dumbbell", label: "Fitness" },
  { value: "music", label: "Music" },
  { value: "cloud", label: "Cloud" },
  { value: "newspaper", label: "News" },
  { value: "gamepad", label: "Gaming" },
  { value: "utensils", label: "Food" },
  { value: "code", label: "Code" },
  { value: "activity", label: "Activity" },
];

function newSubscriptionDraft(): SubscriptionDraft {
  return {
    name: "",
    cost: "",
    billingCycle: "monthly",
    category: "other",
    nextBillingDate: todayDateInputValue(),
    notes: "",
    color: "#ff5a3d",
    icon: "wallet",
  };
}

function newTrialDraft(): TrialDraft {
  return {
    name: "",
    trialStartDate: todayDateInputValue(),
    trialEndDate: addDaysDateInputValue(14),
    costAfterTrial: "",
    remindMe: true,
  };
}

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

function HeroMetrics({ monthlyCents, yearlyCents }: { monthlyCents: number; yearlyCents: number }) {
  return (
    <section className="panel overflow-hidden">
      <div className="grid gap-0 lg:grid-cols-[1.4fr_0.6fr]">
        <div className="border-b border-[color:var(--line)] p-5 lg:border-b-0 lg:border-r lg:p-7">
          <p className="mb-3 text-sm font-extrabold uppercase tracking-[0.22em] text-[color:var(--accent)]">
            Monthly burn
          </p>
          <AnimatedMoney className="stat-number text-[clamp(4.6rem,16vw,11rem)]" value={monthlyCents} />
          <p className="mt-3 max-w-2xl text-sm font-semibold text-[color:var(--muted)] sm:text-base">
            Normalized across weekly, monthly, quarterly, and yearly billing cycles.
          </p>
        </div>
        <div className="grid content-between gap-6 p-5 lg:p-7">
          <div>
            <p className="text-xs font-extrabold uppercase tracking-[0.22em] text-[color:var(--accent-2)]">
              Yearly burn
            </p>
            <AnimatedMoney className="stat-number mt-2 text-6xl sm:text-7xl" value={yearlyCents} />
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-[color:var(--panel-soft)]" aria-hidden="true">
            <div
              className="h-full rounded-full bg-[color:var(--accent)] transition-all duration-500"
              style={{ width: `${Math.min(100, yearlyCents / 12000)}%` }}
            />
          </div>
        </div>
      </div>
    </section>
  );
}

function Dashboard({
  metrics,
  onQuickAdd,
  subscriptions,
  trials,
}: {
  metrics: ReturnType<typeof calculateBurnMetrics>;
  onQuickAdd: () => void;
  subscriptions: Subscription[];
  trials: Trial[];
}) {
  return (
    <div className="grid gap-4 lg:grid-cols-[1.05fr_0.95fr]">
      <section className="panel p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-extrabold">Category breakdown</h2>
            <p className="text-sm text-[color:var(--muted)]">{subscriptions.length} active subscriptions</p>
          </div>
          <button className="button-secondary" type="button" onClick={onQuickAdd}>
            <Plus aria-hidden="true" size={17} />
            Add
          </button>
        </div>
        {metrics.categoryBreakdown.length > 0 ? (
          <div className="grid gap-5 md:grid-cols-[1fr_0.9fr]">
            <div className="h-72 min-h-72">
              <ResponsiveContainer
                width="100%"
                height="100%"
                minWidth={0}
                minHeight={280}
                initialDimension={{ width: 360, height: 280 }}
              >
                <PieChart>
                  <Pie
                    data={metrics.categoryBreakdown}
                    dataKey="monthlyCents"
                    nameKey="category"
                    innerRadius="58%"
                    outerRadius="86%"
                    paddingAngle={3}
                    stroke="var(--panel)"
                    strokeWidth={4}
                  >
                    {metrics.categoryBreakdown.map((entry) => (
                      <Cell
                        key={entry.category}
                        fill={defaultCategoryColors[entry.category] ?? "#ff5a3d"}
                      />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => formatCents(Number(value))} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <CategoryLegend breakdown={metrics.categoryBreakdown} />
          </div>
        ) : (
          <EmptyState
            Icon={WalletCards}
            title="No recurring charges yet"
            body="Add your first subscription and the burn chart will build itself."
            actionLabel="Add subscription"
            onAction={onQuickAdd}
          />
        )}
      </section>

      <section className="panel p-5">
        <div className="mb-4">
          <h2 className="text-xl font-extrabold">Upcoming renewals</h2>
          <p className="text-sm text-[color:var(--muted)]">Next 7 and 30 days</p>
        </div>
        <RenewalList renewals={metrics.upcomingRenewals.next7} title="Next 7 days" />
        <div className="my-4 h-px bg-[color:var(--line)]" />
        <RenewalList renewals={metrics.upcomingRenewals.next30} title="Next 30 days" />
      </section>

      <section className="panel p-5 lg:col-span-2">
        <div className="mb-4 flex items-center gap-2">
          <Sparkles aria-hidden="true" className="text-[color:var(--accent-2)]" size={20} />
          <h2 className="text-xl font-extrabold">Smart insights</h2>
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          {metrics.insights.slice(0, 3).map((insight) => (
            <InsightTile key={insight.id} insight={insight} />
          ))}
        </div>
      </section>

      <section className="panel p-5 lg:col-span-2">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-extrabold">Trial watch</h2>
            <p className="text-sm text-[color:var(--muted)]">{trials.length} free trials tracked</p>
          </div>
        </div>
        {trials.length > 0 ? (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {trials.slice(0, 3).map((trial) => (
              <TrialCard key={trial.id} convertTrial={() => undefined} deleteTrial={() => undefined} trial={trial} compact />
            ))}
          </div>
        ) : (
          <EmptyState Icon={BellRing} title="No trial timers" body="Track free trials before they become paid plans." />
        )}
      </section>
    </div>
  );
}

function SubscriptionManager({
  categoryFilter,
  categoryOptions,
  deleteSubscription,
  draft,
  editingDraft,
  editingId,
  onAdd,
  onCancelEdit,
  onDraftChange,
  onEditDraftChange,
  onSaveEdit,
  onStartEdit,
  searchQuery,
  setCategoryFilter,
  setSearchQuery,
  setSortKey,
  sortKey,
  subscriptions,
}: {
  categoryFilter: string;
  categoryOptions: string[];
  deleteSubscription: (id: string) => void;
  draft: SubscriptionDraft;
  editingDraft: SubscriptionDraft;
  editingId: string | null;
  onAdd: () => void;
  onCancelEdit: () => void;
  onDraftChange: (draft: SubscriptionDraft) => void;
  onEditDraftChange: (draft: SubscriptionDraft) => void;
  onSaveEdit: () => void;
  onStartEdit: (subscription: Subscription) => void;
  searchQuery: string;
  setCategoryFilter: (value: string) => void;
  setSearchQuery: (value: string) => void;
  setSortKey: (value: SortKey) => void;
  sortKey: SortKey;
  subscriptions: Subscription[];
}) {
  return (
    <div className="grid gap-4">
      <section className="panel p-5">
        <div className="mb-4 flex items-center gap-2">
          <Plus aria-hidden="true" className="text-[color:var(--accent)]" size={20} />
          <h2 className="text-xl font-extrabold">Add subscription</h2>
        </div>
        <SubscriptionForm
          buttonLabel="Add subscription"
          draft={draft}
          idPrefix="add-subscription"
          onChange={onDraftChange}
          onSubmit={onAdd}
        />
      </section>

      <section className="panel p-5">
        <div className="mb-4 grid gap-3 lg:grid-cols-[1fr_auto_auto]">
          <label className="label">
            Search
            <span className="relative">
              <Search
                aria-hidden="true"
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[color:var(--subtle)]"
                size={17}
              />
              <input
                className="input pl-10"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Service or category"
                type="search"
              />
            </span>
          </label>
          <label className="label min-w-48">
            Filter
            <select
              className="input"
              value={categoryFilter}
              onChange={(event) => setCategoryFilter(event.target.value)}
            >
              <option value="all">All categories</option>
              {categoryOptions.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
          </label>
          <label className="label min-w-48">
            Sort
            <select className="input" value={sortKey} onChange={(event) => setSortKey(event.target.value as SortKey)}>
              <option value="nextBillingDate">Next billing</option>
              <option value="cost">Cost</option>
              <option value="name">Name</option>
              <option value="category">Category</option>
            </select>
          </label>
        </div>

        {subscriptions.length > 0 ? (
          <div className="grid gap-3">
            {subscriptions.map((subscription) =>
              editingId === subscription.id ? (
                <div key={subscription.id} className="rounded-panel border border-[color:var(--accent-2)] p-4">
                  <SubscriptionForm
                    buttonLabel="Save changes"
                    draft={editingDraft}
                    idPrefix={`edit-${subscription.id}`}
                    onCancel={onCancelEdit}
                    onChange={onEditDraftChange}
                    onSubmit={onSaveEdit}
                  />
                </div>
              ) : (
                <SubscriptionRow
                  key={subscription.id}
                  deleteSubscription={deleteSubscription}
                  onStartEdit={onStartEdit}
                  subscription={subscription}
                />
              ),
            )}
          </div>
        ) : (
          <EmptyState
            Icon={ListFilter}
            title="No subscriptions match"
            body="Adjust filters or add a recurring charge."
          />
        )}
      </section>
    </div>
  );
}

function SubscriptionForm({
  buttonLabel,
  draft,
  idPrefix,
  onCancel,
  onChange,
  onSubmit,
}: {
  buttonLabel: string;
  draft: SubscriptionDraft;
  idPrefix: string;
  onCancel?: () => void;
  onChange: (draft: SubscriptionDraft) => void;
  onSubmit: () => void;
}) {
  const categoryListId = `${idPrefix}-categories`;

  return (
    <form
      className="grid gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
    >
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <label className="label">
          Service name
          <input
            id={`${idPrefix}-name`}
            className="input"
            value={draft.name}
            onChange={(event) => onChange({ ...draft, name: event.target.value })}
            placeholder="Spotify"
          />
        </label>
        <label className="label">
          Cost
          <input
            className="input"
            inputMode="decimal"
            value={draft.cost}
            onChange={(event) => onChange({ ...draft, cost: event.target.value })}
            placeholder="12.99"
          />
        </label>
        <label className="label">
          Billing cycle
          <select
            className="input"
            value={draft.billingCycle}
            onChange={(event) => onChange({ ...draft, billingCycle: event.target.value as BillingCycle })}
          >
            {billingCycles.map((cycle) => (
              <option key={cycle} value={cycle}>
                {cycle}
              </option>
            ))}
          </select>
        </label>
        <label className="label">
          Next billing
          <input
            className="input"
            type="date"
            value={draft.nextBillingDate}
            onChange={(event) => onChange({ ...draft, nextBillingDate: event.target.value })}
          />
        </label>
      </div>

      <div className="grid gap-3 md:grid-cols-[1fr_auto_auto]">
        <label className="label">
          Category
          <input
            className="input"
            list={categoryListId}
            value={draft.category}
            onChange={(event) => onChange({ ...draft, category: event.target.value })}
          />
          <datalist id={categoryListId}>
            {defaultCategories.map((category) => (
              <option key={category} value={category} />
            ))}
          </datalist>
        </label>
        <label className="label min-w-32">
          Color
          <input
            className="input h-[46px] p-1"
            type="color"
            value={draft.color}
            onChange={(event) => onChange({ ...draft, color: event.target.value })}
          />
        </label>
        <label className="label min-w-40">
          Icon
          <select className="input" value={draft.icon} onChange={(event) => onChange({ ...draft, icon: event.target.value })}>
            {iconOptions.map((icon) => (
              <option key={icon.value} value={icon.value}>
                {icon.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label className="label">
        Notes
        <textarea
          className="input min-h-24 resize-y"
          value={draft.notes}
          onChange={(event) => onChange({ ...draft, notes: event.target.value })}
          placeholder="Plan details, cancellation path, shared account..."
        />
      </label>

      <div className="flex flex-wrap gap-2">
        <button className="button-primary" type="submit">
          <Save aria-hidden="true" size={17} />
          {buttonLabel}
        </button>
        {onCancel && (
          <button className="button-secondary" type="button" onClick={onCancel}>
            <X aria-hidden="true" size={17} />
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}

function SubscriptionRow({
  deleteSubscription,
  onStartEdit,
  subscription,
}: {
  deleteSubscription: (id: string) => void;
  onStartEdit: (subscription: Subscription) => void;
  subscription: Subscription;
}) {
  const daysUntil = daysUntilDate(subscription.nextBillingDate);
  const isSoon = daysUntil >= 0 && daysUntil <= 7;

  return (
    <article
      className={clsx(
        "grid gap-4 rounded-panel border border-[color:var(--line)] bg-[color:var(--panel-strong)] p-4 transition md:grid-cols-[1fr_auto_auto]",
        isSoon && "border-[color:var(--accent)] shadow-glow",
      )}
    >
      <div className="flex min-w-0 gap-3">
        <SubscriptionGlyph subscription={subscription} />
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate text-lg font-extrabold">{subscription.name}</h3>
            {isSoon && (
              <span className="rounded-full bg-[color:var(--accent)] px-2 py-1 text-xs font-extrabold text-[#140b08]">
                {daysUntil === 0 ? "Today" : `${daysUntil}d`}
              </span>
            )}
          </div>
          <p className="text-sm text-[color:var(--muted)]">
            {subscription.category} - renews {subscription.nextBillingDate}
          </p>
          {subscription.notes && <p className="mt-2 text-sm text-[color:var(--subtle)]">{subscription.notes}</p>}
        </div>
      </div>
      <div className="grid content-center gap-1 text-left md:text-right">
        <p className="text-2xl font-extrabold">{formatCents(monthlyCostCents(subscription))}/mo</p>
        <p className="text-sm text-[color:var(--muted)]">
          {formatCents(subscription.costCents)} {subscription.billingCycle}
        </p>
      </div>
      <div className="flex items-center gap-2 md:justify-end">
        <button className="icon-button" type="button" aria-label={`Edit ${subscription.name}`} onClick={() => onStartEdit(subscription)}>
          <Pencil aria-hidden="true" size={17} />
        </button>
        <button className="icon-button" type="button" aria-label={`Delete ${subscription.name}`} onClick={() => deleteSubscription(subscription.id)}>
          <Trash2 aria-hidden="true" size={17} />
        </button>
      </div>
    </article>
  );
}

function TrialTracker({
  convertTrial,
  deleteTrial,
  draft,
  onAdd,
  onDraftChange,
  trials,
}: {
  convertTrial: (trial: Trial) => void;
  deleteTrial: (id: string) => void;
  draft: TrialDraft;
  onAdd: () => void;
  onDraftChange: (draft: TrialDraft) => void;
  trials: Trial[];
}) {
  return (
    <div className="grid gap-4">
      <section className="panel p-5">
        <div className="mb-4 flex items-center gap-2">
          <BellRing aria-hidden="true" className="text-[color:var(--accent-2)]" size={20} />
          <h2 className="text-xl font-extrabold">Add free trial</h2>
        </div>
        <form
          className="grid gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            onAdd();
          }}
        >
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <label className="label">
              Service name
              <input
                className="input"
                value={draft.name}
                onChange={(event) => onDraftChange({ ...draft, name: event.target.value })}
                placeholder="Notion AI"
              />
            </label>
            <label className="label">
              Start date
              <input
                className="input"
                type="date"
                value={draft.trialStartDate}
                onChange={(event) => onDraftChange({ ...draft, trialStartDate: event.target.value })}
              />
            </label>
            <label className="label">
              End date
              <input
                className="input"
                type="date"
                value={draft.trialEndDate}
                onChange={(event) => onDraftChange({ ...draft, trialEndDate: event.target.value })}
              />
            </label>
            <label className="label">
              Cost after trial
              <input
                className="input"
                inputMode="decimal"
                value={draft.costAfterTrial}
                onChange={(event) => onDraftChange({ ...draft, costAfterTrial: event.target.value })}
                placeholder="20.00"
              />
            </label>
          </div>
          <label className="flex items-center gap-3 text-sm font-bold text-[color:var(--muted)]">
            <input
              checked={draft.remindMe}
              className="h-4 w-4 accent-[color:var(--accent)]"
              onChange={(event) => onDraftChange({ ...draft, remindMe: event.target.checked })}
              type="checkbox"
            />
            Remind me
          </label>
          <button className="button-primary w-fit" type="submit">
            <Plus aria-hidden="true" size={17} />
            Add trial
          </button>
        </form>
      </section>

      <section className="panel p-5">
        <h2 className="mb-4 text-xl font-extrabold">Trial countdowns</h2>
        {trials.length > 0 ? (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {trials.map((trial) => (
              <TrialCard key={trial.id} convertTrial={convertTrial} deleteTrial={deleteTrial} trial={trial} />
            ))}
          </div>
        ) : (
          <EmptyState Icon={BellRing} title="No free trials tracked" body="Add a trial before it turns into surprise spend." />
        )}
      </section>
    </div>
  );
}

function TrialCard({
  compact = false,
  convertTrial,
  deleteTrial,
  trial,
}: {
  compact?: boolean;
  convertTrial: (trial: Trial) => void;
  deleteTrial: (id: string) => void;
  trial: Trial;
}) {
  const trialStatus = getTrialStatus(trial);
  const urgent = trialStatus.status === "urgent";

  return (
    <article
      className={clsx(
        "rounded-panel border border-[color:var(--line)] bg-[color:var(--panel-strong)] p-4",
        urgent && "pulse-urgent border-[color:var(--danger)]",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-extrabold">{trial.name}</h3>
          <p className="text-sm text-[color:var(--muted)]">
            Ends {trial.trialEndDate} - {formatCents(trial.costAfterTrialCents)}/mo after
          </p>
        </div>
        {trial.remindMe && <BellRing aria-label="Reminder enabled" className="text-[color:var(--accent-2)]" size={18} />}
      </div>
      <div className="mt-5">
        <p className={clsx("stat-number text-6xl", urgent && "text-[color:var(--danger)]")}>
          {trialStatus.hasEnded ? 0 : trialStatus.daysRemaining}
        </p>
        <p className="text-sm font-bold uppercase tracking-[0.16em] text-[color:var(--muted)]">
          {trialStatus.hasEnded ? "ended" : "days left"}
        </p>
      </div>
      {!compact && (
        <div className="mt-5 flex flex-wrap gap-2">
          <button className="button-secondary" type="button" onClick={() => convertTrial(trial)}>
            <Check aria-hidden="true" size={17} />
            Convert
          </button>
          <button className="icon-button" type="button" aria-label={`Delete ${trial.name} trial`} onClick={() => deleteTrial(trial.id)}>
            <Trash2 aria-hidden="true" size={17} />
          </button>
        </div>
      )}
    </article>
  );
}

function Simulator({
  disabledIds,
  impact,
  subscriptions,
  toggleId,
}: {
  disabledIds: Set<string>;
  impact: ReturnType<typeof calculateSimulatorImpact>;
  subscriptions: Subscription[];
  toggleId: (id: string) => void;
}) {
  return (
    <div className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
      <section className="panel p-5">
        <h2 className="text-xl font-extrabold">What if?</h2>
        <div className="mt-5 grid gap-4">
          <CompareNumber label="Current burn" value={impact.currentMonthlyCents} suffix="/mo" />
          <CompareNumber label="After toggles" value={impact.projectedMonthlyCents} suffix="/mo" accent />
          <CompareNumber label="Yearly savings" value={impact.yearlySavingsCents} suffix="/yr" danger />
        </div>
        <p className="mt-5 rounded-panel border border-[color:var(--line)] bg-[color:var(--panel-strong)] p-4 text-sm font-bold text-[color:var(--muted)]">
          Current burn: {formatCents(impact.currentMonthlyCents)}/mo - If you cancel these:{" "}
          {formatCents(impact.projectedMonthlyCents)}/mo - You'd save {formatCents(impact.yearlySavingsCents)}/year
        </p>
      </section>

      <section className="panel p-5">
        <h2 className="mb-4 text-xl font-extrabold">Toggle subscriptions</h2>
        {subscriptions.length > 0 ? (
          <div className="grid gap-3">
            {subscriptions.map((subscription) => {
              const disabled = disabledIds.has(subscription.id);
              return (
                <label
                  key={subscription.id}
                  className={clsx(
                    "flex items-center justify-between gap-3 rounded-panel border border-[color:var(--line)] bg-[color:var(--panel-strong)] p-4 transition",
                    disabled && "border-[color:var(--accent)] opacity-70",
                  )}
                >
                  <span className="flex min-w-0 items-center gap-3">
                    <input
                      checked={!disabled}
                      className="h-5 w-5 accent-[color:var(--accent)]"
                      onChange={() => toggleId(subscription.id)}
                      type="checkbox"
                    />
                    <SubscriptionGlyph subscription={subscription} />
                    <span className="min-w-0">
                      <span className="block truncate font-extrabold">{subscription.name}</span>
                      <span className="block text-sm text-[color:var(--muted)]">{subscription.category}</span>
                    </span>
                  </span>
                  <span className="shrink-0 text-right font-extrabold">
                    {formatCents(monthlyCostCents(subscription))}
                  </span>
                </label>
              );
            })}
          </div>
        ) : (
          <EmptyState Icon={RefreshCcw} title="Simulator is waiting" body="Add subscriptions to model cancellations." />
        )}
      </section>
    </div>
  );
}

function ShareAndData({
  exportCsv,
  importCsv,
  importInputRef,
  isImageBusy,
  metrics,
  onDownloadImage,
  resetAllData,
  shareCardRef,
  subscriptions,
  trials,
}: {
  exportCsv: () => void;
  importCsv: (file: File | null) => void;
  importInputRef: React.RefObject<HTMLInputElement | null>;
  isImageBusy: boolean;
  metrics: ReturnType<typeof calculateBurnMetrics>;
  onDownloadImage: () => void;
  resetAllData: () => void;
  shareCardRef: React.RefObject<HTMLDivElement | null>;
  subscriptions: Subscription[];
  trials: Trial[];
}) {
  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_0.8fr]">
      <section className="panel p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-extrabold">Summary card</h2>
            <p className="text-sm text-[color:var(--muted)]">Built for a clean screenshot or PNG export</p>
          </div>
          <button className="button-primary" disabled={isImageBusy} type="button" onClick={onDownloadImage}>
            <Download aria-hidden="true" size={17} />
            Download PNG
          </button>
        </div>
        <BurnRateSummaryCard metrics={metrics} ref={shareCardRef} subscriptions={subscriptions} />
      </section>

      <section className="panel p-5">
        <h2 className="text-xl font-extrabold">Data management</h2>
        <div className="mt-5 grid gap-3">
          <button className="button-secondary justify-start" type="button" onClick={exportCsv}>
            <ArrowDownToLine aria-hidden="true" size={17} />
            Export CSV
          </button>
          <button className="button-secondary justify-start" type="button" onClick={() => importInputRef.current?.click()}>
            <Upload aria-hidden="true" size={17} />
            Import CSV
          </button>
          <input
            ref={importInputRef}
            accept=".csv,text/csv"
            className="hidden"
            onChange={(event) => void importCsv(event.target.files?.[0] ?? null)}
            type="file"
          />
          <button className="button-secondary justify-start text-[color:var(--danger)]" type="button" onClick={resetAllData}>
            <Trash2 aria-hidden="true" size={17} />
            Reset all data
          </button>
        </div>
        <div className="mt-6 grid grid-cols-3 gap-3">
          <MiniStat label="Subs" value={String(subscriptions.length)} />
          <MiniStat label="Trials" value={String(trials.length)} />
          <MiniStat label="Rows" value={String(subscriptions.length + trials.length)} />
        </div>
      </section>
    </div>
  );
}

const BurnRateSummaryCard = ({
  metrics,
  ref,
  subscriptions,
}: {
  metrics: ReturnType<typeof calculateBurnMetrics>;
  ref: React.Ref<HTMLDivElement>;
  subscriptions: Subscription[];
}) => (
  <div
    ref={ref}
    className="overflow-hidden rounded-panel border border-[color:var(--line)] bg-[#101217] text-[#f6f1e8] shadow-2xl"
  >
    <div className="grid gap-5 p-6 sm:p-8">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="grid h-11 w-11 place-items-center rounded-panel bg-[#ff5a3d] text-[#140b08]">
            <Flame aria-hidden="true" size={25} />
          </div>
          <div>
            <p className="text-xs font-extrabold uppercase tracking-[0.22em] text-[#ffd166]">BurnRate</p>
            <h3 className="font-display text-4xl leading-none">My burn card</h3>
          </div>
        </div>
        <p className="rounded-full border border-white/15 px-3 py-1 text-xs font-extrabold uppercase tracking-[0.16em] text-white/70">
          {subscriptions.length} subs
        </p>
      </div>
      <div>
        <p className="text-xs font-extrabold uppercase tracking-[0.22em] text-[#ff5a3d]">Monthly burn</p>
        <p className="stat-number text-[clamp(4rem,15vw,8rem)]">{formatCents(metrics.monthlyBurnCents, true)}</p>
        <p className="text-sm font-bold text-white/60">{formatCents(metrics.yearlyBurnCents, true)} per year</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        {metrics.categoryBreakdown.slice(0, 3).map((category) => (
          <div key={category.category} className="rounded-panel border border-white/10 bg-white/[0.04] p-3">
            <p className="truncate text-xs font-extrabold uppercase tracking-[0.14em] text-white/50">{category.category}</p>
            <p className="mt-2 text-2xl font-extrabold">{formatCents(category.monthlyCents, true)}</p>
            <p className="text-sm font-bold text-[#ffd166]">{category.percentage}%</p>
          </div>
        ))}
        {metrics.categoryBreakdown.length === 0 && (
          <div className="rounded-panel border border-white/10 bg-white/[0.04] p-3 sm:col-span-3">
            <p className="text-sm font-bold text-white/60">No spending captured yet.</p>
          </div>
        )}
      </div>
    </div>
    <div className="border-t border-white/10 bg-white/[0.035] px-6 py-3 text-right text-xs font-extrabold uppercase tracking-[0.18em] text-white/50 sm:px-8">
      Built with BurnRate
    </div>
  </div>
);

function CategoryLegend({ breakdown }: { breakdown: CategoryBreakdown[] }) {
  return (
    <div className="grid content-center gap-3">
      {breakdown.map((category) => (
        <div key={category.category} className="grid grid-cols-[auto_1fr_auto] items-center gap-3">
          <span
            className="h-3 w-3 rounded-full"
            style={{ background: defaultCategoryColors[category.category] ?? "var(--accent)" }}
          />
          <span className="min-w-0 truncate text-sm font-bold">{category.category}</span>
          <span className="text-sm font-extrabold">{formatCents(category.monthlyCents)}</span>
        </div>
      ))}
    </div>
  );
}

function RenewalList({ renewals, title }: { renewals: Renewal[]; title: string }) {
  return (
    <div>
      <h3 className="mb-3 text-sm font-extrabold uppercase tracking-[0.18em] text-[color:var(--accent-2)]">{title}</h3>
      {renewals.length > 0 ? (
        <div className="grid gap-2">
          {renewals.map((renewal) => (
            <div
              key={`${title}-${renewal.subscription.id}`}
              className="grid grid-cols-[auto_1fr_auto] items-center gap-3 rounded-panel border border-[color:var(--line)] bg-[color:var(--panel-strong)] p-3"
            >
              <CalendarClock aria-hidden="true" className="text-[color:var(--accent)]" size={18} />
              <div className="min-w-0">
                <p className="truncate font-extrabold">{renewal.subscription.name}</p>
                <p className="text-sm text-[color:var(--muted)]">{renewal.subscription.nextBillingDate}</p>
              </div>
              <div className="text-right">
                <p className="font-extrabold">{formatCents(renewal.subscription.costCents)}</p>
                <p className="text-xs font-bold text-[color:var(--muted)]">
                  {renewal.daysUntil === 0 ? "today" : `${renewal.daysUntil}d`}
                </p>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="rounded-panel border border-[color:var(--line)] bg-[color:var(--panel-strong)] p-4 text-sm font-bold text-[color:var(--muted)]">
          No renewals in this window.
        </p>
      )}
    </div>
  );
}

function InsightTile({ insight }: { insight: Insight }) {
  const toneClass = {
    good: "border-[color:var(--accent-3)]",
    neutral: "border-[color:var(--line)]",
    warning: "border-[color:var(--accent-2)]",
    danger: "border-[color:var(--danger)]",
  }[insight.tone];

  return (
    <article className={clsx("rounded-panel border bg-[color:var(--panel-strong)] p-4", toneClass)}>
      <p className="text-base font-extrabold">{insight.title}</p>
      <p className="mt-2 text-sm text-[color:var(--muted)]">{insight.detail}</p>
    </article>
  );
}

function CompareNumber({
  accent = false,
  danger = false,
  label,
  suffix,
  value,
}: {
  accent?: boolean;
  danger?: boolean;
  label: string;
  suffix: string;
  value: number;
}) {
  return (
    <div className="rounded-panel border border-[color:var(--line)] bg-[color:var(--panel-strong)] p-4">
      <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-[color:var(--muted)]">{label}</p>
      <div className="mt-2 flex items-end gap-2">
        <AnimatedMoney
          className={clsx("stat-number text-6xl", accent && "text-[color:var(--accent-3)]", danger && "text-[color:var(--danger)]")}
          value={value}
        />
        <span className="pb-2 text-sm font-extrabold text-[color:var(--muted)]">{suffix}</span>
      </div>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-panel border border-[color:var(--line)] bg-[color:var(--panel-strong)] p-3">
      <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-[color:var(--muted)]">{label}</p>
      <p className="mt-1 text-2xl font-extrabold">{value}</p>
    </div>
  );
}

function EmptyState({
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

function SubscriptionGlyph({ subscription }: { subscription: Subscription }) {
  const Icon = iconMap[subscription.icon ?? "wallet"] ?? WalletCards;
  const color = subscription.color ?? defaultCategoryColors[subscription.category] ?? "var(--accent)";
  return (
    <span
      className="grid h-11 w-11 shrink-0 place-items-center rounded-panel border border-[color:var(--line)]"
      style={{ background: `${color}22`, color }}
    >
      <Icon aria-hidden="true" size={20} />
    </span>
  );
}

function AnimatedMoney({ className, value }: { className?: string; value: number }) {
  const animated = useAnimatedNumber(value);
  return <p className={className}>{formatCents(animated, true)}</p>;
}

function useAnimatedNumber(target: number, duration = 520) {
  const [display, setDisplay] = useState(target);
  const previous = useRef(target);

  useEffect(() => {
    const start = previous.current;
    const difference = target - start;
    if (difference === 0) {
      return;
    }

    let animationFrame = 0;
    const startedAt = performance.now();

    const tick = (now: number) => {
      const progress = Math.min(1, (now - startedAt) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.round(start + difference * eased));
      if (progress < 1) {
        animationFrame = requestAnimationFrame(tick);
      } else {
        previous.current = target;
      }
    };

    animationFrame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animationFrame);
  }, [duration, target]);

  return display;
}

function daysUntilDate(date: string): number {
  const today = new Date();
  const targetParts = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!targetParts) {
    return 0;
  }
  const target = new Date(Number(targetParts[1]), Number(targetParts[2]) - 1, Number(targetParts[3]));
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  return Math.round((target.getTime() - start.getTime()) / (24 * 60 * 60 * 1000));
}
