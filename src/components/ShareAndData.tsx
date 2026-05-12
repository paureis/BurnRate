"use client";

import { ArrowDownToLine, CalendarDays, Download, FileDown, Flame, Link2, Trash2, Upload } from "lucide-react";
import { calculateBurnMetrics, formatCents, type Subscription, type Trial } from "@/lib/burnrate";

export function ShareAndData({
  exportBurnFile,
  exportCsv,
  exportIcs,
  generateShareLink,
  generateSyncLink,
  importBurnFile,
  importBurnInputRef,
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
  exportBurnFile: () => void;
  exportCsv: () => void;
  exportIcs: () => void;
  generateShareLink: () => void;
  generateSyncLink: () => void;
  importBurnFile: (file: File | null) => void;
  importBurnInputRef: React.RefObject<HTMLInputElement | null>;
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
        <h2 className="text-xl font-extrabold">Settings &amp; Data</h2>

        <h3 className="mt-5 text-sm font-extrabold uppercase tracking-[0.18em] text-[color:var(--accent-2)]">Backup</h3>
        <div className="mt-2 grid gap-3">
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
          <div>
            <button className="button-secondary w-full justify-start" type="button" onClick={exportIcs}>
              <CalendarDays aria-hidden="true" size={17} />
              Download .ics calendar
            </button>
            <p className="mt-2 text-xs font-bold text-[color:var(--muted)]">
              Imports renewals and trial-end dates into Google Calendar, Apple Calendar, or Outlook.
            </p>
          </div>
          <button className="button-secondary justify-start" type="button" onClick={exportBurnFile}>
            <FileDown aria-hidden="true" size={17} />
            Save .burn file
          </button>
          <button className="button-secondary justify-start" type="button" onClick={() => importBurnInputRef.current?.click()}>
            <Upload aria-hidden="true" size={17} />
            Load .burn file
          </button>
          <input
            ref={importBurnInputRef}
            accept=".burn,text/plain"
            className="hidden"
            onChange={(event) => void importBurnFile(event.target.files?.[0] ?? null)}
            type="file"
          />
        </div>

        <h3 className="mt-6 text-sm font-extrabold uppercase tracking-[0.18em] text-[color:var(--accent-2)]">Sync</h3>
        <div className="mt-2 grid gap-3">
          <p className="rounded-panel border border-[color:var(--accent-2)] bg-[color:var(--panel-strong)] p-3 text-xs font-bold text-[color:var(--accent-2)]">
            Anyone with this link can see your data. Don&apos;t share publicly.
          </p>
          <button className="button-secondary justify-start" type="button" onClick={generateSyncLink}>
            <Link2 aria-hidden="true" size={17} />
            Generate sync link
          </button>
        </div>

        <h3 className="mt-6 text-sm font-extrabold uppercase tracking-[0.18em] text-[color:var(--accent-2)]">Share</h3>
        <div className="mt-2 grid gap-3">
          <p className="rounded-panel border border-[color:var(--line)] bg-[color:var(--panel-strong)] p-3 text-xs font-bold text-[color:var(--muted)]">
            Public link shows your totals and top categories. Notes are removed.
          </p>
          <button className="button-secondary justify-start" type="button" onClick={generateShareLink}>
            <Link2 aria-hidden="true" size={17} />
            Create public share link
          </button>
        </div>

        <h3 className="mt-6 text-sm font-extrabold uppercase tracking-[0.18em] text-[color:var(--danger)]">Danger zone</h3>
        <div className="mt-2 grid gap-3">
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

export const BurnRateSummaryCard = ({
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

export function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-panel border border-[color:var(--line)] bg-[color:var(--panel-strong)] p-3">
      <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-[color:var(--muted)]">{label}</p>
      <p className="mt-1 text-2xl font-extrabold">{value}</p>
    </div>
  );
}
