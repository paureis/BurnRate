import { describe, expect, it } from "vitest";
import type { BurnRateData, Subscription, Trial } from "@/lib/burnrate";
import { serializeBurnRateIcs } from "@/lib/ics";

const TODAY = new Date(2026, 0, 15); // 2026-01-15 local time

function makeSubscription(overrides: Partial<Subscription> = {}): Subscription {
  return {
    id: overrides.id ?? "sub-1",
    name: overrides.name ?? "Netflix",
    costCents: overrides.costCents ?? 1599,
    billingCycle: overrides.billingCycle ?? "monthly",
    category: overrides.category ?? "entertainment",
    nextBillingDate: overrides.nextBillingDate ?? "2026-01-20",
    notes: overrides.notes ?? "",
    color: overrides.color,
    icon: overrides.icon,
    createdAt: overrides.createdAt ?? "2026-01-01T00:00:00.000Z",
  };
}

function makeTrial(overrides: Partial<Trial> = {}): Trial {
  return {
    id: overrides.id ?? "trial-1",
    name: overrides.name ?? "Notion AI",
    trialStartDate: overrides.trialStartDate ?? "2026-01-10",
    trialEndDate: overrides.trialEndDate ?? "2026-01-25",
    costAfterTrialCents: overrides.costAfterTrialCents ?? 1000,
    remindMe: overrides.remindMe ?? true,
    createdAt: overrides.createdAt ?? "2026-01-01T00:00:00.000Z",
  };
}

function emptyData(): BurnRateData {
  return { subscriptions: [], trials: [], theme: "dark" };
}

function vevents(ics: string): string[] {
  const blocks: string[] = [];
  const lines = ics.split("\r\n");
  let current: string[] | null = null;
  for (const line of lines) {
    if (line === "BEGIN:VEVENT") {
      current = [];
      continue;
    }
    if (line === "END:VEVENT") {
      if (current) {
        blocks.push(current.join("\r\n"));
      }
      current = null;
      continue;
    }
    if (current) {
      current.push(line);
    }
  }
  return blocks;
}

