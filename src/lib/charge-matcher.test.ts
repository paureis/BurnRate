import { describe, it, expect } from "vitest";
import { popularServices } from "@/data/popular-services";
import { matchCharges } from "./charge-matcher";
import type { Subscription } from "./burnrate";
import type { ParsedCharge } from "./charges";

function charge(vendor: string, amountCents = 1599): ParsedCharge {
  return {
    rawLine: `${vendor} $${(amountCents / 100).toFixed(2)}`,
    amountCents,
    currency: "USD",
    vendorGuess: vendor,
  };
}

function sub(name: string, id = `sub-${name}`): Subscription {
  return {
    id,
    name,
    costCents: 1599,
    billingCycle: "monthly",
    category: "entertainment",
    nextBillingDate: "2026-06-01",
    notes: "",
    createdAt: "2026-01-01T00:00:00.000Z",
    currency: "USD",
  };
}

describe("matchCharges", () => {
  it("returns 'new' when there are no existing subs or popular matches", () => {
    const result = matchCharges([charge("Some Obscure Service")], [], []);
    expect(result[0].matchType).toBe("new");
  });

  it("matches an exact existing subscription", () => {
    const result = matchCharges([charge("Netflix")], [sub("Netflix")], []);
    expect(result[0].matchType).toBe("existing");
  });

  it("matches a popular service by exact name when no existing sub matches", () => {
    const result = matchCharges([charge("Netflix")], [], popularServices);
    expect(result[0].matchType).toBe("popular");
    expect(result[0].matchedPopularName).toBe("Netflix");
  });

  it("matches with a suffix difference (NETFLIX.COM)", () => {
    const result = matchCharges([charge("NETFLIX.COM")], [], popularServices);
    expect(result[0].matchType).toBe("popular");
  });

  it("falls back to 'new' on a low-confidence vendor", () => {
    const result = matchCharges([charge("XQ ZTPK")], [], popularServices);
    expect(result[0].matchType).toBe("new");
  });

  it("prefers an existing sub over a popular match when both apply", () => {
    const result = matchCharges([charge("Netflix")], [sub("Netflix", "sub-existing")], popularServices);
    expect(result[0].matchType).toBe("existing");
    expect(result[0].matchedSubscriptionId).toBe("sub-existing");
  });
});
