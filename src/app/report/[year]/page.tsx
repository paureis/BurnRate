"use client";

import { use, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Download } from "lucide-react";
import { storageKeys } from "@/components/shared";
import { migrateSubscriptions, migrateTrials } from "@/lib/migrate";
import { normalizePreferences } from "@/lib/preferences";
import { normalizeLedger, type CancellationRecord } from "@/lib/ledger";
import { loadSnapshots } from "@/lib/snapshots";
import { buildFxContext } from "@/lib/currency";
import { buildAnnualReport, isReportReady, type AnnualReport } from "@/lib/annual-report";
import { formatMoney } from "@/lib/currency";
import type { MonthlySnapshot } from "@/lib/snapshots";
import type { Subscription, Trial } from "@/lib/burnrate";

interface ReportPageProps {
  params: Promise<{ year: string }>;
}

export default function ReportPage({ params }: ReportPageProps) {
  const { year } = use(params);
  const router = useRouter();
  const yearNumber = Number(year);
  const [report, setReport] = useState<AnnualReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!Number.isFinite(yearNumber)) {
      setError("Invalid year.");
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const subs = readJson<Subscription[]>(storageKeys.subscriptions) ?? [];
        const trials = readJson<Trial[]>(storageKeys.trials) ?? [];
        const ledger = readJson<CancellationRecord[]>(storageKeys.ledger) ?? [];
        const prefs = normalizePreferences(readJson(storageKeys.preferences));
        let snapshots: MonthlySnapshot[] = [];
        try {
          snapshots = await loadSnapshots();
        } catch {
          snapshots = [];
        }
        if (cancelled) return;
        const fx = buildFxContext(prefs.baseCurrency, prefs.fxOverrides);
        const built = buildAnnualReport({
          year: yearNumber,
          baseCurrency: prefs.baseCurrency,
          subscriptions: migrateSubscriptions(subs),
          snapshots,
          ledger: normalizeLedger(ledger),
          fx,
          now: new Date(),
        });
        setReport(built);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not build report.");
      } finally {
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [yearNumber]);

  const ready = useMemo(() => {
    if (!report) return false;
    return report.snapshotsCount >= 6;
  }, [report]);

  if (loading) {
    return (
      <div className="grid min-h-screen place-items-center bg-[color:var(--bg)] text-[color:var(--text)]">
        <p className="text-sm font-bold text-[color:var(--muted)]">Building your {yearNumber} report…</p>
      </div>
    );
  }

  if (error || !report) {
    return (
      <div className="grid min-h-screen place-items-center bg-[color:var(--bg)] p-6 text-center text-[color:var(--text)]">
        <div>
          <p className="text-2xl font-extrabold">{error ?? "No report available."}</p>
          <button className="button-secondary mt-4" type="button" onClick={() => router.push("/")}>
            Back to BurnRate
          </button>
        </div>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-[color:var(--bg)] text-[color:var(--text)]">
      <header className="mx-auto max-w-3xl px-4 pt-12 pb-6 text-center">
        <p className="text-xs font-extrabold uppercase tracking-[0.28em] text-[color:var(--accent)]">
          BurnRate {report.year} recap
        </p>
        <h1 className="mt-2 font-display text-6xl leading-none">
          {formatMoney(report.totalSpendCents, report.baseCurrency)}
        </h1>
        <p className="mt-2 text-sm text-[color:var(--muted)]">
          {report.snapshotsCount} months tracked · avg{" "}
          {formatMoney(report.avgMonthlyBurnCents, report.baseCurrency)} / mo
        </p>
        {!ready && (
          <p className="mt-2 text-xs text-[color:var(--accent-2)]">
            Showing partial data — fewer than 6 in-year snapshots.
          </p>
        )}
      </header>

      <Section title="Top 5">
        {report.topSubscriptions.length === 0 ? (
          <Empty>No active subscriptions this year.</Empty>
        ) : (
          <ul className="grid gap-2">
            {report.topSubscriptions.map((row, index) => (
              <li
                key={row.name}
                className="flex items-center justify-between rounded-panel border border-[color:var(--line)] bg-[color:var(--panel-strong)] px-4 py-3"
              >
                <p>
                  <span className="font-extrabold">{index + 1}. {row.name}</span>{" "}
                  <span className="text-xs text-[color:var(--muted)]">{row.category}</span>
                </p>
                <p className="text-sm font-bold">{formatMoney(row.cents, report.baseCurrency)}/yr</p>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="Biggest month">
        <p className="text-2xl font-extrabold">
          {report.biggestMonth.month || "—"}{" "}
          <span className="text-base font-bold text-[color:var(--muted)]">
            ({formatMoney(report.biggestMonth.cents, report.baseCurrency)})
          </span>
        </p>
        <p className="mt-2 text-sm text-[color:var(--muted)]">
          Quietest: {report.quietestMonth.month || "—"} at{" "}
          {formatMoney(report.quietestMonth.cents, report.baseCurrency)}.
        </p>
      </Section>

      <Section title="Cancellation wins">
        <p className="text-2xl font-extrabold">
          {report.cancellationsCount} cancellation{report.cancellationsCount === 1 ? "" : "s"}
        </p>
        <p className="mt-2 text-sm">
          Saved {formatMoney(report.cancellationsSavedAnnualCents, report.baseCurrency)} per year.
        </p>
        {report.biggestWin && (
          <p className="mt-1 text-sm text-[color:var(--accent-2)]">
            Biggest win: {report.biggestWin.name} —{" "}
            {formatMoney(report.biggestWin.annualSavedCents, report.baseCurrency)}/yr saved.
          </p>
        )}
      </Section>

      <Section title="Heroes & zombies">
        <div className="grid gap-3 md:grid-cols-2">
          <div className="rounded-panel border border-[color:var(--line)] bg-[color:var(--panel-strong)] p-3">
            <p className="text-sm font-extrabold text-[color:var(--accent)]">Heroes</p>
            {report.roiHeroes.length === 0 ? <Empty>—</Empty> : <List items={report.roiHeroes} />}
          </div>
          <div className="rounded-panel border border-[color:var(--line)] bg-[color:var(--panel-strong)] p-3">
            <p className="text-sm font-extrabold text-[color:var(--accent-2)]">Zombies</p>
            {report.roiZombies.length === 0 ? <Empty>—</Empty> : <List items={report.roiZombies} />}
          </div>
        </div>
      </Section>

      <Section title="Category breakdown">
        {report.categoryBreakdown.length === 0 ? (
          <Empty>No data yet.</Empty>
        ) : (
          <ul className="grid gap-2">
            {report.categoryBreakdown.slice(0, 6).map((row) => (
              <li key={row.category} className="grid grid-cols-[120px_1fr_auto] items-center gap-3">
                <span className="text-sm font-bold">{row.category}</span>
                <span className="block h-2 rounded bg-[color:var(--panel-strong)]">
                  <span
                    className="block h-2 rounded bg-[color:var(--accent)]"
                    style={{ width: `${Math.max(0, Math.min(100, row.pct))}%` }}
                  />
                </span>
                <span className="text-xs font-bold text-[color:var(--muted)]">
                  {row.pct}% · {formatMoney(row.cents, report.baseCurrency)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="Streaks">
        <p className="text-sm">
          Longest no-new-subs streak this year:{" "}
          <span className="font-extrabold">{report.streaks.longestNoNewSubsDays}</span> days.
        </p>
        <p className="text-sm text-[color:var(--muted)]">
          {report.newSubsAdded} new subscriptions added in {report.year}.
        </p>
      </Section>

      <footer className="mx-auto max-w-3xl px-4 py-12 text-center">
        <p className="text-xs font-extrabold uppercase tracking-[0.28em] text-[color:var(--accent-2)]">
          Built with BurnRate
        </p>
        <button
          type="button"
          className="button-primary mt-4"
          onClick={() => void downloadAsPng()}
        >
          <Download aria-hidden="true" size={16} />
          Download as PNG
        </button>
        <p className="mt-4">
          <a className="text-sm text-[color:var(--accent-2)]" href="/">
            ← Back to BurnRate
          </a>
        </p>
      </footer>
    </main>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mx-auto max-w-3xl px-4 py-8">
      <h2 className="mb-3 text-xs font-extrabold uppercase tracking-[0.22em] text-[color:var(--accent-2)]">
        {title}
      </h2>
      {children}
    </section>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-[color:var(--muted)]">{children}</p>;
}

function List({ items }: { items: string[] }) {
  return (
    <ul className="mt-1 grid gap-1 text-sm">
      {items.filter(Boolean).map((name) => (
        <li key={name} className="font-bold">{name}</li>
      ))}
    </ul>
  );
}

function readJson<T>(key: string): T | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

async function downloadAsPng(): Promise<void> {
  try {
    const { default: html2canvas } = await import("html2canvas");
    const canvas = await html2canvas(document.body, { backgroundColor: null, scale: 2 });
    canvas.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `burnrate-report-${new Date().toISOString().slice(0, 10)}.png`;
      link.click();
      URL.revokeObjectURL(url);
    }, "image/png");
  } catch {
    /* ignore */
  }
}

// Suppress unused-import warning when isReportReady not used directly here.
void isReportReady;
