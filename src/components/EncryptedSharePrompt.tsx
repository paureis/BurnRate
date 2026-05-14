"use client";

import { useEffect, useState } from "react";
import { Lock } from "lucide-react";
import { calculateBurnMetrics, formatCents, type Subscription } from "@/lib/burnrate";
import { decodeSyncPayload } from "@/lib/sync";
import { unwrapSharePayload } from "@/lib/crypto-share";

interface EncryptedSharePromptProps {
  wrappedPayload: string;
}

export function EncryptedSharePrompt({ wrappedPayload }: EncryptedSharePromptProps) {
  const [passphrase, setPassphrase] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [attempts, setAttempts] = useState(0);
  const [cooldownSeconds, setCooldownSeconds] = useState(0);
  const [revealed, setRevealed] = useState<{
    subs: Subscription[];
    monthlyCents: number;
    yearlyCents: number;
  } | null>(null);

  useEffect(() => {
    if (cooldownSeconds <= 0) return;
    const timer = window.setTimeout(() => setCooldownSeconds((c) => Math.max(0, c - 1)), 1000);
    return () => window.clearTimeout(timer);
  }, [cooldownSeconds]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (cooldownSeconds > 0) return;
    setError(null);
    try {
      const plain = await unwrapSharePayload(wrappedPayload, passphrase);
      const data = decodeSyncPayload(plain);
      const metrics = calculateBurnMetrics(data.subscriptions);
      setRevealed({
        subs: data.subscriptions,
        monthlyCents: metrics.monthlyBurnCents,
        yearlyCents: metrics.yearlyBurnCents,
      });
    } catch {
      setError("Incorrect passphrase.");
      setAttempts((a) => {
        const next = a + 1;
        if (next >= 5) setCooldownSeconds(30);
        return next;
      });
    }
  }

  if (revealed) {
    const topFive = [...revealed.subs]
      .sort((a, b) => b.costCents - a.costCents)
      .slice(0, 5);
    return (
      <div className="app-shell min-h-screen">
        <header className="mx-auto grid w-full max-w-3xl gap-3 px-4 pb-2 pt-10 sm:px-6">
          <p className="text-xs font-extrabold uppercase tracking-[0.28em] text-[color:var(--accent-2)]">
            Encrypted BurnRate snapshot
          </p>
          <h1 className="font-display text-5xl leading-none">Unlocked share</h1>
          <p className="text-sm text-[color:var(--muted)]">
            Decrypted in your browser. The passphrase never leaves this device.
          </p>
        </header>
        <main className="mx-auto grid w-full max-w-3xl gap-4 px-4 pb-16 sm:px-6">
          <section className="panel p-6">
            <p className="text-xs font-extrabold uppercase tracking-[0.22em] text-[color:var(--accent)]">
              Monthly burn
            </p>
            <p className="stat-number mt-2 text-[clamp(4rem,15vw,8rem)]">
              {formatCents(revealed.monthlyCents, true)}
            </p>
            <p className="mt-2 text-sm font-bold text-[color:var(--muted)]">
              {formatCents(revealed.yearlyCents, true)} per year
            </p>
          </section>
          <section className="panel p-5">
            <h2 className="text-xl font-extrabold">Top 5 subscriptions</h2>
            <ul className="mt-3 grid gap-2">
              {topFive.map((item) => (
                <li
                  key={`${item.name}-${item.costCents}`}
                  className="flex items-center justify-between rounded-panel border border-[color:var(--line)] bg-[color:var(--panel-strong)] p-3"
                >
                  <span className="min-w-0">
                    <span className="block truncate font-extrabold">{item.name}</span>
                    <span className="text-xs font-bold uppercase tracking-[0.16em] text-[color:var(--muted)]">
                      {item.category}
                    </span>
                  </span>
                  <span className="text-sm font-bold">
                    {formatCents(item.costCents)} {item.billingCycle}
                  </span>
                </li>
              ))}
              {topFive.length === 0 && (
                <li className="rounded-panel border border-[color:var(--line)] bg-[color:var(--panel-strong)] p-3 text-sm font-bold text-[color:var(--muted)]">
                  None.
                </li>
              )}
            </ul>
          </section>
          <p className="text-center text-xs font-extrabold uppercase tracking-[0.18em] text-[color:var(--muted)]">
            Built with BurnRate
          </p>
        </main>
      </div>
    );
  }

  return (
    <div className="app-shell min-h-screen">
      <main className="mx-auto grid min-h-screen w-full max-w-md place-items-center px-4">
        <section className="panel w-full p-6 text-center">
          <Lock aria-hidden="true" className="mx-auto mb-3 text-[color:var(--accent)]" size={32} />
          <h1 className="font-display text-3xl leading-none">Passphrase-protected share</h1>
          <p className="mt-3 text-sm text-[color:var(--muted)]">
            The sender wrapped this BurnRate snapshot with a passphrase. Enter it to view the summary.
          </p>
          <form className="mt-5 grid gap-3" onSubmit={(event) => void submit(event)}>
            <input
              type="password"
              className="input"
              placeholder="Passphrase"
              value={passphrase}
              onChange={(event) => setPassphrase(event.target.value)}
              disabled={cooldownSeconds > 0}
              autoComplete="off"
              aria-label="Share passphrase"
            />
            <button
              type="submit"
              className="button-primary justify-center"
              disabled={cooldownSeconds > 0 || passphrase.length === 0}
            >
              {cooldownSeconds > 0 ? `Wait ${cooldownSeconds}s` : "Unlock"}
            </button>
          </form>
          {error && (
            <p className="mt-3 text-sm font-bold text-[color:var(--accent)]">
              {error}
              {attempts >= 5 && cooldownSeconds > 0 && ` Too many attempts — waiting ${cooldownSeconds}s.`}
            </p>
          )}
        </section>
      </main>
    </div>
  );
}
