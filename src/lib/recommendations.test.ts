import { describe, it, expect } from "vitest";
import { bundleRules } from "@/data/bundle-rules";
import { overlapRules } from "@/data/overlap-rules";
import { detectBundles, detectOverlaps } from "./recommendations";
import type { Subscription } from "./burnrate";

function sub(overrides: Partial<Subscription>): Subscription {
  return {
    id: overrides.id ?? `id-${overrides.name}`,
    name: overrides.name ?? "Service",
    costCents: overrides.costCents ?? 1000,
    billingCycle: overrides.billingCycle ?? "monthly",
    category: overrides.category ?? "other",
    nextBillingDate: "2026-06-01",
    notes: "",
    createdAt: "2026-01-01T00:00:00.000Z",
    currency: overrides.currency ?? "USD",
    ...overrides,
  } satisfies Subscription;
}

describe("detectBundles", () => {
  it("returns nothing when no matches exist", () => {
    expect(detectBundles([sub({ name: "Random Service" })], bundleRules)).toEqual([]);
  });

  it("does not match when below minMatches", () => {
    const subs = [sub({ name: "Apple Music", costCents: 1099 })];
    expect(detectBundles(subs, bundleRules)).toEqual([]);
  });

  it("matches Apple One Individual when two qualifying services exist", () => {
    const subs = [
      sub({ name: "Apple Music", costCents: 1099 }),
      sub({ name: "Apple TV+", costCents: 999 }),
    ];
    const matches = detectBundles(subs, bundleRules);
    expect(matches.some((match) => match.rule.id === "apple-one-individual")).toBe(true);
    const apple = matches.find((match) => match.rule.id === "apple-one-individual");
    expect(apple?.currentMonthlyCents).toBe(1099 + 999);
    expect(apple?.savingsMonthlyCents).toBeGreaterThan(0);
  });

  it("filters out a bundle when standalone is cheaper", () => {
    const subs = [
      sub({ name: "Apple Music", costCents: 100 }),
      sub({ name: "Apple TV+", costCents: 100 }),
    ];
    expect(detectBundles(subs, bundleRules)).toEqual([]);
  });
});

describe("detectOverlaps", () => {
  it("returns nothing with too few matches", () => {
    expect(detectOverlaps([sub({ name: "Netflix" })], overlapRules)).toEqual([]);
  });

  it("flags multiple video streamers (3+)", () => {
    const subs = [
      sub({ name: "Netflix", costCents: 1599 }),
      sub({ name: "Hulu", costCents: 999 }),
      sub({ name: "Max", costCents: 1499 }),
    ];
    const matches = detectOverlaps(subs, overlapRules);
    const video = matches.find((match) => match.rule.id === "overlap-video");
    expect(video).toBeDefined();
    expect(video?.matchedSubscriptions.length).toBe(3);
    expect(video?.cheapestSubscription.name).toBe("Hulu");
  });

  it("flags multiple music streamers (2+)", () => {
    const subs = [
      sub({ name: "Spotify", costCents: 1199 }),
      sub({ name: "Apple Music", costCents: 1099 }),
    ];
    const matches = detectOverlaps(subs, overlapRules);
    expect(matches.some((match) => match.rule.id === "overlap-music")).toBe(true);
  });
});
