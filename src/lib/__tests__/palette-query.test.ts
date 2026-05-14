import { describe, expect, it } from "vitest";
import { describeParsedQuery, hasActiveFilters, parsePaletteQuery } from "../palette-query";

describe("parsePaletteQuery", () => {
  it("returns free text when no operators present", () => {
    const parsed = parsePaletteQuery("netflix family");
    expect(parsed.freeText).toBe("netflix family");
    expect(hasActiveFilters(parsed)).toBe(false);
  });

  it("parses cost:> with no operator as min", () => {
    const parsed = parsePaletteQuery("cost:>20");
    expect(parsed.filters.costMinCents).toBe(2000);
    expect(parsed.freeText).toBe("");
  });

  it("parses cost:< and cost:<= as max", () => {
    const a = parsePaletteQuery("cost:<5");
    expect(a.filters.costMaxCents).toBe(500);
    const b = parsePaletteQuery("cost:<=15");
    expect(b.filters.costMaxCents).toBe(1500);
  });

  it("parses cost with decimals", () => {
    const parsed = parsePaletteQuery("cost:>9.99");
    expect(parsed.filters.costMinCents).toBe(999);
  });

  it("parses bare cost:N as equality (clamps both sides)", () => {
    const parsed = parsePaletteQuery("cost:5");
    expect(parsed.filters.costMinCents).toBe(500);
    expect(parsed.filters.costMaxCents).toBe(500);
  });

  it("parses cycle:yearly", () => {
    const parsed = parsePaletteQuery("cycle:yearly");
    expect(parsed.filters.cycles).toEqual(["yearly"]);
  });

  it("rejects malformed cycle and keeps it in freeText", () => {
    const parsed = parsePaletteQuery("cycle:bogus");
    expect(parsed.filters.cycles).toBeUndefined();
    expect(parsed.freeText).toBe("cycle:bogus");
  });

  it("treats repeated tag operators as AND (collected into the list)", () => {
    const parsed = parsePaletteQuery("tag:work tag:couple");
    expect(parsed.filters.tags).toEqual(["work", "couple"]);
  });

  it("treats repeated category operators as OR (collected into the list)", () => {
    const parsed = parsePaletteQuery("category:music category:productivity");
    expect(parsed.filters.categories).toEqual(["music", "productivity"]);
  });

  it("treats repeated currency operators as OR", () => {
    const parsed = parsePaletteQuery("currency:eur currency:gbp");
    expect(parsed.filters.currencies).toEqual(["EUR", "GBP"]);
  });

  it("rejects invalid currency codes", () => {
    const parsed = parsePaletteQuery("currency:usdx");
    expect(parsed.filters.currencies).toBeUndefined();
    expect(parsed.freeText).toBe("currency:usdx");
  });

  it("handles cancelling:", () => {
    const parsed = parsePaletteQuery("cancelling: netflix");
    expect(parsed.filters.cancellingOnly).toBe(true);
    expect(parsed.freeText).toBe("netflix");
  });

  it("handles trial:", () => {
    const parsed = parsePaletteQuery("trial:");
    expect(parsed.filters.trialsOnly).toBe(true);
  });

  it("preserves unknown operators in free text", () => {
    const parsed = parsePaletteQuery("foo:bar netflix");
    expect(parsed.freeText).toContain("foo:bar");
    expect(parsed.freeText).toContain("netflix");
  });

  it("mixes operators and free text", () => {
    const parsed = parsePaletteQuery("cost:>10 cycle:yearly tag:work netflix");
    expect(parsed.filters.costMinCents).toBe(1000);
    expect(parsed.filters.cycles).toEqual(["yearly"]);
    expect(parsed.filters.tags).toEqual(["work"]);
    expect(parsed.freeText).toBe("netflix");
  });

  it("malformed cost falls back to freeText", () => {
    const parsed = parsePaletteQuery("cost:abc");
    expect(parsed.filters.costMinCents).toBeUndefined();
    expect(parsed.freeText).toBe("cost:abc");
  });
});

describe("describeParsedQuery", () => {
  it("returns an empty string when no filters are active", () => {
    expect(describeParsedQuery({ freeText: "x", filters: {} })).toBe("");
  });

  it("summarizes active filters", () => {
    const parsed = parsePaletteQuery("cost:>10 cycle:yearly tag:work");
    const summary = describeParsedQuery(parsed);
    expect(summary).toContain("yearly");
    expect(summary).toContain("#work");
    expect(summary).toContain("$10");
  });
});
