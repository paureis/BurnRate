import { describe, it, expect } from "vitest";
import { bundledFxRates } from "@/data/fx-rates";
import {
  buildFxContext,
  convertCents,
  convertToBase,
  formatMoney,
  getCurrencyFractionDigits,
  mergeFxRates,
} from "./currency";

describe("convertCents", () => {
  it("returns the input unchanged when currencies match", () => {
    expect(convertCents(1999, "USD", "USD", bundledFxRates)).toBe(1999);
  });

  it("converts USD to EUR using bundled rates", () => {
    // 100 USD -> 93 EUR (rate 0.93)
    expect(convertCents(10000, "USD", "EUR", bundledFxRates)).toBe(9300);
  });

  it("converts EUR back to USD with round-trip tolerance", () => {
    const eur = convertCents(10000, "USD", "EUR", bundledFxRates);
    const usd = convertCents(eur, "EUR", "USD", bundledFxRates);
    expect(Math.abs(usd - 10000)).toBeLessThanOrEqual(1);
  });

  it("handles zero-decimal currencies (JPY)", () => {
    // 100 USD -> 15240 JPY (rate 152.4; JPY has 0 fraction digits)
    expect(convertCents(10000, "USD", "JPY", bundledFxRates)).toBe(15240);
  });

  it("throws on an unknown currency", () => {
    expect(() => convertCents(100, "USD", "ZZZ", bundledFxRates)).toThrow();
  });

  it("returns zero when amount is zero", () => {
    expect(convertCents(0, "USD", "EUR", bundledFxRates)).toBe(0);
  });
});

describe("formatMoney", () => {
  it("formats USD in en-US", () => {
    expect(formatMoney(1599, "USD", "en-US")).toMatch(/\$15\.99/);
  });

  it("formats EUR in de-DE", () => {
    expect(formatMoney(1999, "EUR", "de-DE")).toMatch(/19,99/);
  });

  it("formats JPY without decimals", () => {
    expect(formatMoney(12000, "JPY", "en-US")).toMatch(/12,000/);
    expect(formatMoney(12000, "JPY", "en-US")).not.toContain(".");
  });

  it("formats BRL in pt-BR with a comma decimal", () => {
    expect(formatMoney(3990, "BRL", "pt-BR")).toMatch(/39,90/);
  });
});

describe("fraction digits", () => {
  it("returns 0 for JPY and KRW", () => {
    expect(getCurrencyFractionDigits("JPY")).toBe(0);
    expect(getCurrencyFractionDigits("KRW")).toBe(0);
  });

  it("returns 2 for USD/EUR/GBP", () => {
    expect(getCurrencyFractionDigits("USD")).toBe(2);
    expect(getCurrencyFractionDigits("EUR")).toBe(2);
    expect(getCurrencyFractionDigits("GBP")).toBe(2);
  });
});

describe("FxContext", () => {
  it("merges overrides over bundled rates", () => {
    const merged = mergeFxRates({ EUR: 0.95 });
    expect(merged.EUR).toBe(0.95);
    expect(merged.USD).toBe(1);
  });

  it("buildFxContext defaults to USD when no base provided", () => {
    const ctx = buildFxContext("");
    expect(ctx.baseCurrency).toBe("USD");
  });

  it("convertToBase reduces to identity when sub currency equals base", () => {
    const ctx = buildFxContext("USD");
    expect(convertToBase(1500, "USD", ctx)).toBe(1500);
  });
});
