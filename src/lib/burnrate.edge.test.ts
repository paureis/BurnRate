import { describe, expect, it } from "vitest";
import {
  addDaysDateInputValue,
  billingCycles,
  calculateBurnMetrics,
  calculateSimulatorImpact,
  createId,
  defaultCategories,
  defaultCategoryColors,
  formatCents,
  getTrialStatus,
  getUpcomingRenewals,
  monthlyCostCents,
  parseBurnRateCsv,
  serializeBurnRateCsv,
  toCents,
  todayDateInputValue,
  yearlyCostCents,
  type BurnRateData,
  type Subscription,
  type Trial,
} from "./burnrate";

function makeSubscription(overrides: Partial<Subscription> = {}): Subscription {
  return {
    id: overrides.id ?? "sub-test",
    name: "Test",
    costCents: 1000,
    billingCycle: "monthly",
    category: "other",
    nextBillingDate: "2026-06-01",
    notes: "",
    color: "#ff5a3d",
    icon: "wallet",
    createdAt: "2026-05-01T00:00:00.000Z",
    ...overrides,
  };
}

function makeTrial(overrides: Partial<Trial> = {}): Trial {
  return {
    id: overrides.id ?? "trial-test",
    name: "Trial",
    trialStartDate: "2026-05-01",
    trialEndDate: "2026-05-20",
    costAfterTrialCents: 1500,
    remindMe: true,
    createdAt: "2026-05-01T00:00:00.000Z",
    ...overrides,
  };
}

const today = new Date("2026-05-11T12:00:00-04:00");

describe("toCents", () => {
  it("rounds halves up at the cent boundary", () => {
    expect(toCents("0.005")).toBe(1);
    expect(toCents("9.999")).toBe(1000);
  });

  it("handles number input directly", () => {
    expect(toCents(12.34)).toBe(1234);
    expect(toCents(0)).toBe(0);
    expect(toCents(0.1 + 0.2)).toBe(30); // floating-point safe
  });

  it("strips currency symbols, commas, and whitespace", () => {
    expect(toCents("$1,234.56")).toBe(123456);
    expect(toCents("   42.00 ")).toBe(4200);
    expect(toCents("$0.01")).toBe(1);
  });

  it("returns 0 for unparseable input", () => {
    expect(toCents("")).toBe(0);
    expect(toCents("abc")).toBe(0);
    expect(toCents("NaN")).toBe(0);
    expect(toCents("Infinity")).toBe(0);
  });

  it("parses leading-decimal forms", () => {
    expect(toCents(".5")).toBe(50);
    expect(toCents("$.99")).toBe(99);
  });

  it("handles negative values (treated as-is)", () => {
    expect(toCents("-5.00")).toBe(-500);
  });
});

describe("formatCents", () => {
  it("formats zero correctly", () => {
    expect(formatCents(0)).toBe("$0.00");
    expect(formatCents(0, true)).toBe("$0");
  });

  it("compact mode drops cents only when the value is whole dollars", () => {
    expect(formatCents(10000, true)).toBe("$100");
    expect(formatCents(10050, true)).toBe("$100.50");
    expect(formatCents(10001, true)).toBe("$100.01");
  });

  it("non-compact mode always shows two decimals", () => {
    expect(formatCents(99)).toBe("$0.99");
    expect(formatCents(100)).toBe("$1.00");
    expect(formatCents(123456789)).toBe("$1,234,567.89");
  });

  it("handles negative values", () => {
    expect(formatCents(-500)).toBe("-$5.00");
  });
});