describe("serializeBurnRateIcs", () => {
  it("emits a valid calendar wrapper for empty data with no events", () => {
    const ics = serializeBurnRateIcs(emptyData(), { today: TODAY });

    expect(ics.startsWith("BEGIN:VCALENDAR\r\n")).toBe(true);
    expect(ics.endsWith("END:VCALENDAR")).toBe(true);
    expect(ics).toContain("VERSION:2.0");
    expect(ics).toContain("PRODID:-//BurnRate//EN");
    expect(ics).toContain("CALSCALE:GREGORIAN");
    expect(ics).toContain("METHOD:PUBLISH");
    expect(vevents(ics)).toHaveLength(0);
  });

  it("expands a weekly subscription across the 12-month horizon (~52 events)", () => {
    const data: BurnRateData = {
      ...emptyData(),
      subscriptions: [
        makeSubscription({ name: "Coffee", costCents: 500, billingCycle: "weekly", nextBillingDate: "2026-01-18" }),
      ],
    };
    const ics = serializeBurnRateIcs(data, { today: TODAY });
    const events = vevents(ics);

    expect(events.length).toBeGreaterThanOrEqual(51);
    expect(events.length).toBeLessThanOrEqual(53);
    for (const block of events) {
      expect(block).toContain("DTSTART;VALUE=DATE:");
      expect(block).toContain("UID:sub-1-202");
    }
  });

  it("expands a monthly subscription to 12 events within 12 months", () => {
    const data: BurnRateData = {
      ...emptyData(),
      subscriptions: [
        makeSubscription({ name: "Netflix", billingCycle: "monthly", nextBillingDate: "2026-01-20" }),
      ],
    };
    const ics = serializeBurnRateIcs(data, { today: TODAY });
    const events = vevents(ics);

    expect(events).toHaveLength(12);
    expect(events[0]).toContain("DTSTART;VALUE=DATE:20260120");
    expect(events[11]).toContain("DTSTART;VALUE=DATE:20261220");
    expect(events[0]).toContain("SUMMARY:Netflix renews — $15.99");
  });

  it("expands a quarterly subscription to ~4 events within 12 months", () => {
    const data: BurnRateData = {
      ...emptyData(),
      subscriptions: [
        makeSubscription({ name: "Tax tool", billingCycle: "quarterly", nextBillingDate: "2026-02-01" }),
      ],
    };
    const ics = serializeBurnRateIcs(data, { today: TODAY });
    const events = vevents(ics);

    expect(events).toHaveLength(4);
    expect(events[0]).toContain("DTSTART;VALUE=DATE:20260201");
    expect(events[1]).toContain("DTSTART;VALUE=DATE:20260501");
    expect(events[3]).toContain("DTSTART;VALUE=DATE:20261101");
  });

  it("expands a yearly subscription to exactly 1 event", () => {
    const data: BurnRateData = {
      ...emptyData(),
      subscriptions: [
        makeSubscription({ name: "Domain", costCents: 1200, billingCycle: "yearly", nextBillingDate: "2026-06-01" }),
      ],
    };
    const ics = serializeBurnRateIcs(data, { today: TODAY });
    const events = vevents(ics);

    expect(events).toHaveLength(1);
    expect(events[0]).toContain("DTSTART;VALUE=DATE:20260601");
    expect(events[0]).toContain("SUMMARY:Domain renews — $12.00");
  });

  it("emits a single VEVENT for a trial with the trial-end SUMMARY", () => {
    const data: BurnRateData = {
      ...emptyData(),
      trials: [makeTrial({ name: "Notion AI", costAfterTrialCents: 1000, trialEndDate: "2026-01-25" })],
    };
    const ics = serializeBurnRateIcs(data, { today: TODAY });
    const events = vevents(ics);

    expect(events).toHaveLength(1);
    expect(events[0]).toContain("DTSTART;VALUE=DATE:20260125");
    expect(events[0]).toContain("SUMMARY:Notion AI trial ends — becomes $10.00/mo");
    expect(events[0]).toContain("UID:trial-1-20260125@burnrate.app");
  });

  it("combines subscriptions and trials in a single calendar", () => {
    const data: BurnRateData = {
      subscriptions: [
        makeSubscription({ id: "a", name: "Netflix", billingCycle: "monthly", nextBillingDate: "2026-01-20" }),
        makeSubscription({ id: "b", name: "Domain", billingCycle: "yearly", nextBillingDate: "2026-04-01" }),
      ],
      trials: [makeTrial({ id: "c", name: "Linear", trialEndDate: "2026-02-01" })],
      theme: "dark",
    };
    const ics = serializeBurnRateIcs(data, { today: TODAY });
    const events = vevents(ics);

    expect(events).toHaveLength(12 + 1 + 1); // monthly x12 + yearly x1 + trial x1
    expect(ics).toContain("SUMMARY:Netflix renews");
    expect(ics).toContain("SUMMARY:Domain renews");
    expect(ics).toContain("SUMMARY:Linear trial ends");
  });

  it("includes a 1-day VALARM on every event", () => {
    const data: BurnRateData = {
      subscriptions: [makeSubscription()],
      trials: [makeTrial()],
      theme: "dark",
    };
    const ics = serializeBurnRateIcs(data, { today: TODAY });

    const alarmCount = (ics.match(/BEGIN:VALARM/g) ?? []).length;
    const valarmEnds = (ics.match(/END:VALARM/g) ?? []).length;
    expect(alarmCount).toBeGreaterThan(0);
    expect(alarmCount).toBe(valarmEnds);
    expect(ics).toContain("TRIGGER:-P1D");
    expect(ics).toContain("ACTION:DISPLAY");
  });

  it("escapes commas, semicolons, backslashes, and newlines in user text", () => {
    const data: BurnRateData = {
      subscriptions: [
        makeSubscription({
          id: "s",
          name: "Comma, Pizza; Slash\\Co",
          notes: "Line1\nLine2",
          nextBillingDate: "2026-02-01",
          billingCycle: "yearly",
        }),
      ],
      trials: [],
      theme: "dark",
    };
    const ics = serializeBurnRateIcs(data, { today: TODAY });

    expect(ics).toContain("Comma\\, Pizza\\; Slash\\\\Co");
    expect(ics).toContain("Line1\\nLine2");
  });

  it("folds lines that exceed 75 octets per RFC 5545", () => {
    const longName = "X".repeat(200);
    const data: BurnRateData = {
      subscriptions: [
        makeSubscription({ name: longName, nextBillingDate: "2026-02-01", billingCycle: "yearly" }),
      ],
      trials: [],
      theme: "dark",
    };
    const ics = serializeBurnRateIcs(data, { today: TODAY });
    const physicalLines = ics.split("\r\n");

    for (const line of physicalLines) {
      let octets = 0;
      for (let i = 0; i < line.length; i += 1) {
        const code = line.charCodeAt(i);
        octets += code < 0x80 ? 1 : code < 0x800 ? 2 : 3;
      }
      expect(octetLengthFor(line)).toBeLessThanOrEqual(75);
    }
    // Continuation lines start with a single space
    expect(physicalLines.some((line) => line.startsWith(" "))).toBe(true);
  });

  it("produces stable UIDs for repeat imports", () => {
    const data: BurnRateData = {
      subscriptions: [makeSubscription({ id: "stable", nextBillingDate: "2026-03-15", billingCycle: "yearly" })],
      trials: [],
      theme: "dark",
    };
    const first = serializeBurnRateIcs(data, { today: TODAY });
    const second = serializeBurnRateIcs(data, { today: TODAY });

    const firstUid = /UID:(stable-\d{8}@burnrate\.app)/.exec(first)?.[1];
    const secondUid = /UID:(stable-\d{8}@burnrate\.app)/.exec(second)?.[1];
    expect(firstUid).toBeDefined();
    expect(firstUid).toBe(secondUid);
  });

  it("honors a custom horizonDays option", () => {
    const data: BurnRateData = {
      subscriptions: [
        makeSubscription({ name: "Weekly", billingCycle: "weekly", nextBillingDate: "2026-01-18" }),
      ],
      trials: [],
      theme: "dark",
    };
    const ics = serializeBurnRateIcs(data, { today: TODAY, horizonDays: 30 });
    const events = vevents(ics);

    expect(events.length).toBeLessThanOrEqual(5);
    expect(events.length).toBeGreaterThanOrEqual(4);
  });
});

function octetLengthFor(line: string): number {
  let total = 0;
  for (let i = 0; i < line.length; i += 1) {
    const code = line.charCodeAt(i);
    total += code < 0x80 ? 1 : code < 0x800 ? 2 : 3;
  }
  return total;
}
