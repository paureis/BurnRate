import { bundledFxRates, type FxTable } from "@/data/fx-rates";

export interface FxContext {
  baseCurrency: string;
  rates: FxTable;
}

export const DEFAULT_BASE_CURRENCY = "USD";

// Zero-decimal currencies per ISO 4217 — values are not subdivided into 1/100 units.
const ZERO_DECIMAL_CURRENCIES = new Set([
  "BIF",
  "CLP",
  "DJF",
  "GNF",
  "ISK",
  "JPY",
  "KMF",
  "KRW",
  "PYG",
  "RWF",
  "UGX",
  "UYI",
  "VND",
  "VUV",
  "XAF",
  "XOF",
  "XPF",
]);

export function getCurrencyFractionDigits(currency: string): number {
  return ZERO_DECIMAL_CURRENCIES.has(currency.toUpperCase()) ? 0 : 2;
}

export function mergeFxRates(overrides: FxTable | undefined | null): FxTable {
  if (!overrides) {
    return { ...bundledFxRates };
  }
  return { ...bundledFxRates, ...overrides };
}

export function buildFxContext(baseCurrency: string, overrides?: FxTable | null): FxContext {
  return { baseCurrency: baseCurrency || DEFAULT_BASE_CURRENCY, rates: mergeFxRates(overrides ?? null) };
}

// Converts a cents amount in `from` currency to cents in `to` currency.
// Both inputs and outputs use the same "smallest unit" semantics, but the
// per-currency fraction digits differ (e.g., JPY has 0). When converting
// between mismatched fraction digits, we re-scale.
export function convertCents(amountCents: number, from: string, to: string, fx: FxTable): number {
  const fromKey = from.toUpperCase();
  const toKey = to.toUpperCase();

  if (fromKey === toKey) {
    return amountCents;
  }

  const fromRate = fx[fromKey];
  const toRate = fx[toKey];
  if (typeof fromRate !== "number" || typeof toRate !== "number" || fromRate <= 0 || toRate <= 0) {
    throw new Error(`Missing FX rate for ${fromKey} or ${toKey}`);
  }

  const fromDigits = getCurrencyFractionDigits(fromKey);
  const toDigits = getCurrencyFractionDigits(toKey);
  const fromUnits = amountCents / Math.pow(10, fromDigits);
  // (USD-per-from) * fromUnits = USD units
  const usdUnits = fromUnits / fromRate;
  const toUnits = usdUnits * toRate;
  return Math.round(toUnits * Math.pow(10, toDigits));
}

export function convertToBase(amountCents: number, from: string, fx: FxContext): number {
  return convertCents(amountCents, from, fx.baseCurrency, fx.rates);
}

const formatterCache = new Map<string, Intl.NumberFormat>();

function getFormatter(currency: string, locale: string | undefined, compact: boolean): Intl.NumberFormat {
  const key = `${locale ?? "auto"}:${currency}:${compact}`;
  const cached = formatterCache.get(key);
  if (cached) {
    return cached;
  }
  const digits = getCurrencyFractionDigits(currency);
  const formatter = new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    minimumFractionDigits: compact ? 0 : digits,
    maximumFractionDigits: digits,
  });
  formatterCache.set(key, formatter);
  return formatter;
}

export function formatMoney(cents: number, currency: string, locale?: string, compact = false): string {
  const code = currency.toUpperCase();
  const digits = getCurrencyFractionDigits(code);
  const amount = cents / Math.pow(10, digits);
  return getFormatter(code, locale, compact).format(amount);
}

// Apply a percentage adjustment to base-cents while staying in the same currency.
export function scaleCents(cents: number, factor: number): number {
  return Math.round(cents * factor);
}
