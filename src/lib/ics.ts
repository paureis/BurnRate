import type { BillingCycle, BurnRateData, Subscription, Trial } from "./burnrate";
import { formatCents } from "./burnrate";

export interface SerializeIcsOptions {
  horizonDays?: number;
  today?: Date;
}

const DEFAULT_HORIZON_DAYS = 365;
const ICS_LINE_LIMIT = 75;
const CRLF = "\r\n";
const PRODID = "-//BurnRate//EN";

export function serializeBurnRateIcs(data: BurnRateData, options: SerializeIcsOptions = {}): string {
  const today = startOfDay(options.today ?? new Date());
  const horizonDays = options.horizonDays && options.horizonDays > 0 ? options.horizonDays : DEFAULT_HORIZON_DAYS;
  const horizonEnd = addDays(today, horizonDays);
  const dtstamp = formatDtstamp(options.today ?? new Date());

  const logicalLines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    `PRODID:${PRODID}`,
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
  ];

  for (const subscription of data.subscriptions) {
    const dates = generateRenewalDates(subscription, today, horizonEnd);
    for (const date of dates) {
      logicalLines.push(...buildSubscriptionEvent(subscription, date, dtstamp));
    }
  }

  for (const trial of data.trials) {
    const event = buildTrialEvent(trial, dtstamp);
    if (event) {
      logicalLines.push(...event);
    }
  }

  logicalLines.push("END:VCALENDAR");

  return logicalLines.map(foldLine).join(CRLF);
}

function buildSubscriptionEvent(subscription: Subscription, date: Date, dtstamp: string): string[] {
  const dateValue = formatDateOnly(date);
  const dayAfter = formatDateOnly(addDays(date, 1));
  const uid = buildUid(subscription.id, dateValue);
  const summary = `${subscription.name} renews — ${formatCents(subscription.costCents)}`;
  const descriptionLines = [
    `Renewal of ${subscription.name}.`,
    `Cost: ${formatCents(subscription.costCents)} (${subscription.billingCycle}).`,
    `Category: ${subscription.category}.`,
  ];
  if (subscription.notes.trim().length > 0) {
    descriptionLines.push(`Notes: ${subscription.notes}`);
  }

  return [
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${dtstamp}`,
    `DTSTART;VALUE=DATE:${dateValue}`,
    `DTEND;VALUE=DATE:${dayAfter}`,
    `SUMMARY:${escapeIcsText(summary)}`,
    `DESCRIPTION:${escapeIcsText(descriptionLines.join("\n"))}`,
    `CATEGORIES:${escapeIcsText(`BurnRate,${subscription.category}`)}`,
    "TRANSP:TRANSPARENT",
    "BEGIN:VALARM",
    "ACTION:DISPLAY",
    `DESCRIPTION:${escapeIcsText(`${subscription.name} renews tomorrow`)}`,
    "TRIGGER:-P1D",
    "END:VALARM",
    "END:VEVENT",
  ];
}

function buildTrialEvent(trial: Trial, dtstamp: string): string[] | null {
  const parsed = parseDateOnly(trial.trialEndDate);
  if (!parsed) {
    return null;
  }
  const dateValue = formatDateOnly(parsed);
  const dayAfter = formatDateOnly(addDays(parsed, 1));
  const uid = buildUid(trial.id, dateValue);
  const summary = `${trial.name} trial ends — becomes ${formatCents(trial.costAfterTrialCents)}/mo`;
  const description = [
    `Free trial for ${trial.name} ends on ${trial.trialEndDate}.`,
    `After trial: ${formatCents(trial.costAfterTrialCents)}/mo.`,
  ].join("\n");

  return [
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${dtstamp}`,
    `DTSTART;VALUE=DATE:${dateValue}`,
    `DTEND;VALUE=DATE:${dayAfter}`,
    `SUMMARY:${escapeIcsText(summary)}`,
    `DESCRIPTION:${escapeIcsText(description)}`,
    "CATEGORIES:BurnRate,Trial",
    "TRANSP:TRANSPARENT",
    "BEGIN:VALARM",
    "ACTION:DISPLAY",
    `DESCRIPTION:${escapeIcsText(`${trial.name} trial ends tomorrow`)}`,
    "TRIGGER:-P1D",
    "END:VALARM",
    "END:VEVENT",
  ];
}

function generateRenewalDates(subscription: Subscription, today: Date, horizonEnd: Date): Date[] {
  const start = parseDateOnly(subscription.nextBillingDate);
  if (!start) {
    return [];
  }

  const results: Date[] = [];
  let cursor = start;
  let iterations = 0;

  while (cursor.getTime() <= horizonEnd.getTime() && iterations < 1000) {
    if (cursor.getTime() >= today.getTime()) {
      results.push(cursor);
    }
    cursor = advance(cursor, subscription.billingCycle);
    iterations += 1;
  }

  return results;
}

function advance(date: Date, cycle: BillingCycle): Date {
  const next = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  switch (cycle) {
    case "weekly":
      next.setDate(next.getDate() + 7);
      return next;
    case "monthly":
      next.setMonth(next.getMonth() + 1);
      return next;
    case "quarterly":
      next.setMonth(next.getMonth() + 3);
      return next;
    case "yearly":
      next.setFullYear(next.getFullYear() + 1);
      return next;
  }
}

function buildUid(recordId: string, dateValue: string): string {
  return `${recordId}-${dateValue}@burnrate.app`;
}

function foldLine(line: string): string {
  if (octetLength(line) <= ICS_LINE_LIMIT) {
    return line;
  }

  const parts: string[] = [];
  let remaining = line;
  let isFirst = true;

  while (remaining.length > 0) {
    const limit = isFirst ? ICS_LINE_LIMIT : ICS_LINE_LIMIT - 1;
    const segment = takeOctets(remaining, limit);
    parts.push(isFirst ? segment.taken : ` ${segment.taken}`);
    remaining = segment.rest;
    isFirst = false;
  }

  return parts.join(CRLF);
}

function takeOctets(input: string, limit: number): { taken: string; rest: string } {
  let total = 0;
  for (let index = 0; index < input.length; index += 1) {
    const charBytes = codeUnitBytes(input.charCodeAt(index));
    if (total + charBytes > limit) {
      return { taken: input.slice(0, index), rest: input.slice(index) };
    }
    total += charBytes;
  }
  return { taken: input, rest: "" };
}

function octetLength(input: string): number {
  let total = 0;
  for (let index = 0; index < input.length; index += 1) {
    total += codeUnitBytes(input.charCodeAt(index));
  }
  return total;
}

function codeUnitBytes(codeUnit: number): number {
  if (codeUnit < 0x80) return 1;
  if (codeUnit < 0x800) return 2;
  return 3;
}

function escapeIcsText(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r\n/g, "\n")
    .replace(/\n/g, "\\n");
}

function formatDtstamp(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  const hours = String(date.getUTCHours()).padStart(2, "0");
  const minutes = String(date.getUTCMinutes()).padStart(2, "0");
  const seconds = String(date.getUTCSeconds()).padStart(2, "0");
  return `${year}${month}${day}T${hours}${minutes}${seconds}Z`;
}

function formatDateOnly(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}${month}${day}`;
}

function parseDateOnly(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) {
    const fallback = new Date(value);
    return Number.isFinite(fallback.getTime()) ? startOfDay(fallback) : null;
  }
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  next.setDate(next.getDate() + days);
  return next;
}
