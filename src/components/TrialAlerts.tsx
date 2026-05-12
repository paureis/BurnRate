"use client";

import { Bell, BellOff, BellRing, Check, X } from "lucide-react";
import { clsx } from "clsx";
import { formatCents, type TrialAlert, type Trial } from "@/lib/burnrate";

export type NotificationPermissionState = "default" | "granted" | "denied" | "unsupported";

function alertHeadline(daysRemaining: number, trialName: string): string {
  if (daysRemaining === 0) {
    return `${trialName} trial ends today`;
  }
  if (daysRemaining === 1) {
    return `${trialName} trial ends tomorrow`;
  }
  return `${trialName} trial ends in ${daysRemaining} days`;
}

export function TrialAlerts({
  alerts,
  onConvert,
  onDismiss,
  onRequestPermission,
  permission,
}: {
  alerts: TrialAlert[];
  onConvert: (trial: Trial) => void;
  onDismiss: (key: string) => void;
  onRequestPermission: () => void;
  permission: NotificationPermissionState;
}) {
  if (alerts.length === 0) {
    return null;
  }

  return (
    <div className="grid gap-2" aria-label="Trial reminders" role="region">
      {permission === "default" && (
        <button
          type="button"
          onClick={onRequestPermission}
          className="flex items-center gap-2 self-start rounded-panel border border-[color:var(--accent-2)] bg-[color:var(--panel-strong)] px-3 py-2 text-xs font-bold uppercase tracking-[0.18em] text-[color:var(--accent-2)] transition hover:bg-[color:var(--panel-soft)]"
        >
          <Bell aria-hidden="true" size={14} />
          Enable browser notifications
        </button>
      )}
      {permission === "denied" && (
        <p className="flex items-center gap-2 self-start rounded-panel border border-[color:var(--line)] bg-[color:var(--panel-strong)] px-3 py-2 text-xs font-bold uppercase tracking-[0.18em] text-[color:var(--muted)]">
          <BellOff aria-hidden="true" size={14} />
          Browser notifications blocked — alerts will still show here
        </p>
      )}
      {alerts.map((alert) => {
        const urgent = alert.threshold <= 3;
        return (
          <article
            key={alert.key}
            role="alert"
            className={clsx(
              "flex flex-wrap items-center gap-3 rounded-panel border bg-[color:var(--panel-strong)] p-4",
              urgent ? "border-[color:var(--danger)] pulse-urgent" : "border-[color:var(--accent-2)]",
            )}
          >
            <BellRing
              aria-hidden="true"
              size={20}
              className={urgent ? "text-[color:var(--danger)]" : "text-[color:var(--accent-2)]"}
            />
            <div className="min-w-0 flex-1">
              <p className="font-extrabold leading-tight">{alertHeadline(alert.daysRemaining, alert.trial.name)}</p>
              <p className="text-sm text-[color:var(--muted)]">
                Becomes {formatCents(alert.trial.costAfterTrialCents)}/mo on {alert.trial.trialEndDate}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button className="button-secondary" type="button" onClick={() => onConvert(alert.trial)}>
                <Check aria-hidden="true" size={16} />
                Convert
              </button>
              <button
                className="icon-button"
                type="button"
                aria-label={`Dismiss alert for ${alert.trial.name}`}
                onClick={() => onDismiss(alert.key)}
              >
                <X aria-hidden="true" size={16} />
              </button>
            </div>
          </article>
        );
      })}
    </div>
  );
}
