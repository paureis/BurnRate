import { describe, it, expect } from "vitest";
import { collapseDuplicates, parseChargesText } from "../charges";

describe("parseChargesText", () => {
  it("returns nothing for empty input", () => {
    expect(parseChargesText("")).toEqual([]);
  });

  it("parses a single dollar amount", () => {
    const result = parseChargesText("NETFLIX.COM $15.99");
    expect(result).toHaveLength(1);
    expect(result[0].amountCents).toBe(1599);
    expect(result[0].currency).toBe("USD");
    expect(result[0].vendorGuess.toLowerCase()).toContain("netflix");
  });

  it("parses euro with comma decimal", () => {
    const result = parseChargesText("Spotify Premium €9,99");
    expect(result).toHaveLength(1);
    expect(result[0].currency).toBe("EUR");
    expect(result[0].amountCents).toBe(999);
  });

  it("parses pounds", () => {
    const result = parseChargesText("Disney Plus £8.99");
    expect(result[0].currency).toBe("GBP");
    expect(result[0].amountCents).toBe(899);
  });

  it("parses Brazilian real with R$ prefix and comma decimal", () => {
    const result = parseChargesText("Netflix R$ 39,90");
    expect(result[0].currency).toBe("BRL");
    expect(result[0].amountCents).toBe(3990);
  });

  it("parses zero-decimal currency (JPY)", () => {
    const result = parseChargesText("JPY 1200 Apple Music");
    expect(result[0].currency).toBe("JPY");
    expect(result[0].amountCents).toBe(1200);
  });

  it("parses three-letter currency code after the amount", () => {
    const result = parseChargesText("Notion 10.00 USD recurring charge");
    expect(result[0].currency).toBe("USD");
    expect(result[0].amountCents).toBe(1000);
    expect(result[0].vendorGuess.toLowerCase()).toContain("notion");
  });

  it("detects ISO dates", () => {
    const result = parseChargesText("2026-05-01 Netflix $15.99");
    expect(result[0].dateGuess).toBe("2026-05-01");
  });

  it("detects slash dates", () => {
    const result = parseChargesText("05/01/2026 Netflix $15.99");
    expect(result[0].dateGuess).toBe("2026-05-01");
  });

  it("strips noisy bank-statement tokens", () => {
    const result = parseChargesText("POS DEBIT NETFLIX.COM *6712 $15.99");
    expect(result[0].vendorGuess.toLowerCase()).toContain("netflix");
    expect(result[0].vendorGuess.toLowerCase()).not.toContain("debit");
  });

  it("ignores lines without a parseable amount", () => {
    const text = `Header line\nNo amount here\nNetflix $15.99\n\nAnother junk line`;
    expect(parseChargesText(text)).toHaveLength(1);
  });

  it("parses multiple lines", () => {
    const text = `Netflix $15.99\nSpotify $11.99\nHulu $9.99`;
    expect(parseChargesText(text)).toHaveLength(3);
  });

  it("ignores zero amounts", () => {
    expect(parseChargesText("Random $0.00")).toEqual([]);
  });

  it("filters lines that resolve to empty vendor text", () => {
    expect(parseChargesText("$15.99")).toEqual([]);
  });
});

describe("collapseDuplicates", () => {
  it("returns input shape when no duplicates", () => {
    const parsed = parseChargesText("Netflix $15.99\nHulu $9.99");
    const collapsed = collapseDuplicates(parsed);
    expect(collapsed).toHaveLength(2);
    for (const row of collapsed) {
      expect(row.occurrences).toBe(1);
    }
  });

  it("collapses duplicate vendors into one row with count", () => {
    const parsed = parseChargesText("Netflix $15.99\nNetflix $15.99\nNetflix $15.99");
    const collapsed = collapseDuplicates(parsed);
    expect(collapsed).toHaveLength(1);
    expect(collapsed[0].occurrences).toBe(3);
  });

  it("keeps the most recent date when collapsing", () => {
    const parsed = parseChargesText("2026-03-01 Netflix $15.99\n2026-05-01 Netflix $15.99");
    const collapsed = collapseDuplicates(parsed);
    expect(collapsed[0].dateGuess).toBe("2026-05-01");
  });
});
