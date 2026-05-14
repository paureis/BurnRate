import { describe, expect, it } from "vitest";
import {
  buildActiveDiscount,
  isExpiringSoon,
  publicPriceLookup,
  summarizeDiscount,
  totalActiveDiscountsCents,
} from "../discounts";
import { buildFxContext } from "../currency";
import type { ActiveDiscount, Subscription } from "../burnrate";

function makeSub(overrides: Partial<Subscription> = {}): Subscription {
  return {
    id: "sub-1",
    name: "Spotify",
    costCents: 599,
    billingCycle: "monthly",
    category: "music",
    nextBillingDate: "2026-06-01",
    notes: "",
    createdAt: "2026-01-01T00:00:00.000Z",
    currency: "USD",
    ...overrides,
  };
}

function discount(over: Partial<ActiveDiscount> = {}): ActiveDiscount {
  return {
    id: "disc-1",
    originalCostCents: 1199,
    negotiatedOn: "2026-04-01",
    source: "retention",
    ...over,
  };
}

describe("publicPriceLookup", () => {
  it("returns popular-services price for a known service", () => {
    const result = publicPriceLookup("Spotify");
    expect(result.source).toBe("popularServices");
    expect(result.cents).toBeGreaterThan(0);
  });

  it("returns source=none for unknown names", () => {
    const result = publicPriceLookup("Some Unknown Service");
    expect(result.source).toBe("none");
    expect(result.cents).toBe(0);
  });

  it("is case-insensitive", () => {
    const a = publicPriceLookup("NETFLIX");
    const b = publicPriceLookup("netflix");
    expect(a.cents).toBe(b.cents);
  });
});

describe("summarizeDiscount", () => {
  it("returns null when no discount", () => {
    expect(summarizeDiscount(makeSub())).toBeNull();
  });

  it("computes monthly savings against the original price", () => {
    const sub = makeSub({ costCents: 599, activeDiscount: discount({ originalCostCents: 1199 }) });
    const summary = summarizeDiscount(sub, buildFxContext("USD", {}), new Date("2026-05-15"));
    expect(summary?.monthlySavingsCents).toBe(600);
    expect(summary?.annualSavingsCents).toBe(7200);
  });

  it("converts savings to base currency", () => {
    const fx = buildFxContext("USD", { EUR: 0.9 });
    const sub = makeSub({
      costCents: 500,
      currency: "EUR",
      activeDiscount: discount({ originalCostCents: 900 }),
    });
    const summary = summarizeDiscount(sub, fx, new Date("2026-05-15"));
    expect(summary?.monthlySavingsCents).toBeGreaterThan(400);
  });

  it("emits negative daysUntilExpiry for expired discounts", () => {
    const sub = makeSub({
      activeDiscount: discount({ expiresOn: "2026-03-01" }),
    });
    const summary = summarizeDiscount(sub, undefined, new Date("2026-05-15"));
    expect((summary?.daysUntilExpiry ?? 0)).toBeLessThan(0);
  });

  it("includes public-price comparison when a match exists", () => {
    const sub = makeSub({ name: "Netflix", costCents: 599, activeDiscount: discount({ originalCostCents: 1599 }) });
    const summary = summarizeDiscount(sub, undefined, new Date("2026-05-15"));
    expect(summary?.publicPriceComparisonCents).not.toBeNull();
  });
});

describe("isExpiringSoon", () => {
  it("returns true within the 14-day window", () => {
    const sub = makeSub({ activeDiscount: discount({ expiresOn: "2026-05-20" }) });
    expect(isExpiringSoon(sub, new Date("2026-05-15"))).toBe(true);
  });

  it("returns false outside the window", () => {
    const sub = makeSub({ activeDiscount: discount({ expiresOn: "2026-06-30" }) });
    expect(isExpiringSoon(sub, new Date("2026-05-15"))).toBe(false);
  });

  it("returns false when there is no expiry", () => {
    const sub = makeSub({ activeDiscount: discount() });
    expect(isExpiringSoon(sub, new Date("2026-05-15"))).toBe(false);
  });
});

describe("totalActiveDiscountsCents", () => {
  it("sums monthly + yearly savings, excluding expired", () => {
    const subs = [
      makeSub({ id: "a", costCents: 599, activeDiscount: discount({ originalCostCents: 1199 }) }),
      makeSub({
        id: "b",
        costCents: 800,
        activeDiscount: discount({ originalCostCents: 1500, expiresOn: "2026-01-01" }),
      }),
    ];
    const result = totalActiveDiscountsCents(subs, buildFxContext("USD", {}), new Date("2026-05-15"));
    expect(result.monthly).toBe(600);
    expect(result.yearly).toBe(7200);
  });
});

describe("buildActiveDiscount", () => {
  it("assigns id and preserves fields", () => {
    const built = buildActiveDiscount({
      originalCostCents: 1199,
      negotiatedOn: "2026-04-01",
      source: "retention",
      expiresOn: "2027-04-01",
    });
    expect(built.id).toMatch(/^disc-/);
    expect(built.expiresOn).toBe("2027-04-01");
  });
});
