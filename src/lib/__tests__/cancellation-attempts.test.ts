import { describe, expect, it } from "vitest";
import {
  attemptSummary,
  buildAttempt,
  closeAttempt,
  normalizeAttempts,
} from "../cancellation-attempts";

describe("buildAttempt", () => {
  it("assigns id + startedAt", () => {
    const attempt = buildAttempt({ subscriptionId: "sub-1", serviceName: "Netflix" });
    expect(attempt.id).toMatch(/^att-/);
    expect(attempt.startedAt).toMatch(/T/);
    expect(attempt.outcome).toBeUndefined();
  });
});

describe("closeAttempt", () => {
  it("records outcome + completedAt", () => {
    const attempt = buildAttempt({ subscriptionId: "sub-1", serviceName: "Netflix" });
    const closed = closeAttempt(attempt, "cancelled", { ledgerRecordId: "led-1" });
    expect(closed.outcome).toBe("cancelled");
    expect(closed.completedAt).toMatch(/T/);
    expect(closed.ledgerRecordId).toBe("led-1");
  });

  it("preserves the original startedAt", () => {
    const attempt = buildAttempt({ subscriptionId: "sub-1", serviceName: "Netflix" });
    const closed = closeAttempt(attempt, "abandoned");
    expect(closed.startedAt).toBe(attempt.startedAt);
  });
});

describe("normalizeAttempts", () => {
  it("drops malformed rows", () => {
    const stored = [
      null,
      { id: "att-1" /* missing fields */ },
      {
        id: "att-2",
        subscriptionId: "sub-1",
        serviceName: "Spotify",
        startedAt: "2026-05-14T00:00:00.000Z",
      },
    ];
    const result = normalizeAttempts(stored);
    expect(result.map((a) => a.id)).toEqual(["att-2"]);
  });

  it("dedupes by id", () => {
    const stored = [
      {
        id: "att-1",
        subscriptionId: "sub-1",
        serviceName: "Spotify",
        startedAt: "2026-05-14T00:00:00.000Z",
      },
      {
        id: "att-1",
        subscriptionId: "sub-1",
        serviceName: "Spotify",
        startedAt: "2026-05-14T00:00:00.000Z",
      },
    ];
    expect(normalizeAttempts(stored).length).toBe(1);
  });

  it("rejects unknown outcomes silently", () => {
    const stored = [
      {
        id: "att-1",
        subscriptionId: "sub-1",
        serviceName: "Spotify",
        startedAt: "2026-05-14T00:00:00.000Z",
        outcome: "not-a-real-outcome",
      },
    ];
    expect(normalizeAttempts(stored)[0].outcome).toBeUndefined();
  });
});

describe("attemptSummary", () => {
  it("counts by outcome", () => {
    const attempts = [
      buildAttempt({ subscriptionId: "a", serviceName: "X" }),
      closeAttempt(buildAttempt({ subscriptionId: "b", serviceName: "Y" }), "cancelled"),
      closeAttempt(buildAttempt({ subscriptionId: "c", serviceName: "Z" }), "kept"),
      closeAttempt(buildAttempt({ subscriptionId: "d", serviceName: "W" }), "discount-accepted"),
    ];
    const summary = attemptSummary(attempts);
    expect(summary.total).toBe(4);
    expect(summary.cancelled).toBe(1);
    expect(summary.kept).toBe(1);
    expect(summary.discountAccepted).toBe(1);
  });
});