describe("billing cycle math", () => {
  it("matches the documented multipliers", () => {
    const weekly = makeSubscription({ billingCycle: "weekly", costCents: 100 });
    const monthly = makeSubscription({ billingCycle: "monthly", costCents: 100 });
    const quarterly = makeSubscription({ billingCycle: "quarterly", costCents: 100 });
    const yearly = makeSubscription({ billingCycle: "yearly", costCents: 100 });

    expect(yearlyCostCents(weekly)).toBe(5200);
    expect(yearlyCostCents(monthly)).toBe(1200);
    expect(yearlyCostCents(quarterly)).toBe(400);
    expect(yearlyCostCents(yearly)).toBe(100);
  });

  it("monthly cost = yearly / 12 (rounded)", () => {
    const weekly = makeSubscription({ billingCycle: "weekly", costCents: 100 });
    expect(monthlyCostCents(weekly)).toBe(Math.round(5200 / 12));
  });

  it("handles zero-cost subscriptions", () => {
    const zero = makeSubscription({ costCents: 0, billingCycle: "monthly" });
    expect(yearlyCostCents(zero)).toBe(0);
    expect(monthlyCostCents(zero)).toBe(0);
  });

  it("covers every billing cycle declared in the BillingCycle union", () => {
    for (const cycle of billingCycles) {
      const sub = makeSubscription({ billingCycle: cycle, costCents: 1200 });
      expect(yearlyCostCents(sub)).toBeGreaterThan(0);
      expect(monthlyCostCents(sub)).toBeGreaterThan(0);
    }
  });
});

describe("calculateBurnMetrics with empty input", () => {
  it("returns zero burn and onboarding insights when no subscriptions exist", () => {
    const metrics = calculateBurnMetrics([], today);
    expect(metrics.monthlyBurnCents).toBe(0);
    expect(metrics.yearlyBurnCents).toBe(0);
    expect(metrics.categoryBreakdown).toEqual([]);
    expect(metrics.upcomingRenewals.next7).toEqual([]);
    expect(metrics.upcomingRenewals.next30).toEqual([]);
    expect(metrics.insights.length).toBe(3);
    expect(metrics.insights.every((i) => i.kind === "onboarding")).toBe(true);
  });
});

describe("category breakdown", () => {
  it("aggregates multiple subs in the same category", () => {
    const subs = [
      makeSubscription({ id: "a", category: "music", costCents: 1000, billingCycle: "monthly" }),
      makeSubscription({ id: "b", category: "music", costCents: 500, billingCycle: "monthly" }),
      makeSubscription({ id: "c", category: "entertainment", costCents: 2000, billingCycle: "monthly" }),
    ];
    const metrics = calculateBurnMetrics(subs, today);
    const music = metrics.categoryBreakdown.find((c) => c.category === "music");
    expect(music?.monthlyCents).toBe(1500);
    expect(music?.yearlyCents).toBe(18000);
  });

  it("sorts breakdown by monthlyCents desc, with category name as tiebreaker", () => {
    const subs = [
      makeSubscription({ id: "a", category: "alpha", costCents: 1000 }),
      makeSubscription({ id: "b", category: "beta", costCents: 1000 }),
      makeSubscription({ id: "c", category: "gamma", costCents: 5000 }),
    ];
    const metrics = calculateBurnMetrics(subs, today);
    expect(metrics.categoryBreakdown.map((c) => c.category)).toEqual(["gamma", "alpha", "beta"]);
  });

  it("percentages sum to ~100 when there is spending", () => {
    const subs = [
      makeSubscription({ id: "a", category: "x", costCents: 1000 }),
      makeSubscription({ id: "b", category: "y", costCents: 2000 }),
      makeSubscription({ id: "c", category: "z", costCents: 3000 }),
    ];
    const metrics = calculateBurnMetrics(subs, today);
    const sum = metrics.categoryBreakdown.reduce((s, c) => s + c.percentage, 0);
    expect(sum).toBeGreaterThan(99.9);
    expect(sum).toBeLessThan(100.1);
  });

  it("accepts custom user-defined categories", () => {
    const subs = [makeSubscription({ id: "a", category: "wine club" })];
    const metrics = calculateBurnMetrics(subs, today);
    expect(metrics.categoryBreakdown[0].category).toBe("wine club");
  });
});

