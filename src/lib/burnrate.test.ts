import { describe, expect, it } from "vitest";
import {
  calculateBurnMetrics,
  calculateSimulatorImpact,
  formatCents,
  getPendingTrialAlerts,
  getTrialStatus,
  getUpcomingRenewals,
  parseBurnRateCsv,
  serializeBurnRateCsv,
  toCents,
  trialAlertKey,
  type BurnRateData,
  type Subscription,
  type Trial,
} from "./burnrate";

const today = new Date("2026-05-11T12:00:00-04:00");

const subscriptions: Subscription[] = [
  {
    id: "netflix",
    name: "Netflix",
    costCents: 2299,
    billingCycle: "monthly",
    category: "entertainment",
    nextBillingDate: "2026-05-14",
    notes: "Family plan",
    color: "#ff5a3d",
    icon: "tv",
    createdAt: "2026-05-01T10:00:00.000Z",
  },
  {
    id: "github",
    name: "GitHub",
    costCents: 4800,
    billingCycle: "yearly",
    category: "productivity",
    nextBillingDate: "2026-06-15",
    notes: "",
    color: "#37f29b",
    icon: "code",
    createdAt: "2026-02-01T10:00:00.000Z",
  },
  {
    id: "fitness",
    name: "Studio",
    costCents: 4200,
    billingCycle: "weekly",
    category: "fitness",
    nextBillingDate: "2026-05-18",
    notes: "",
    color: "#ffd166",
    icon: "dumbbell",
    createdAt: "2026-04-20T10:00:00.000Z",
  },
  {
    id: "cloud",
    name: "CloudBox",
    costCents: 3000,
    billingCycle: "quarterly",
    category: "cloud/storage",
    nextBillingDate: "2026-06-01",
    notes: "",
    color: "#7cc7ff",
    icon: "cloud",
    createdAt: "2026-01-10T10:00:00.000Z",
  },
];

const trials: Trial[] = [
  {
    id: "figma",
    name: "Figma",
    trialStartDate: "2026-05-01",
    trialEndDate: "2026-05-13",
    costAfterTrialCents: 1500,
    remindMe: true,
    createdAt: "2026-05-01T10:00:00.000Z",
  },
];

describe("money helpers", () => {
  it("stores money in cents and formats dollars consistently", () => {
    expect(toCents("19.995")).toBe(2000);
    expect(toCents("$1,234.5")).toBe(123450);
    expect(formatCents(123450)).toBe("$1,234.50");
  });
});

describe("burn metrics", () => {
  it("normalizes mixed billing cycles into monthly and yearly burn", () => {
    const metrics = calculateBurnMetrics(subscriptions, today);

    expect(metrics.monthlyBurnCents).toBe(21899);
    expect(metrics.yearlyBurnCents).toBe(262788);
    expect(metrics.categoryBreakdown).toEqual([
      { category: "fitness", monthlyCents: 18200, yearlyCents: 218400, percentage: 83.11 },
      { category: "entertainment", monthlyCents: 2299, yearlyCents: 27588, percentage: 10.5 },
      { category: "cloud/storage", monthlyCents: 1000, yearlyCents: 12000, percentage: 4.57 },
      { category: "productivity", monthlyCents: 400, yearlyCents: 4800, percentage: 1.83 },
    ]);
  });

  it("generates at least three data-specific insights", () => {
    const metrics = calculateBurnMetrics(subscriptions, today);

    expect(metrics.insights.length).toBeGreaterThanOrEqual(3);
    expect(metrics.insights.map((insight) => insight.kind)).toEqual(
      expect.arrayContaining([
        "category-share",
        "yearly-lock-in",
        "renewals-this-week",
        "cancel-largest",
      ]),
    );
  });
});

