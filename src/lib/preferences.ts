import { DEFAULT_BASE_CURRENCY } from "./currency";
import { isSupportedCurrency } from "@/data/fx-rates";

export interface BurnRatePreferences {
  baseCurrency: string;
  fxOverrides: Record<string, number>;
  lastFxOverrideAt: string | null;
  // Auto-lock idle minutes (0 = never). Surfaced in Settings → Security.
  autoLockMinutes: number;
}

export const defaultPreferences: BurnRatePreferences = {
  baseCurrency: DEFAULT_BASE_CURRENCY,
  fxOverrides: {},
  lastFxOverrideAt: null,
  autoLockMinutes: 15,
};

export function normalizePreferences(value: unknown): BurnRatePreferences {
  if (!value || typeof value !== "object") {
    return { ...defaultPreferences };
  }
  const raw = value as Partial<BurnRatePreferences>;
  const baseCurrency =
    typeof raw.baseCurrency === "string" && isSupportedCurrency(raw.baseCurrency.toUpperCase())
      ? raw.baseCurrency.toUpperCase()
      : DEFAULT_BASE_CURRENCY;
  const fxOverrides: Record<string, number> = {};
  if (raw.fxOverrides && typeof raw.fxOverrides === "object") {
    for (const [code, value] of Object.entries(raw.fxOverrides as Record<string, unknown>)) {
      if (typeof value === "number" && Number.isFinite(value) && value > 0) {
        fxOverrides[code.toUpperCase()] = value;
      }
    }
  }
  return {
    baseCurrency,
    fxOverrides,
    lastFxOverrideAt: typeof raw.lastFxOverrideAt === "string" ? raw.lastFxOverrideAt : null,
    autoLockMinutes:
      typeof raw.autoLockMinutes === "number" && Number.isFinite(raw.autoLockMinutes) && raw.autoLockMinutes >= 0
        ? Math.min(raw.autoLockMinutes, 720)
        : defaultPreferences.autoLockMinutes,
  };
}
