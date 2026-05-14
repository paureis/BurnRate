import { describe, expect, it } from "vitest";
import { GET } from "../s/[payload]/calendar.ics/route";
import { encodeSyncPayload } from "@/lib/sync";

describe("calendar.ics route handler", () => {
  it("returns text/calendar with cache headers on a valid payload", async () => {
    const payload = encodeSyncPayload({ subscriptions: [], trials: [], theme: "dark" });
    const response = await GET(new Request(`https://example.com/s/${payload}/calendar.ics`), {
      params: Promise.resolve({ payload }),
    });
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")?.startsWith("text/calendar")).toBe(true);
    expect(response.headers.get("Cache-Control")).toContain("max-age=300");
    const body = await response.text();
    expect(body.startsWith("BEGIN:VCALENDAR")).toBe(true);
    expect(body.trim().endsWith("END:VCALENDAR")).toBe(true);
  });

  it("returns an invalid-feed body on a malformed payload (not a 500)", async () => {
    const response = await GET(new Request("https://example.com/s/garbage/calendar.ics"), {
      params: Promise.resolve({ payload: "garbage" }),
    });
    expect(response.status).toBe(200);
    const body = await response.text();
    expect(body).toContain("This BurnRate calendar link is invalid");
  });

  it("strips notes from the encoded payload", async () => {
    const payload = encodeSyncPayload({
      subscriptions: [
        {
          id: "sub-1",
          name: "Netflix",
          costCents: 1599,
          billingCycle: "monthly",
          category: "entertainment",
          nextBillingDate: "2026-06-15",
          notes: "secret-note-value",
          createdAt: "2026-01-01T00:00:00.000Z",
          currency: "USD",
        },
      ],
      trials: [],
      theme: "dark",
    });
    const response = await GET(new Request(`https://example.com/s/${payload}/calendar.ics`), {
      params: Promise.resolve({ payload }),
    });
    const body = await response.text();
    expect(body).not.toContain("secret-note-value");
  });
});