describe("renewals", () => {
  it("returns upcoming renewals sorted within 7 and 30 day windows", () => {
    const renewals = getUpcomingRenewals(subscriptions, today);

    expect(renewals.next7.map((renewal) => renewal.subscription.id)).toEqual(["netflix", "fitness"]);
    expect(renewals.next30.map((renewal) => renewal.subscription.id)).toEqual([
      "netflix",
      "fitness",
      "cloud",
    ]);
    expect(renewals.next7[0].daysUntil).toBe(3);
  });
});

describe("what-if simulator", () => {
  it("shows current, projected, and saved burn when subscriptions are toggled off", () => {
    const impact = calculateSimulatorImpact(subscriptions, new Set(["fitness", "netflix"]));

    expect(impact.currentMonthlyCents).toBe(21899);
    expect(impact.projectedMonthlyCents).toBe(1400);
    expect(impact.yearlySavingsCents).toBe(245988);
  });
});

describe("trial tracker", () => {
  it("marks trials expiring within three days as urgent", () => {
    expect(getTrialStatus(trials[0], today)).toEqual({
      daysRemaining: 2,
      status: "urgent",
      hasEnded: false,
    });
  });
});

describe("pending trial alerts", () => {
  const baseTrial: Trial = {
    id: "notion",
    name: "Notion AI",
    trialStartDate: "2026-05-01",
    trialEndDate: "2026-05-18",
    costAfterTrialCents: 2000,
    remindMe: true,
    createdAt: "2026-05-01T10:00:00.000Z",
  };

  it("emits the most urgent un-dismissed threshold per trial", () => {
    const sevenDay: Trial = { ...baseTrial, id: "seven", trialEndDate: "2026-05-18" };
    const threeDay: Trial = { ...baseTrial, id: "three", trialEndDate: "2026-05-14" };
    const oneDay: Trial = { ...baseTrial, id: "one", trialEndDate: "2026-05-12" };
    const dayOf: Trial = { ...baseTrial, id: "zero", trialEndDate: "2026-05-11" };

    const alerts = getPendingTrialAlerts([sevenDay, threeDay, oneDay, dayOf], {}, today);

    expect(alerts.map((a) => [a.trial.id, a.threshold, a.daysRemaining])).toEqual([
      ["zero", 1, 0],
      ["one", 1, 1],
      ["three", 3, 3],
      ["seven", 7, 7],
    ]);
  });

  it("skips trials when remindMe is false or trial has ended", () => {
    const muted: Trial = { ...baseTrial, id: "muted", remindMe: false, trialEndDate: "2026-05-12" };
    const ended: Trial = { ...baseTrial, id: "ended", trialEndDate: "2026-05-10" };

    expect(getPendingTrialAlerts([muted, ended], {}, today)).toEqual([]);
  });

  it("does not escalate to a less-urgent threshold once the current one is dismissed", () => {
    const trial: Trial = { ...baseTrial, id: "skip", trialEndDate: "2026-05-14" };
    const dismissed = { [trialAlertKey("skip", 3)]: true };

    expect(getPendingTrialAlerts([trial], dismissed, today)).toEqual([]);
  });

  it("still fires a more-urgent threshold after a less-urgent one was dismissed", () => {
    const trial: Trial = { ...baseTrial, id: "later", trialEndDate: "2026-05-13" };
    const dismissed = { [trialAlertKey("later", 7)]: true };

    const [alert] = getPendingTrialAlerts([trial], dismissed, today);

    expect(alert.threshold).toBe(3);
    expect(alert.daysRemaining).toBe(2);
  });
});

describe("CSV import and export", () => {
  it("round-trips subscriptions and trials without losing structured data", () => {
    const data: BurnRateData = {
      subscriptions,
      trials,
      theme: "dark",
    };

    const csv = serializeBurnRateCsv(data);
    const parsed = parseBurnRateCsv(csv);

    expect(parsed.subscriptions).toEqual(subscriptions);
    expect(parsed.trials).toEqual(trials);
    expect(parsed.theme).toBe("dark");
  });
});
