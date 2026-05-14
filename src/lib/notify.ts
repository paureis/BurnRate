// v6 Feature 6: deterministic notification scheduling.
//
// Pure: enumerate all renewal / trial / discount / goal / price-change /
// pending-cancel events that should fire within the next horizon (default
// 30 days) given the current state. The service worker reads this list
// from IDB and fires `showNotification` when their `fireAt` arrives.

import type { Subscription, Trial } from "./burnrate";

export type NotifyChannel =
  | "renewal"
  | "trial-end"
  | "price-change"
  | "goal"
  | "discount-expiry"
  | "pending-cancel";

export interface NotifySettings {
  enabled: boolean;
  channels: Record<NotifyChannel, boolean>;
  quietHoursStart?: string;                // "HH:MM"
  quietHoursEnd?: string;                  // "HH:MM"
  leadTimeDays: {
    renewal: number;
    "trial-end": number;
    "discount-expiry": number;
  };
}

export const defaultNotifySettings: NotifySettings = {
  enabled: false,
  channels: {
    renewal: true,
    "trial-end": true,
    "price-change": true,
    goal: true,
    "discount-expiry": true,
    "pending-cancel": true,
  },
  leadTimeDays: { renewal: 2, "trial-end": 3, "discount-expiry": 7 },
};

export interface ScheduledNotification {
  id: string;
  channel: NotifyChannel;
  fireAt: string;          // ISO timestamp
  title: string;
  body: string;
  recordRef?: { kind: "subscription" | "trial" | "goal" | "discount"; id: string };
}

export interface ScheduleInput {
  subscriptions: Subscription[];
  trials: Trial[];
  horizonDays?: number;
  now?: Date;
}

const dayMs = 24 * 60 * 60 * 1000;

/**
 * Build the deterministic list of notifications for the next `horizonDays`.
 * Pure; no IDB / SW interaction.
 */
export function scheduleAll(state: ScheduleInput, settings: NotifySettings): ScheduledNotification[] {
  if (!settings.enabled) return [];
  const now = state.now ?? new Date();
  const horizon = state.horizonDays ?? 30;
  const cutoff = now.getTime() + horizon * dayMs;
  const out: ScheduledNotification[] = [];

  if (settings.channels.renewal) {
    for (const sub of state.subscriptions) {
      if (sub.cancellingOn) continue;
      const renewalDate = parseIso(sub.nextBillingDate);
      if (!renewalDate) continue;
      const fireAt = subtractDays(renewalDate, settings.leadTimeDays.renewal);
      if (fireAt.getTime() < now.getTime() || fireAt.getTime() > cutoff) continue;
      out.push({
        id: `renewal:${sub.id}:${sub.nextBillingDate}`,
        channel: "renewal",
        fireAt: applyQuietHours(fireAt, settings).toISOString(),
        title: `${sub.name} renews in ${settings.leadTimeDays.renewal} day${settings.leadTimeDays.renewal === 1 ? "" : "s"}`,
        body: `Heads up — your ${sub.name} renewal is coming up.`,
        recordRef: { kind: "subscription", id: sub.id },
      });
    }
  }

  if (settings.channels["trial-end"]) {
    for (const trial of state.trials) {
      const endDate = parseIso(trial.trialEndDate);
      if (!endDate) continue;
      const fireAt = subtractDays(endDate, settings.leadTimeDays["trial-end"]);
      if (fireAt.getTime() < now.getTime() || fireAt.getTime() > cutoff) continue;
      out.push({
        id: `trial-end:${trial.id}`,
        channel: "trial-end",
        fireAt: applyQuietHours(fireAt, settings).toISOString(),
        title: `${trial.name} trial ends soon`,
        body: `Decide before it auto-converts on ${trial.trialEndDate}.`,
        recordRef: { kind: "trial", id: trial.id },
      });
    }
  }

  if (settings.channels["price-change"]) {
    for (const sub of state.subscriptions) {
      if (!sub.priceChanges) continue;
      for (const change of sub.priceChanges) {
        const date = parseIso(change.effectiveDate);
        if (!date) continue;
        const fireAt = subtractDays(date, 1);
        if (fireAt.getTime() < now.getTime() || fireAt.getTime() > cutoff) continue;
        out.push({
          id: `price:${sub.id}:${change.effectiveDate}`,
          channel: "price-change",
          fireAt: applyQuietHours(fireAt, settings).toISOString(),
          title: `${sub.name} price change tomorrow`,
          body: `New cost: $${(change.newCostCents / 100).toFixed(2)}.`,
          recordRef: { kind: "subscription", id: sub.id },
        });
      }
    }
  }

  if (settings.channels["discount-expiry"]) {
    for (const sub of state.subscriptions) {
      if (!sub.activeDiscount?.expiresOn) continue;
      const date = parseIso(sub.activeDiscount.expiresOn);
      if (!date) continue;
      const fireAt = subtractDays(date, settings.leadTimeDays["discount-expiry"]);
      if (fireAt.getTime() < now.getTime() || fireAt.getTime() > cutoff) continue;
      out.push({
        id: `discount:${sub.id}:${sub.activeDiscount.id}`,
        channel: "discount-expiry",
        fireAt: applyQuietHours(fireAt, settings).toISOString(),
        title: `${sub.name} discount expiring`,
        body: `Your retention price ends ${sub.activeDiscount.expiresOn}.`,
        recordRef: { kind: "subscription", id: sub.id },
      });
    }
  }

  if (settings.channels["pending-cancel"]) {
    for (const sub of state.subscriptions) {
      if (!sub.cancellingOn) continue;
      const date = parseIso(sub.cancellingOn);
      if (!date) continue;
      const fireAt = subtractDays(date, 1);
      if (fireAt.getTime() < now.getTime() || fireAt.getTime() > cutoff) continue;
      out.push({
        id: `pending-cancel:${sub.id}:${sub.cancellingOn}`,
        channel: "pending-cancel",
        fireAt: applyQuietHours(fireAt, settings).toISOString(),
        title: `${sub.name} cancels tomorrow`,
        body: `BurnRate will auto-cancel it as planned.`,
        recordRef: { kind: "subscription", id: sub.id },
      });
    }
  }

  return out.sort((a, b) => a.fireAt.localeCompare(b.fireAt));
}

