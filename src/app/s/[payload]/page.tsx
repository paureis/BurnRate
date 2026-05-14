import type { Metadata } from "next";
import { calculateBurnMetrics, formatCents } from "@/lib/burnrate";
import { decodeSyncPayload, SyncDecodeError } from "@/lib/sync";
import { isEncryptedSharePayload, SHARE_PAYLOAD_PREFIX } from "@/lib/crypto-share";
import { EncryptedSharePrompt } from "@/components/EncryptedSharePrompt";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ payload: string }>;
}): Promise<Metadata> {
  const { payload } = await params;
  return {
    title: "BurnRate share",
    description: "Public read-only summary of monthly subscription burn.",
    robots: { index: false, follow: false },
    openGraph: {
      title: "BurnRate share",
      description: "Public read-only summary of monthly subscription burn.",
      images: [`/s/${payload}/opengraph-image`],
    },
    twitter: {
      card: "summary_large_image",
      images: [`/s/${payload}/opengraph-image`],
    },
  };
}

export default async function SharePage({
  params,
}: {
  params: Promise<{ payload: string }>;
}) {
  const { payload } = await params;
  if (isEncryptedSharePayload(payload)) {
    // Hand off to a client component for passphrase entry + browser-side decrypt.
    return <EncryptedSharePrompt wrappedPayload={payload.slice(SHARE_PAYLOAD_PREFIX.length)} />;
  }
  try {
    const data = decodeSyncPayload(payload);
    const sanitized = {
      ...data,
      subscriptions: data.subscriptions.map((subscription) => ({ ...subscription, notes: "" })),
    };
    const metrics = calculateBurnMetrics(sanitized.subscriptions);
    const topFive = [...sanitized.subscriptions]
      .map((subscription) => ({
        name: subscription.name,
        category: subscription.category,
        costCents: subscription.costCents,
        billingCycle: subscription.billingCycle,
      }))
      .sort((a, b) => b.costCents - a.costCents)
      .slice(0, 5);

    return (
      <div className="app-shell min-h-screen">
        <header className="mx-auto grid w-full max-w-3xl gap-5 px-4 pb-2 pt-10 sm:px-6">
          <p className="text-xs font-extrabold uppercase tracking-[0.28em] text-[color:var(--accent-2)]">
            Public BurnRate snapshot
          </p>
          <h1 className="font-display text-5xl leading-none tracking-normal sm:text-6xl">Read-only share</h1>
          <p className="text-sm text-[color:var(--muted)]">
            Notes were stripped before this link was generated. This page is not indexed.
          </p>
        </header>

        <main className="mx-auto grid w-full max-w-3xl gap-4 px-4 pb-16 sm:px-6">
          <section className="panel p-6" aria-label="Monthly burn">
            <p className="text-xs font-extrabold uppercase tracking-[0.22em] text-[color:var(--accent)]">
              Monthly burn
            </p>
            <p className="stat-number mt-2 text-[clamp(4rem,15vw,8rem)]">
              {formatCents(metrics.monthlyBurnCents, true)}
            </p>
            <p className="mt-2 text-sm font-bold text-[color:var(--muted)]">
              {formatCents(metrics.yearlyBurnCents, true)} per year
            </p>
          </section>

          <section className="panel p-5" aria-label="Categories">
            <h2 className="text-xl font-extrabold">Top categories</h2>
            <ul className="mt-3 grid gap-2">
              {metrics.categoryBreakdown.slice(0, 5).map((category) => (
                <li
                  key={category.category}
                  className="flex items-center justify-between rounded-panel border border-[color:var(--line)] bg-[color:var(--panel-strong)] p-3"
                >
                  <span className="font-extrabold">{category.category}</span>
                  <span className="text-sm font-bold text-[color:var(--muted)]">
                    {formatCents(category.monthlyCents)}/mo · {category.percentage}%
                  </span>
                </li>
              ))}
              {metrics.categoryBreakdown.length === 0 && (
                <li className="rounded-panel border border-[color:var(--line)] bg-[color:var(--panel-strong)] p-3 text-sm font-bold text-[color:var(--muted)]">
                  No spending captured.
                </li>
              )}
            </ul>
          </section>

          <section className="panel p-5" aria-label="Top subscriptions">
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
  } catch (error) {
    const message = error instanceof SyncDecodeError ? error.message : "Invalid share link.";
    return (
      <div className="app-shell min-h-screen">
        <main className="mx-auto grid min-h-screen w-full max-w-md place-items-center px-4">
          <section className="panel p-6 text-center">
            <h1 className="font-display text-4xl leading-none">Share link is invalid</h1>
            <p className="mt-3 text-sm font-bold text-[color:var(--muted)]">
              This BurnRate share link is invalid or expired. Ask the sender to generate a new one.
            </p>
            <p className="mt-4 text-xs font-bold uppercase tracking-[0.18em] text-[color:var(--accent-2)]">
              Detail: {message}
            </p>
          </section>
        </main>
      </div>
    );
  }
}
