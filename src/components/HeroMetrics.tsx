"use client";

import { useEffect, useRef, useState } from "react";
import { formatCents } from "@/lib/burnrate";

export function HeroMetrics({ monthlyCents, yearlyCents }: { monthlyCents: number; yearlyCents: number }) {
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

export function AnimatedMoney({ className, value }: { className?: string; value: number }) {
  const animated = useAnimatedNumber(value);
  return <p className={className}>{formatCents(animated, true)}</p>;
}

export function useAnimatedNumber(target: number, duration = 520) {
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
