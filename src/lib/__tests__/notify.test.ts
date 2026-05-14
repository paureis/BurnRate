import { describe, expect, it } from "vitest";
import { defaultNotifySettings, pruneFiredScheduled, scheduleAll } from "../notify";
import type { Subscription, Trial } from "../burnrate";

function makeSub(overrides: Partial<Subscription> = {}): Subscription {
  return {
    id: "sub-1",
    name: "Netflix",
    costCents: 1500,
    billingCycle: "monthly",
    category: "entertainment",
    nextBillingDate: "2026-05-20",
    notes: "",
    createdAt: "2026-01-01T00:00:00.000Z",
    currency: "USD",
    ...overrides,
  };
}

function makeTrial(overrides: Partial<Trial> = {}): Trial {
  return {
    id: "trial-1",
    name: "Notion",
    trialStartDate: "2026-05-01",
    trialEndDate: "2026-05-25",
    costAfterTrialCents: 1000,
    remindMe: true,
    createdAt: "2026-05-01T00:00:00.000Z",
    currency: "USD",
    ...overrides,
  };
}

describe("scheduleAll", () => {
  it("emits nothing when notifications are disabled", () => {
    const result = scheduleAll(
      { subscriptions: [makeSub()], trials: [], now: new Date("2026-05-15") },
      defaultNotifySettings,
    );
    expect(result).toEqual([]);
  });

  it("emits a renewal entry inside the window", () => {
    const result = scheduleAll(
      { subscriptions: [makeSub({ nextBillingDate: "2026-05-20" })], trials: [], now: new Date("2026-05-15") },
      { ...defaultNotifySettings, enabled: true },
    );
    expect(result.find((n) => n.channel === "renewal")).toBeDefined();
  });

  it("skips renewals outside the 30-day horizon", () => {
    const result = scheduleAll(
      { subscriptions: [makeSub({ nextBillingDate: "2026-12-01" })], trials: [], now: new Date("2026-05-15") },
      { ...defaultNotifySettings, enabled: true },
    );
    expect(result.find((n) => n.channel === "renewal")).toBeUndefined();
  });

  it("emits trial-end entries with the configured lead time", () => {
    const result = scheduleAll(
      {
        subscriptions: [],
        trials: [makeTrial({ trialEndDate: "2026-05-25" })],
        now: new Date("2026-05-15"),
      },
      { ...defaultNotifySettings, enabled: true },
    );
    expect(result.find((n) => n.channel === "trial-end")).toBeDefined();
  });

  it("emits price-change entries the day before effective date", () => {
    const result = scheduleAll(
      {
        subscriptions: [
          makeSub({
            priceChanges: [
              { id: "pc-1", effectiveDate: "2026-05-20", newCostCents: 1799, addedAt: "2026-04-01T00:00:00.000Z" },
            ],
          }),
        ],
        trials: [],
        now: new Date("2026-05-15"),
      },
      { ...defaultNotifySettings, enabled: true },
    );
    expect(result.find((n) => n.channel === "price-change")).toBeDefined();
  });

  it("emits discount-expiry entries when expiry is within the window", () => {
    const result = scheduleAll(
      {
        subscriptions: [
          makeSub({
            activeDiscount: {
              id: "d-1",
              originalCostCents: 1199,
              negotiatedOn: "2026-04-01",
              expiresOn: "2026-05-22",
              source: "retention",
            },
          }),
        ],
        trials: [],
        now: new Date("2026-05-15"),
      },
      { ...defaultNotifySettings, enabled: true },
    );
    expect(result.find((n) => n.channel === "discount-expiry")).toBeDefined();
  });

  it("respects per-channel toggles", () => {
    const result = scheduleAll(
      { subscriptions: [makeSub({ nextBillingDate: "2026-05-20" })], trials: [], now: new Date("2026-05-15") },
      { ...defaultNotifySettings, enabled: true, channels: { ...defaultNotifySettings.channels, renewal: false } },
    );
    expect(result).toEqual([]);
  });

  it("sorts output by fireAt ascending", () => {
    const result = scheduleAll(
      {
        subscriptions: [
          makeSub({ id: "a", nextBillingDate: "2026-05-25" }),
          makeSub({ id: "b", nextBillingDate: "2026-05-20" }),
        ],
        trials: [],
        now: new Date("2026-05-15"),
      },
      { ...defaultNotifySettings, enabled: true },
    );
    expect(result[0].fireAt <= result[1].fireAt).toBe(true);
  });

  it("emits pending-cancel notifications the day before cancelling-on", () => {
    const result = scheduleAll(
      { subscriptions: [makeSub({ cancellingOn: "2026-05-25" })], trials: [], now: new Date("2026-05-15") },
      { ...defaultNotifySettings, enabled: true },
    );
    expect(result.find((n) => n.channel === "pending-cancel")).toBeDefined();
  });
});

describe("pruneFiredScheduled", () => {
  it("removes only the matching ids", () => {
    const stored = [
      { id: "a", channel: "renewal" as const, fireAt: "2026-05-20T09:00:00.000Z", title: "A", body: "..." },
      { id: "b", channel: "renewal" as const, fireAt: "2026-05-21T09:00:00.000Z", title: "B", body: "..." },
    ];
    expect(pruneFiredScheduled(stored, ["a"]).map((n) => n.id)).toEqual(["b"]);
  });

  it("is a no-op for empty firedIds", () => {
    const stored = [
      { id: "a", channel: "renewal" as const, fireAt: "2026-05-20T09:00:00.000Z", title: "A", body: "..." },
    ];
    expect(pruneFiredScheduled(stored, [])).toBe(stored);
  });
});
