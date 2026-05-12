// FX rates bundled with the app. Units of <currency> per 1 USD.
// Snapshot date documented below. Users can override individual rates from Settings.
// No live FX API is called — we accept that bundled rates drift over time.

export const FX_SNAPSHOT_DATE = "2026-05-01";

export const supportedCurrencies = [
  "USD",
  "EUR",
  "GBP",
  "JPY",
  "CAD",
  "AUD",
  "BRL",
  "MXN",
  "INR",
  "CHF",
  "SEK",
  "NOK",
  "DKK",
  "PLN",
  "CZK",
  "HUF",
  "TRY",
  "ZAR",
  "KRW",
  "SGD",
  "HKD",
  "NZD",
] as const;

export type SupportedCurrency = (typeof supportedCurrencies)[number];

export type FxTable = Record<string, number>;

// Units per 1 USD. USD is the reference rate (1.0).
export const bundledFxRates: FxTable = {
  USD: 1,
  EUR: 0.93,
  GBP: 0.79,
  JPY: 152.4,
  CAD: 1.36,
  AUD: 1.51,
  BRL: 5.12,
  MXN: 17.05,
  INR: 83.4,
  CHF: 0.9,
  SEK: 10.6,
  NOK: 10.85,
  DKK: 6.92,
  PLN: 4.03,
  CZK: 23.1,
  HUF: 360.0,
  TRY: 32.2,
  ZAR: 18.7,
  KRW: 1370,
  SGD: 1.35,
  HKD: 7.83,
  NZD: 1.66,
};

export function isSupportedCurrency(value: string): value is SupportedCurrency {
  return (supportedCurrencies as readonly string[]).includes(value);
}

export function currencyLabel(code: string): string {
  return code.toUpperCase();
}
