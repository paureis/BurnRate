"use client";

import { useMemo, useState } from "react";
import { CalendarDays } from "lucide-react";
import { buildChargeCalendar, summarizeChargeCalendar, type ChargeDay } from "@/lib/charge-calendar";
import { formatMoney, type FxContext } from "@/lib/currency";
import type { Subscription } from "@/lib/burnrate";

interface ChargeCalendarPanelProps {
  subscriptions: Subscription[];
  fx: FxContext;
  now?: Date;
}

const DAY_OF_WEEK = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function ChargeCalendarPanel({ subscriptions, fx, now = new Date() }: ChargeCalendarPanelProps) {
  const [range, setRange] = useState<"90" | "365">("90");

  const horizonDays = range === "90" ? 90 : 365;
  const days = useMemo(
    () => buildChargeCalendar(subscriptions, horizonDays, fx, now),
    [subscriptions, horizonDays, fx, now],
  );
  const summary = useMemo(() => summarizeChargeCalendar(days), [days]);

  if (subscriptions.length === 0) return null;

  const maxTotal = days.reduce((max, day) => Math.max(max, day.totalCents), 0);
  const dayIndex = new Map(days.map((day) => [day.date, day] as const));
  const today = startOfDay(now);
  const startDate = new Date(today.getTime() - horizonDays * dayMs);

  const weeks: Array<Array<{ date: string; day: ChargeDay | undefined }>> = [];
  let cursor = new Date(startDate);
  // Align cursor to the start of the week (Sunday).
  cursor.setDate(cursor.getDate() - cursor.getDay());
  while (cursor.getTime() <= today.getTime()) {
    const week: Array<{ date: string; day: ChargeDay | undefined }> = [];
    for (let d = 0; d < 7; d += 1) {
      const iso = isoDay(cursor);
      week.push({ date: iso, day: dayIndex.get(iso) });
      cursor.setDate(cursor.getDate() + 1);
    }
    weeks.push(week);
  }

  return (
    <section className="panel p-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <CalendarDays aria-hidden="true" className="text-[color:var(--accent-2)]" size={20} />
          <h2 className="text-xl font-extrabold">Charge calendar</h2>
        </div>
        <div className="flex gap-1 text-xs">
          {(["90", "365"] as const).map((value) => (
            <button
              key={value}
              type="button"
              className={
                "rounded-full px-3 py-1 font-extrabold " +
                (range === value
                  ? "bg-[color:var(--accent)] text-[#140b08]"
                  : "border border-[color:var(--line)] text-[color:var(--muted)]")
              }
              onClick={() => setRange(value)}
            >
              {value === "90" ? "Last 90 days" : "Last 12 months"}
            </button>
          ))}
        </div>
      </div>

      <div className="overflow-x-auto">
        <div className="flex gap-[2px]" style={{ minWidth: `${weeks.length * 14}px` }}>
          {weeks.map((week, w) => (
            <div key={w} className="flex flex-col gap-[2px]">
              {week.map(({ date, day }) => {
                const intensity = day && maxTotal > 0 ? Math.min(4, Math.ceil((day.totalCents / maxTotal) * 4)) : 0;
                return (
                  <span
                    key={date}
                    title={day ? `${date}: ${formatMoney(day.totalCents, fx.baseCurrency)} across ${day.chargeCount} charge${day.chargeCount === 1 ? "" : "s"}` : date}
                    className="block h-3 w-3 rounded-sm"
                    style={{
                      background:
                        intensity === 0
                          ? "var(--panel-strong)"
                          : `color-mix(in srgb, var(--accent) ${intensity * 22}%, var(--panel-strong))`,
                    }}
                    aria-label={day ? `${date} ${formatMoney(day.totalCents, fx.baseCurrency)}` : `${date} no charges`}
                  />
                );
              })}
            </div>
          ))}
        </div>
      </div>

      <dl className="mt-4 grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-4">
        <Cell label="Active days">{summary.activeDayCount}</Cell>
        <Cell label="Total">{formatMoney(summary.totalCents, fx.baseCurrency)}</Cell>
        <Cell label="Avg / active day">{formatMoney(summary.avgCentsPerActiveDay, fx.baseCurrency)}</Cell>
        <Cell label="Peak day">
          {summary.peakDay ? `${summary.peakDay.date} (${formatMoney(summary.peakDay.totalCents, fx.baseCurrency)})` : "—"}
        </Cell>
      </dl>

      {(summary.dominantDayOfMonth || summary.dominantDayOfWeek !== null) && (
        <p className="mt-3 text-xs text-[color:var(--muted)]">
          {summary.dominantDayOfMonth && (
            <>
              You bill heaviest on day {summary.dominantDayOfMonth} of the month.
            </>
          )}{" "}
          {summary.dominantDayOfWeek !== null && (
            <>
              Most charges land on {DAY_OF_WEEK[summary.dominantDayOfWeek]}s.
            </>
          )}
        </p>
      )}
    </section>
  );
}

function Cell({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-panel border border-[color:var(--line)] bg-[color:var(--panel-strong)] px-3 py-2">
      <p className="text-xs uppercase tracking-wider text-[color:var(--muted)]">{label}</p>
      <p className="text-base font-extrabold">{children}</p>
    </div>
  );
}

const dayMs = 24 * 60 * 60 * 1000;
function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}
function isoDay(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
