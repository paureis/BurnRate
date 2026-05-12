import { describe, expect, it } from "vitest";
import { calculateBurnMetrics } from "@/lib/burnrate";
import { decodeSyncPayload, encodeSyncPayload, SyncDecodeError } from "@/lib/sync";

const FIXTURE = {
  subscriptions: [
    {
      id: "n",
      name: "Netflix",
      costCents: 1599,
      billingCycle: "monthly" as const,
      category: "entertainment",
      nextBillingDate: "2026-06-01",
      notes: "private note",
      createdAt: "2026-01-01T00:00:00.000Z",
    },
    {
      id: "s",
      name: "Spotify",
      costCents: 999,
      billingCycle: "monthly" as const,
      category: "music",
      nextBillingDate: "2026-06-15",
      notes: "another secret note",
      createdAt: "2026-01-01T00:00:00.000Z",
    },
  ],
  trials: [],
  theme: "dark" as const,
};

describe("share-page hydration", () => {
  it("decodes the payload and produces identical metrics after stripping notes", () => {
    const encoded = encodeSyncPayload({
      ...FIXTURE,
      subscriptions: FIXTURE.subscriptions.map((subscription) => ({ ...subscription, notes: "" })),
    });
    const decoded = decodeSyncPayload(encoded);
    for (const subscription of decoded.subscriptions) {
      expect(subscription.notes).toBe("");
    }

    const metrics = calculateBurnMetrics(decoded.subscriptions);
    const expectedYearly = (1599 + 999) * 12;
    expect(metrics.yearlyBurnCents).toBe(expectedYearly);
  });

  it("rejects a garbage payload with SyncDecodeError", () => {
    expect(() => decodeSyncPayload("garbage")).toThrow(SyncDecodeError);
  });

  it("encoded share payload does not contain raw subscription notes from the original", () => {
    const encoded = encodeSyncPayload({
      ...FIXTURE,
      subscriptions: FIXTURE.subscriptions.map((subscription) => ({ ...subscription, notes: "" })),
    });
    expect(encoded).not.toContain("private note");
    expect(encoded).not.toContain("secret note");
  });

  it("notes stay stripped through encode → decode", () => {
    const stripped = FIXTURE.subscriptions.map((subscription) => ({ ...subscription, notes: "" }));
    const decoded = decodeSyncPayload(encodeSyncPayload({ ...FIXTURE, subscriptions: stripped }));
    expect(decoded.subscriptions.every((subscription) => subscription.notes === "")).toBe(true);
  });
});
