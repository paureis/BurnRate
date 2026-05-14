"use client";

import { useMemo } from "react";
import { Users } from "lucide-react";
import { splitMonthlyBurn, type Profile } from "@/lib/profiles";
import { formatMoney, type FxContext } from "@/lib/currency";
import type { Subscription } from "@/lib/burnrate";

interface PerProfileBurnProps {
  profiles: Profile[];
  subscriptions: Subscription[];
  fx: FxContext;
}

export function PerProfileBurn({ profiles, subscriptions, fx }: PerProfileBurnProps) {
  const split = useMemo(() => splitMonthlyBurn(subscriptions, profiles, fx), [subscriptions, profiles, fx]);

  if (profiles.length <= 1) return null;

  const total = Object.values(split).reduce((sum, value) => sum + value, 0);
  if (total === 0) return null;

  return (
    <section className="panel p-5">
      <div className="mb-3 flex items-center gap-2">
        <Users aria-hidden="true" className="text-[color:var(--accent-2)]" size={20} />
        <h2 className="text-xl font-extrabold">Per-profile burn</h2>
      </div>
      <ul className="grid gap-2">
        {profiles.map((profile) => {
          const cents = split[profile.id] ?? 0;
          const pct = total === 0 ? 0 : Math.round((cents / total) * 100);
          return (
            <li key={profile.id} className="grid grid-cols-[auto_1fr_auto] items-center gap-3">
              <span
                className="grid h-7 w-7 place-items-center rounded-full text-xs font-extrabold"
                style={{ background: profile.avatarColor, color: "#140b08" }}
              >
                {profile.name.slice(0, 2).toUpperCase()}
              </span>
              <span className="block h-3 rounded bg-[color:var(--panel-strong)]">
                <span
                  className="block h-3 rounded"
                  style={{ background: profile.avatarColor, width: `${Math.min(100, pct)}%` }}
                />
              </span>
              <span className="text-sm font-extrabold">{formatMoney(cents, fx.baseCurrency)}/mo</span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