/**
 * Remove entries from `stored` whose ids appear in `firedIds`. Survivors keep
 * their order.
 */
export function pruneFiredScheduled(
  stored: ScheduledNotification[],
  firedIds: string[],
): ScheduledNotification[] {
  if (firedIds.length === 0) return stored;
  const set = new Set(firedIds);
  return stored.filter((entry) => !set.has(entry.id));
}

/**
 * Best-effort permission check. Caller must invoke this from a user gesture.
 */
export async function ensurePermission(): Promise<NotificationPermission> {
  if (typeof Notification === "undefined") return "denied";
  if (Notification.permission === "granted" || Notification.permission === "denied") {
    return Notification.permission;
  }
  return Notification.requestPermission();
}

function parseIso(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!match) return null;
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 9, 0, 0);
}

function subtractDays(date: Date, days: number): Date {
  return new Date(date.getTime() - days * dayMs);
}

/**
 * Slide events that fall inside the quiet-hours window forward to the next
 * eligible hour. No-op when no quiet hours are configured.
 */
function applyQuietHours(fireAt: Date, settings: NotifySettings): Date {
  if (!settings.quietHoursStart || !settings.quietHoursEnd) return fireAt;
  const start = parseHHMM(settings.quietHoursStart);
  const end = parseHHMM(settings.quietHoursEnd);
  if (!start || !end) return fireAt;
  const hours = fireAt.getHours() * 60 + fireAt.getMinutes();
  const startMin = start.hour * 60 + start.minute;
  const endMin = end.hour * 60 + end.minute;
  const inWindow =
    startMin <= endMin ? hours >= startMin && hours < endMin : hours >= startMin || hours < endMin;
  if (!inWindow) return fireAt;
  // Slide to endMin (in the same calendar day if wraps were respected).
  const slid = new Date(fireAt);
  slid.setHours(end.hour, end.minute, 0, 0);
  if (slid.getTime() <= fireAt.getTime()) {
    // Quiet hours wrapped past midnight — push to next day's `end` hour.
    slid.setDate(slid.getDate() + 1);
  }
  return slid;
}

function parseHHMM(value: string): { hour: number; minute: number } | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value);
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;
  return { hour, minute };
}