describe("upcoming renewals window behavior", () => {
  const ref = new Date("2026-05-11T12:00:00-04:00");

  it("excludes past renewals and renewals more than 30 days out", () => {
    const subs = [
      makeSubscription({ id: "past", nextBillingDate: "2026-05-01" }),
      makeSubscription({ id: "today", nextBillingDate: "2026-05-11" }),
      makeSubscription({ id: "next-week", nextBillingDate: "2026-05-15" }),
      makeSubscription({ id: "edge-30", nextBillingDate: "2026-06-10" }), // exactly 30 days
      makeSubscription({ id: "edge-31", nextBillingDate: "2026-06-11" }), // 31 days, excluded
    ];
    const renewals = getUpcomingRenewals(subs, ref);
    expect(renewals.next30.map((r) => r.subscription.id)).toEqual([
      "today",
      "next-week",
      "edge-30",
    ]);
  });

  it("classifies renewals at the 7-day boundary correctly", () => {
    const subs = [
      makeSubscription({ id: "edge-7", nextBillingDate: "2026-05-18" }),
      makeSubscription({ id: "edge-8", nextBillingDate: "2026-05-19" }),
    ];
    const renewals = getUpcomingRenewals(subs, ref);
    expect(renewals.next7.map((r) => r.subscription.id)).toEqual(["edge-7"]);
    expect(renewals.next30.map((r) => r.subscription.id)).toEqual(["edge-7", "edge-8"]);
  });

  it("ties broken by alphabetical name", () => {
    const subs = [
      makeSubscription({ id: "z", name: "Zebra", nextBillingDate: "2026-05-15" }),
      makeSubscription({ id: "a", name: "Apple", nextBillingDate: "2026-05-15" }),
    ];
    const renewals = getUpcomingRenewals(subs, ref);
    expect(renewals.next30.map((r) => r.subscription.name)).toEqual(["Apple", "Zebra"]);
  });
});

describe("simulator math", () => {
  it("returns zero savings when nothing is disabled", () => {
    const subs = [
      makeSubscription({ id: "a", costCents: 1000 }),
      makeSubscription({ id: "b", costCents: 2000 }),
    ];
    const impact = calculateSimulatorImpact(subs, new Set());
    expect(impact.currentMonthlyCents).toBe(impact.projectedMonthlyCents);
    expect(impact.monthlySavingsCents).toBe(0);
    expect(impact.yearlySavingsCents).toBe(0);
  });

  it("returns full savings when everything is disabled", () => {
    const subs = [
      makeSubscription({ id: "a", costCents: 1000 }),
      makeSubscription({ id: "b", costCents: 2000 }),
    ];
    const impact = calculateSimulatorImpact(subs, new Set(["a", "b"]));
    expect(impact.projectedMonthlyCents).toBe(0);
    expect(impact.projectedYearlyCents).toBe(0);
    expect(impact.monthlySavingsCents).toBe(impact.currentMonthlyCents);
    expect(impact.yearlySavingsCents).toBe(impact.currentYearlyCents);
  });

  it("savings are never negative", () => {
    const impact = calculateSimulatorImpact([], new Set(["ghost-id"]));
    expect(impact.monthlySavingsCents).toBe(0);
    expect(impact.yearlySavingsCents).toBe(0);
  });

  it("disabledIds that don't match subscriptions are no-ops", () => {
    const subs = [makeSubscription({ id: "a", costCents: 1000 })];
    const impact = calculateSimulatorImpact(subs, new Set(["nonexistent"]));
    expect(impact.projectedMonthlyCents).toBe(impact.currentMonthlyCents);
  });
});

