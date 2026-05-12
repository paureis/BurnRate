import type { BurnRateData } from "./burnrate";
import { parseBurnRateCsv, serializeBurnRateCsv, todayDateInputValue } from "./burnrate";
import { serializeBurnRateIcs } from "./ics";
import { decodeSyncPayload, encodeSyncPayload, summarizeSyncPayload, SyncDecodeError, type SyncSummary } from "./sync";

function downloadBlob(content: string, filename: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export function exportCsv(data: BurnRateData) {
  downloadBlob(serializeBurnRateCsv(data), `burnrate-${todayDateInputValue()}.csv`, "text/csv;charset=utf-8");
}

export function exportIcs(data: BurnRateData) {
  downloadBlob(serializeBurnRateIcs(data), `burnrate-calendar-${todayDateInputValue()}.ics`, "text/calendar;charset=utf-8");
}

export function exportBurnFile(data: BurnRateData) {
  const payload = encodeSyncPayload(data);
  downloadBlob(payload, `burnrate-${todayDateInputValue()}.burn`, "text/plain;charset=utf-8");
}

export async function copyToClipboard(text: string): Promise<boolean> {
  if (typeof navigator === "undefined" || !navigator.clipboard?.writeText) {
    return false;
  }
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

export function buildSyncUrl(data: BurnRateData, origin: string): { url: string; payload: string } {
  const payload = encodeSyncPayload(data);
  return { url: `${origin}/#sync=${payload}`, payload };
}

export function buildShareUrl(data: BurnRateData, origin: string): { url: string; payload: string } {
  const stripped: BurnRateData = {
    ...data,
    subscriptions: data.subscriptions.map((subscription) => ({ ...subscription, notes: "" })),
  };
  const payload = encodeSyncPayload(stripped);
  return { url: `${origin}/s/${payload}`, payload };
}

export async function readBurnFile(file: File): Promise<{ payload: string; summary: SyncSummary }> {
  const payload = (await file.text()).trim();
  const summary = summarizeSyncPayload(payload);
  return { payload, summary };
}

export async function readCsvFile(file: File): Promise<BurnRateData> {
  const csv = await file.text();
  return parseBurnRateCsv(csv);
}

export { decodeSyncPayload, encodeSyncPayload, summarizeSyncPayload, SyncDecodeError };
