"use client";

import { useState } from "react";
import { BellRing, BellOff } from "lucide-react";
import {
  defaultNotifySettings,
  ensurePermission,
  type NotifyChannel,
  type NotifySettings,
} from "@/lib/notify";

interface NotificationSettingsProps {
  settings: NotifySettings;
  onChange: (next: NotifySettings) => void;
  onTest?: () => void;
  supportsPeriodicSync?: boolean;
}

const CHANNELS: Array<{ id: NotifyChannel; label: string; description: string }> = [
  { id: "renewal", label: "Renewals", description: "Lead time before each subscription renews." },
  { id: "trial-end", label: "Trial ends", description: "Lead time before a free trial converts." },
  { id: "price-change", label: "Price changes", description: "Day-before alerts for scheduled hikes." },
  { id: "discount-expiry", label: "Discount expiry", description: "Heads-up before a retention deal lapses." },
  { id: "pending-cancel", label: "Pending cancellations", description: "Day-before reminders for auto-cancel." },
  { id: "goal", label: "Goal events", description: "When a goal is achieved or fails." },
];

export function NotificationSettings({
  settings,
  onChange,
  onTest,
  supportsPeriodicSync = false,
}: NotificationSettingsProps) {
  const [permission, setPermission] = useState<NotificationPermission>(
    typeof Notification !== "undefined" ? Notification.permission : "default",
  );

  async function enable() {
    const result = await ensurePermission();
    setPermission(result);
    onChange({ ...settings, enabled: result === "granted" });
  }

  function setChannel(channel: NotifyChannel, value: boolean) {
    onChange({ ...settings, channels: { ...settings.channels, [channel]: value } });
  }

  function setLead(channel: keyof NotifySettings["leadTimeDays"], value: number) {
    onChange({ ...settings, leadTimeDays: { ...settings.leadTimeDays, [channel]: value } });
  }

  function setQuiet(field: "quietHoursStart" | "quietHoursEnd", value: string) {
    onChange({ ...settings, [field]: value || undefined });
  }

  const mode = supportsPeriodicSync ? "Real periodic sync" : "Open-app only";

  return (
    <section className="panel p-5">
      <div className="mb-3 flex items-center gap-2">
        {settings.enabled ? (
          <BellRing aria-hidden="true" className="text-[color:var(--accent)]" size={20} />
        ) : (
          <BellOff aria-hidden="true" className="text-[color:var(--muted)]" size={20} />
        )}
        <h2 className="text-xl font-extrabold">Notifications</h2>
      </div>

      <p className="mb-3 text-xs text-[color:var(--muted)]">
        Browser notifications for renewals, trials, and discounts. No server push — everything is scheduled in the
        service worker.
      </p>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <button
          type="button"
          className={settings.enabled ? "button-secondary" : "button-primary"}
          onClick={() => void (settings.enabled ? onChange({ ...settings, enabled: false }) : enable())}
        >
          {settings.enabled ? "Disable" : "Enable notifications"}
        </button>
        {onTest && (
          <button type="button" className="button-ghost" onClick={onTest} disabled={!settings.enabled}>
            Test notification
          </button>
        )}
        <span className="text-xs font-bold text-[color:var(--muted)]">
          Permission: {permission} · Delivery: {mode}
        </span>
      </div>

      {settings.enabled && (
        <>
          <fieldset className="mb-4 grid gap-2">
            <legend className="mb-1 text-sm font-extrabold uppercase tracking-wider text-[color:var(--accent-2)]">
              Channels
            </legend>
            {CHANNELS.map((channel) => (
              <label key={channel.id} className="flex items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={settings.channels[channel.id]}
                  onChange={(event) => setChannel(channel.id, event.target.checked)}
                  className="mt-1"
                />
                <span>
                  <span className="font-extrabold">{channel.label}</span>
                  <span className="block text-xs text-[color:var(--muted)]">{channel.description}</span>
                </span>
              </label>
            ))}
          </fieldset>

          <fieldset className="mb-4 grid gap-3 sm:grid-cols-3">
            <legend className="sr-only">Lead times</legend>
            <label className="label text-xs">
              Renewal lead (days)
              <input
                type="number"
                min={1}
                max={7}
                className="input"
                value={settings.leadTimeDays.renewal}
                onChange={(event) => setLead("renewal", Math.max(1, Math.min(7, Number(event.target.value) || 1)))}
              />
            </label>
            <label className="label text-xs">
              Trial-end lead
              <input
                type="number"
                min={1}
                max={14}
                className="input"
                value={settings.leadTimeDays["trial-end"]}
                onChange={(event) => setLead("trial-end", Math.max(1, Math.min(14, Number(event.target.value) || 1)))}
              />
            </label>
            <label className="label text-xs">
              Discount-expiry lead
              <input
                type="number"
                min={1}
                max={30}
                className="input"
                value={settings.leadTimeDays["discount-expiry"]}
                onChange={(event) =>
                  setLead("discount-expiry", Math.max(1, Math.min(30, Number(event.target.value) || 1)))
                }
              />
            </label>
          </fieldset>

          <fieldset className="grid gap-3 sm:grid-cols-2">
            <legend className="sr-only">Quiet hours</legend>
            <label className="label text-xs">
              Quiet hours start
              <input
                type="time"
                className="input"
                value={settings.quietHoursStart ?? ""}
                onChange={(event) => setQuiet("quietHoursStart", event.target.value)}
              />
            </label>
            <label className="label text-xs">
              Quiet hours end
              <input
                type="time"
                className="input"
                value={settings.quietHoursEnd ?? ""}
                onChange={(event) => setQuiet("quietHoursEnd", event.target.value)}
              />
            </label>
          </fieldset>
        </>
      )}
    </section>
  );
}

export { defaultNotifySettings };