describe("getTrialStatus", () => {
  const ref = new Date("2026-05-11T12:00:00-04:00");

  it("classifies a trial ending today as urgent (0 days remaining)", () => {
    const trial = makeTrial({ trialEndDate: "2026-05-11" });
    const status = getTrialStatus(trial, ref);
    expect(status.daysRemaining).toBe(0);
    expect(status.status).toBe("urgent");
    expect(status.hasEnded).toBe(false);
  });

  it("classifies trials ending 1-3 days from now as urgent", () => {
    expect(getTrialStatus(makeTrial({ trialEndDate: "2026-05-12" }), ref).status).toBe("urgent");
    expect(getTrialStatus(makeTrial({ trialEndDate: "2026-05-14" }), ref).status).toBe("urgent");
  });

  it("classifies trials ending 4-7 days from now as soon", () => {
    expect(getTrialStatus(makeTrial({ trialEndDate: "2026-05-15" }), ref).status).toBe("soon");
    expect(getTrialStatus(makeTrial({ trialEndDate: "2026-05-18" }), ref).status).toBe("soon");
  });

  it("classifies trials ending more than 7 days from now as active", () => {
    expect(getTrialStatus(makeTrial({ trialEndDate: "2026-05-19" }), ref).status).toBe("active");
    expect(getTrialStatus(makeTrial({ trialEndDate: "2027-01-01" }), ref).status).toBe("active");
  });

  it("classifies past trials as ended", () => {
    const trial = makeTrial({ trialEndDate: "2026-05-10" });
    const status = getTrialStatus(trial, ref);
    expect(status.hasEnded).toBe(true);
    expect(status.status).toBe("ended");
    expect(status.daysRemaining).toBeLessThan(0);
  });
});

describe("CSV serialization and parsing", () => {
  it("round-trips notes containing commas, quotes, and newlines", () => {
    const data: BurnRateData = {
      subscriptions: [
        makeSubscription({
          id: "tricky",
          name: 'Spotify "Premium"',
          notes: "Has, commas\nand newlines\rand carriage returns",
        }),
      ],
      trials: [],
      theme: "dark",
    };
    const csv = serializeBurnRateCsv(data);
    const parsed = parseBurnRateCsv(csv);
    expect(parsed.subscriptions[0].name).toBe('Spotify "Premium"');
    expect(parsed.subscriptions[0].notes).toBe("Has, commas\nand newlines\rand carriage returns");
  });

  it("escapes a field that contains a double-quote into doubled double-quotes", () => {
    const data: BurnRateData = {
      subscriptions: [makeSubscription({ name: 'Foo "Bar" Baz', notes: 'has "quotes"' })],
      trials: [],
      theme: "dark",
    };
    const csv = serializeBurnRateCsv(data);
    expect(csv).toContain('"Foo ""Bar"" Baz"');
    expect(csv).toContain('"has ""quotes"""');
  });

  it("preserves theme through round-trip (light and dark)", () => {
    for (const theme of ["light", "dark"] as const) {
      const data: BurnRateData = { subscriptions: [], trials: [], theme };
      expect(parseBurnRateCsv(serializeBurnRateCsv(data)).theme).toBe(theme);
    }
  });

  it("returns empty data when CSV has fewer than 2 rows", () => {
    expect(parseBurnRateCsv("")).toEqual({ subscriptions: [], trials: [], theme: "dark" });
    expect(parseBurnRateCsv("only,headers,here")).toEqual({
      subscriptions: [],
      trials: [],
      theme: "dark",
    });
  });

  it("falls back to defaults for malformed billing cycle and cost values", () => {
    const csv = [
      "recordType,id,name,costCents,billingCycle,category,nextBillingDate,notes,color,icon,createdAt,trialStartDate,trialEndDate,costAfterTrialCents,remindMe,theme",
      "subscription,bad-1,Garbage,not-a-number,not-a-cycle,,,,,,2026-05-01T00:00:00.000Z,,,,,",
    ].join("\n");
    const parsed = parseBurnRateCsv(csv);
    expect(parsed.subscriptions[0].costCents).toBe(0);
    expect(parsed.subscriptions[0].billingCycle).toBe("monthly");
    expect(parsed.subscriptions[0].category).toBe("other");
  });

  it("treats remindMe='true' as boolean true and anything else as false", () => {
    const csv = [
      "recordType,id,name,costCents,billingCycle,category,nextBillingDate,notes,color,icon,createdAt,trialStartDate,trialEndDate,costAfterTrialCents,remindMe,theme",
      "trial,t-1,Yes,,,,,,,,2026-05-01T00:00:00.000Z,2026-05-01,2026-05-20,1500,true,",
      "trial,t-2,No,,,,,,,,2026-05-01T00:00:00.000Z,2026-05-01,2026-05-20,1500,false,",
      "trial,t-3,Junk,,,,,,,,2026-05-01T00:00:00.000Z,2026-05-01,2026-05-20,1500,maybe,",
    ].join("\n");
    const parsed = parseBurnRateCsv(csv);
    expect(parsed.trials.map((t) => t.remindMe)).toEqual([true, false, false]);
  });

  it("accepts CRLF line endings", () => {
    const data: BurnRateData = {
      subscriptions: [makeSubscription({ id: "crlf" })],
      trials: [],
      theme: "dark",
    };
    const csv = serializeBurnRateCsv(data).replace(/\n/g, "\r\n");
    const parsed = parseBurnRateCsv(csv);
    expect(parsed.subscriptions).toHaveLength(1);
    expect(parsed.subscriptions[0].id).toBe("crlf");
  });
});

