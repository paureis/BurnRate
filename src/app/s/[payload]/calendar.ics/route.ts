// v6 Feature 3: live calendar feed route handler.
//
// The user copies a `webcal://<host>/s/<payload>/calendar.ics` URL into
// Google/Apple/Outlook Calendar. Each request re-renders an ICS body from
// the path payload — there is NO server-side state.

import { decodeSyncPayload, SyncDecodeError } from "@/lib/sync";
import { serializeBurnRateIcs } from "@/lib/ics";

export const dynamic = "force-dynamic";

interface RouteParams {
  params: Promise<{ payload: string }>;
}

const INVALID_FEED = [
  "BEGIN:VCALENDAR",
  "VERSION:2.0",
  "PRODID:-//BurnRate//EN",
  "CALSCALE:GREGORIAN",
  "METHOD:PUBLISH",
  "BEGIN:VEVENT",
  "UID:invalid@burnrate.app",
  "DTSTAMP:20260514T000000Z",
  "DTSTART;VALUE=DATE:20260514",
  "SUMMARY:This BurnRate calendar link is invalid — regenerate from the app",
  "DESCRIPTION:Open BurnRate in your browser and copy a fresh calendar URL.",
  "END:VEVENT",
  "END:VCALENDAR",
].join("\r\n");

export async function GET(_request: Request, context: RouteParams): Promise<Response> {
  const { payload } = await context.params;
  let body: string;
  try {
    const data = decodeSyncPayload(payload);
    // Strip notes — the live feed URL is shareable so subscription notes must not leak.
    body = serializeBurnRateIcs({
      subscriptions: data.subscriptions.map((sub) => ({ ...sub, notes: "" })),
      trials: data.trials,
      theme: data.theme,
    });
  } catch (error) {
    if (!(error instanceof SyncDecodeError)) {
      // Surface other errors as an invalid feed too — calendar clients shouldn't 500.
    }
    body = INVALID_FEED;
  }
  return new Response(body, {
    status: 200,
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Cache-Control": "public, max-age=300, s-maxage=300",
    },
  });
}
