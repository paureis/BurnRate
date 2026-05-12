// Paste-charges parser. Pure regex/string work — no library, no network.
// Detects: amounts (with currency symbol or 3-letter code), optional dates,
// best-effort vendor extraction. De-noises common bank-statement junk like
// "POS", "DEBIT", trailing transaction IDs.

export interface ParsedCharge {
  rawLine: string;
  amountCents: number;
  currency: string;
  vendorGuess: string;
  dateGuess?: string;
}

const SYMBOL_TO_CURRENCY: Record<string, string> = {
  "$": "USD",
  "€": "EUR",
  "£": "GBP",
  "¥": "JPY",
  "₹": "INR",
  "₩": "KRW",
  "₺": "TRY",
  "R$": "BRL",
};

const NOISE_WORDS = new Set([
  "POS",
  "DEBIT",
  "CREDIT",
  "PAYMENT",
  "RECURRING",
  "TXN",
  "PURCHASE",
  "AUTOPAY",
  "WEB",
  "ONLINE",
  "PENDING",
  "ACH",
  "VISA",
  "MASTERCARD",
  "AMEX",
  "MONTHLY",
  "ANNUAL",
  "SUBSCRIPTION",
  "SUB",
]);

const MONTH_NAMES = [
  "jan",
  "feb",
  "mar",
  "apr",
  "may",
  "jun",
  "jul",
  "aug",
  "sep",
  "oct",
  "nov",
  "dec",
];

interface AmountMatch {
  amountCents: number;
  currency: string;
  startIndex: number;
  endIndex: number;
}

// Matches numbers with optional thousand separators and optional decimal:
// "1200", "12.99", "9,999.00", "9.999,99", "120.50".
const NUMBER_BODY = "\\d+(?:[\\.,]\\d+)*";

function detectAmount(line: string, defaultCurrency: string): AmountMatch | null {
  // 1) Symbol followed by digits, e.g., $12.99 / €12,99 / R$ 12,99 / ¥1200
  const symbolPattern = new RegExp(`(R\\$|[\\$€£¥₹₩₺])\\s*(${NUMBER_BODY})`, "i");
  const symbolMatch = symbolPattern.exec(line);
  if (symbolMatch) {
    const currency = SYMBOL_TO_CURRENCY[symbolMatch[1].toUpperCase() === "R$" ? "R$" : symbolMatch[1]] ?? defaultCurrency;
    const cents = numberToCents(symbolMatch[2], currency);
    if (cents > 0) {
      return {
        amountCents: cents,
        currency,
        startIndex: symbolMatch.index,
        endIndex: symbolMatch.index + symbolMatch[0].length,
      };
    }
  }

  // 2) Number followed by/preceded by 3-letter code (USD/EUR/GBP/etc.)
  const codePattern = new RegExp(
    `(?:([A-Z]{3})\\s+(${NUMBER_BODY}))|(?:(${NUMBER_BODY})\\s+([A-Z]{3}))`,
  );
  const codeMatch = codePattern.exec(line);
  if (codeMatch) {
    const currency = (codeMatch[1] ?? codeMatch[4] ?? defaultCurrency).toUpperCase();
    const numeric = codeMatch[2] ?? codeMatch[3] ?? "";
    const cents = numberToCents(numeric, currency);
    if (cents > 0) {
      return {
        amountCents: cents,
        currency,
        startIndex: codeMatch.index,
        endIndex: codeMatch.index + codeMatch[0].length,
      };
    }
  }

  return null;
}

function numberToCents(raw: string, currency: string): number {
  if (!raw) return 0;
  const isZeroDecimal = ["JPY", "KRW"].includes(currency.toUpperCase());
  // Heuristic: if both "." and "," are present, the rightmost is the decimal separator.
  // If only "," is present and it's followed by 1-2 digits, treat as decimal.
  let normalized = raw.replace(/\s/g, "");
  const hasDot = normalized.includes(".");
  const hasComma = normalized.includes(",");
  if (hasDot && hasComma) {
    if (normalized.lastIndexOf(",") > normalized.lastIndexOf(".")) {
      normalized = normalized.replace(/\./g, "").replace(",", ".");
    } else {
      normalized = normalized.replace(/,/g, "");
    }
  } else if (hasComma && /,\d{1,2}$/.test(normalized)) {
    normalized = normalized.replace(/\./g, "").replace(",", ".");
  } else {
    normalized = normalized.replace(/,/g, "");
  }
  const parsed = Number.parseFloat(normalized);
  if (!Number.isFinite(parsed) || parsed <= 0) return 0;
  const multiplier = isZeroDecimal ? 1 : 100;
  return Math.round(parsed * multiplier);
}

