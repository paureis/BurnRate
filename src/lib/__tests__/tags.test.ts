import { describe, expect, it } from "vitest";
import { collectAllTags, mergeTags, normalizeTag, tagsEqual } from "../tags";
import type { Subscription, Trial } from "../burnrate";

function makeSub(name: string, tags?: string[]): Subscription {
  return {
    id: `sub-${name}`,
    name,
    costCents: 1000,
    billingCycle: "monthly",
    category: "entertainment",
    nextBillingDate: "2026-06-01",
    notes: "",
    createdAt: "2026-01-01T00:00:00.000Z",
    ...(tags ? { tags } : {}),
  };
}

function makeTrial(name: string, tags?: string[]): Trial {
  return {
    id: `trial-${name}`,
    name,
    trialStartDate: "2026-06-01",
    trialEndDate: "2026-06-14",
    costAfterTrialCents: 999,
    remindMe: true,
    createdAt: "2026-01-01T00:00:00.000Z",
    ...(tags ? { tags } : {}),
  };
}

describe("normalizeTag", () => {
  it("lowercases and trims whitespace", () => {
    expect(normalizeTag("  Work  ")).toBe("work");
  });

  it("converts internal whitespace to dashes", () => {
    expect(normalizeTag("Side Hustle")).toBe("side-hustle");
  });

  it("rejects empty input", () => {
    expect(normalizeTag("")).toBeNull();
    expect(normalizeTag("   ")).toBeNull();
  });

  it("rejects tags over 20 characters", () => {
    expect(normalizeTag("a".repeat(21))).toBeNull();
  });

  it("rejects non-ASCII characters", () => {
    expect(normalizeTag("naïve")).toBeNull();
    expect(normalizeTag("emoji🔥")).toBeNull();
  });

  it("rejects punctuation other than hyphen", () => {
    expect(normalizeTag("foo_bar")).toBeNull();
    expect(normalizeTag("foo!bar")).toBeNull();
  });

  it("accepts hyphen-separated alphanumeric tags", () => {
    expect(normalizeTag("foo-bar-2")).toBe("foo-bar-2");
  });
});

describe("mergeTags", () => {
  it("dedupes case-insensitively", () => {
    expect(mergeTags(undefined, ["Work", "work", "WORK"])).toEqual(["work"]);
  });

  it("preserves existing order", () => {
    expect(mergeTags(["a", "b"], ["c"])).toEqual(["a", "b", "c"]);
  });

  it("caps the total at 10 tags", () => {
    const incoming = Array.from({ length: 20 }, (_, i) => `t${i}`);
    expect(mergeTags(undefined, incoming).length).toBe(10);
  });

  it("drops invalid candidates silently", () => {
    expect(mergeTags(undefined, ["good", "bad!", " ", "ok-2"])).toEqual(["good", "ok-2"]);
  });
});

describe("collectAllTags", () => {
  it("sorts and dedupes tags across subs and trials", () => {
    const subs = [makeSub("a", ["work", "couple"]), makeSub("b", ["work"])];
    const trials = [makeTrial("t1", ["fun"])];
    expect(collectAllTags(subs, trials)).toEqual(["couple", "fun", "work"]);
  });

  it("returns [] when no record has tags", () => {
    expect(collectAllTags([makeSub("a")], [makeTrial("t1")])).toEqual([]);
  });
});

describe("tagsEqual", () => {
  it("ignores order", () => {
    expect(tagsEqual(["a", "b"], ["b", "a"])).toBe(true);
  });

  it("treats undefined and empty as equal", () => {
    expect(tagsEqual(undefined, [])).toBe(true);
    expect(tagsEqual([], undefined)).toBe(true);
  });

  it("returns false on size mismatch", () => {
    expect(tagsEqual(["a"], ["a", "b"])).toBe(false);
  });
});