describe("createId", () => {
  it("includes the prefix and produces non-colliding ids in tight loops", () => {
    const ids = new Set<string>();
    for (let i = 0; i < 200; i += 1) {
      ids.add(createId("sub"));
    }
    expect(ids.size).toBe(200);
    for (const id of ids) {
      expect(id.startsWith("sub-")).toBe(true);
    }
  });
});

describe("todayDateInputValue / addDaysDateInputValue", () => {
  it("produces YYYY-MM-DD format", () => {
    const value = todayDateInputValue(new Date("2026-01-05T12:00:00"));
    expect(value).toBe("2026-01-05");
  });

  it("addDays handles positive, zero, and negative offsets", () => {
    const ref = new Date("2026-05-11T12:00:00");
    expect(addDaysDateInputValue(0, ref)).toBe("2026-05-11");
    expect(addDaysDateInputValue(14, ref)).toBe("2026-05-25");
    expect(addDaysDateInputValue(-1, ref)).toBe("2026-05-10");
  });

  it("crosses month and year boundaries cleanly", () => {
    expect(addDaysDateInputValue(1, new Date("2026-01-31T12:00:00"))).toBe("2026-02-01");
    expect(addDaysDateInputValue(1, new Date("2026-12-31T12:00:00"))).toBe("2027-01-01");
  });
});

describe("default categories metadata", () => {
  it("every default category has a color assigned", () => {
    for (const category of defaultCategories) {
      expect(defaultCategoryColors[category]).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });
});

describe("insights generation", () => {
  it("marks largest-category as warning when share is >= 50%", () => {
    const subs = [
      makeSubscription({ id: "a", category: "music", costCents: 9000, billingCycle: "monthly" }),
      makeSubscription({ id: "b", category: "other", costCents: 100, billingCycle: "monthly" }),
    ];
    const metrics = calculateBurnMetrics(subs, today);
    const top = metrics.insights.find((i) => i.kind === "category-share");
    expect(top?.tone).toBe("warning");
  });

  it("emits 'no new subscriptions' wording when nothing recent", () => {
    const subs = [
      makeSubscription({
        id: "a",
        createdAt: "2020-01-01T00:00:00.000Z",
        nextBillingDate: "2099-01-01",
      }),
    ];
    const metrics = calculateBurnMetrics(subs, today);
    const insight = metrics.insights.find((i) => i.kind === "new-last-30");
    expect(insight?.detail.toLowerCase()).toContain("no new subscriptions");
  });

  it("picks the most-expensive subscription by yearly cost (not nominal cost)", () => {
    const subs = [
      makeSubscription({
        id: "yearly-cheap",
        name: "YearlyCheap",
        costCents: 12000,
        billingCycle: "yearly",
      }),
      makeSubscription({
        id: "weekly-pricey",
        name: "WeeklyPricey",
        costCents: 500,
        billingCycle: "weekly",
      }),
    ];
    const metrics = calculateBurnMetrics(subs, today);
    const cancel = metrics.insights.find((i) => i.kind === "cancel-largest");
    expect(cancel?.title).toContain("WeeklyPricey");
  });
});