function detectDate(line: string): { dateIso: string; startIndex: number; endIndex: number } | null {
  // YYYY-MM-DD
  const iso = /(\d{4})-(\d{2})-(\d{2})/.exec(line);
  if (iso) {
    return { dateIso: `${iso[1]}-${iso[2]}-${iso[3]}`, startIndex: iso.index, endIndex: iso.index + iso[0].length };
  }
  // MM/DD/YYYY or MM/DD/YY
  const slash = /(\d{1,2})\/(\d{1,2})\/(\d{2,4})/.exec(line);
  if (slash) {
    const yearRaw = slash[3];
    const year = yearRaw.length === 2 ? Number(`20${yearRaw}`) : Number(yearRaw);
    const month = String(Number(slash[1])).padStart(2, "0");
    const day = String(Number(slash[2])).padStart(2, "0");
    if (year >= 2000 && Number(month) <= 12 && Number(day) <= 31) {
      return { dateIso: `${year}-${month}-${day}`, startIndex: slash.index, endIndex: slash.index + slash[0].length };
    }
  }
  // Month name DD, YYYY or DD Month YYYY
  const monthName = /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\.?\s+(\d{1,2})(?:,\s*(\d{2,4}))?/i.exec(line);
  if (monthName) {
    const monthIdx = MONTH_NAMES.findIndex((value) => monthName[1].toLowerCase().startsWith(value));
    if (monthIdx >= 0) {
      const year = monthName[3]
        ? monthName[3].length === 2
          ? Number(`20${monthName[3]}`)
          : Number(monthName[3])
        : new Date().getFullYear();
      const day = String(Number(monthName[2])).padStart(2, "0");
      return {
        dateIso: `${year}-${String(monthIdx + 1).padStart(2, "0")}-${day}`,
        startIndex: monthName.index,
        endIndex: monthName.index + monthName[0].length,
      };
    }
  }
  return null;
}

function extractVendor(
  line: string,
  amount: AmountMatch,
  date: { startIndex: number; endIndex: number } | null,
): string {
  // Carve out the amount + date regions; the rest is candidate vendor text.
  const ranges = [{ start: amount.startIndex, end: amount.endIndex }];
  if (date) ranges.push({ start: date.startIndex, end: date.endIndex });
  ranges.sort((a, b) => a.start - b.start);

  let stripped = "";
  let cursor = 0;
  for (const range of ranges) {
    stripped += line.slice(cursor, range.start);
    cursor = range.end;
  }
  stripped += line.slice(cursor);

  // Remove trailing transaction IDs and noisy tokens.
  let vendor = stripped
    .replace(/\b[A-Z0-9]{8,}\b/g, " ") // long uppercase/numeric tokens
    .replace(/[#*]\d+\b/g, " ") // *1234 / #1234
    .replace(/\b\d{4,}\b/g, " ") // bare long digit runs
    .replace(/[^\p{L}\p{N}&\- ]+/gu, " ");

  const tokens = vendor
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length > 0 && !NOISE_WORDS.has(token.toUpperCase()));

  vendor = tokens.join(" ").trim();
  vendor = vendor.replace(/\s{2,}/g, " ");

  // Smart title-case: keep all-caps short tokens, otherwise capitalize first letter.
  vendor = vendor
    .split(" ")
    .map((token) => {
      if (token.length <= 3 && token === token.toUpperCase()) return token;
      const lower = token.toLowerCase();
      return lower.charAt(0).toUpperCase() + lower.slice(1);
    })
    .join(" ");

  return vendor;
}

export function parseChargesText(
  text: string,
  defaults?: { currency?: string },
): ParsedCharge[] {
  const defaultCurrency = (defaults?.currency ?? "USD").toUpperCase();
  const charges: ParsedCharge[] = [];
  const lines = text.split(/\r?\n/);
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;
    const amount = detectAmount(line, defaultCurrency);
    if (!amount || amount.amountCents <= 0) continue;
    const date = detectDate(line);
    const vendor = extractVendor(line, amount, date);
    if (!vendor) continue;
    charges.push({
      rawLine: line,
      amountCents: amount.amountCents,
      currency: amount.currency,
      vendorGuess: vendor,
      dateGuess: date?.dateIso,
    });
  }
  return charges;
}

export interface CollapsedCharge extends ParsedCharge {
  occurrences: number;
}

export function collapseDuplicates(charges: ParsedCharge[]): CollapsedCharge[] {
  const map = new Map<string, CollapsedCharge>();
  for (const charge of charges) {
    const key = `${charge.vendorGuess.toLowerCase()}|${charge.currency}`;
    const existing = map.get(key);
    if (!existing) {
      map.set(key, { ...charge, occurrences: 1 });
      continue;
    }
    existing.occurrences += 1;
    // Prefer the row with the most recent date, falling back to highest amount.
    if (charge.dateGuess && (!existing.dateGuess || charge.dateGuess > existing.dateGuess)) {
      existing.dateGuess = charge.dateGuess;
      existing.amountCents = charge.amountCents;
      existing.rawLine = charge.rawLine;
    } else if (!existing.dateGuess && charge.amountCents > existing.amountCents) {
      existing.amountCents = charge.amountCents;
      existing.rawLine = charge.rawLine;
    }
  }
  return [...map.values()].sort((a, b) => b.amountCents - a.amountCents);
}
