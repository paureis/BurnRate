import { describe, expect, it } from "vitest";
import {
  buildProfile,
  defaultProfile,
  normalizeOwners,
  normalizeProfiles,
  reassignOnProfileDelete,
  shareFor,
  splitMonthlyBurn,
  type Owners,
} from "../profiles";
import type { Subscription } from "../burnrate";
import { buildFxContext } from "../currency";

function makeSub(overrides: Partial<Subscription> & { owners?: Owners } = {}): Subscription {
  const sub: Subscription = {
    id: `sub-${Math.random().toString(36).slice(2)}`,
    name: "Netflix",
    costCents: 1500,
    billingCycle: "monthly",
    category: "entertainment",
    nextBillingDate: "2026-06-01",
    notes: "",
    createdAt: "2026-01-01T00:00:00.000Z",
    currency: "USD",
    ...overrides,
  };
  if (overrides.owners) {
    (sub as Subscription & { owners?: Owners }).owners = overrides.owners;
  }
  return sub;
}

describe("normalizeOwners", () => {
  it("falls back to 100% default when empty", () => {
    expect(normalizeOwners(undefined)).toEqual([{ profileId: "default", share: 1 }]);
    expect(normalizeOwners([])).toEqual([{ profileId: "default", share: 1 }]);
  });

  it("renormalizes 60/30 to 67/33 by share proportion", () => {
    const result = normalizeOwners([
      { profileId: "a", share: 0.6 },
      { profileId: "b", share: 0.3 },
    ]);
    expect(result[0].share).toBeCloseTo(0.667, 2);
    expect(result[1].share).toBeCloseTo(0.333, 2);
  });

  it("clamps negatives to 0 and >1 to 1, then renormalizes", () => {
    const result = normalizeOwners([
      { profileId: "a", share: -1 },
      { profileId: "b", share: 2 },
    ]);
    expect(result.find((e) => e.profileId === "a")?.share).toBe(0);
    expect(result.find((e) => e.profileId === "b")?.share).toBe(1);
  });

  it("even-splits when all valid shares sum to zero", () => {
    const result = normalizeOwners([
      { profileId: "a", share: 0 },
      { profileId: "b", share: 0 },
    ]);
    expect(result[0].share).toBeCloseTo(0.5, 3);
    expect(result[1].share).toBeCloseTo(0.5, 3);
  });
});

describe("shareFor", () => {
  it("100% to default when no owners are present", () => {
    const sub = makeSub();
    expect(shareFor(sub, "default")).toBe(1);
    expect(shareFor(sub, "other")).toBe(0);
  });

  it("sums duplicate entries", () => {
    const sub = makeSub({
      owners: [
        { profileId: "a", share: 0.2 },
        { profileId: "a", share: 0.3 },
        { profileId: "b", share: 0.5 },
      ],
    });
    expect(shareFor(sub, "a")).toBeCloseTo(0.5, 3);
  });
});

describe("splitMonthlyBurn", () => {
  it("attributes the full sub to default when no owners", () => {
    const subs = [makeSub({ costCents: 1500 })];
    const profiles = [defaultProfile()];
    const result = splitMonthlyBurn(subs, profiles, buildFxContext("USD", {}));
    expect(result.default).toBe(1500);
  });

  it("splits 50/50", () => {
    const subs = [makeSub({ costCents: 2000, owners: [{ profileId: "a", share: 0.5 }, { profileId: "b", share: 0.5 }] })];
    const profiles = [
      { ...defaultProfile(), id: "a", isDefault: true },
      { id: "b", name: "B", avatarColor: "#fff", createdAt: "2026-01-01" },
    ];
    const result = splitMonthlyBurn(subs, profiles, buildFxContext("USD", {}));
    expect(result.a).toBe(1000);
    expect(result.b).toBe(1000);
  });

  it("ignores profiles that aren't in the registry", () => {
    const subs = [makeSub({ costCents: 1500, owners: [{ profileId: "ghost", share: 1 }] })];
    const profiles = [defaultProfile()];
    const result = splitMonthlyBurn(subs, profiles, buildFxContext("USD", {}));
    expect(result.default).toBe(0);
  });
});

describe("reassignOnProfileDelete", () => {
  it("moves shares to the fallback profile", () => {
    const subs = [
      makeSub({ owners: [{ profileId: "a", share: 0.5 }, { profileId: "b", share: 0.5 }] }),
    ];
    const result = reassignOnProfileDelete(subs, "b", "a");
    const owners = (result[0] as Subscription & { owners?: Owners }).owners;
    expect(owners?.find((e) => e.profileId === "a")?.share).toBeCloseTo(1, 3);
    expect(owners?.find((e) => e.profileId === "b")).toBeUndefined();
  });
});

describe("buildProfile / defaultProfile", () => {
  it("buildProfile assigns id + createdAt", () => {
    const profile = buildProfile({ name: "Partner", avatarColor: "#aabbcc" });
    expect(profile.id).toMatch(/^prof-/);
    expect(profile.avatarColor).toBe("#aabbcc");
  });

  it("defaultProfile has isDefault=true and id 'default'", () => {
    const dp = defaultProfile();
    expect(dp.id).toBe("default");
    expect(dp.isDefault).toBe(true);
  });
});

describe("normalizeProfiles", () => {
  it("seeds the default profile when storage is empty", () => {
    expect(normalizeProfiles(undefined).length).toBe(1);
    expect(normalizeProfiles([]).length).toBe(1);
  });

  it("ensures one isDefault flag exists", () => {
    const stored = [{ id: "a", name: "A", avatarColor: "#aabbcc", createdAt: "2026-01-01T00:00:00.000Z" }];
    const result = normalizeProfiles(stored);
    expect(result[0].isDefault).toBe(true);
  });

  it("dedupes by id", () => {
    const stored = [
      { id: "a", name: "A", avatarColor: "#aabbcc", createdAt: "2026-01-01T00:00:00.000Z" },
      { id: "a", name: "A2", avatarColor: "#aabbcc", createdAt: "2026-01-02T00:00:00.000Z" },
    ];
    expect(normalizeProfiles(stored).length).toBe(1);
  });
});
