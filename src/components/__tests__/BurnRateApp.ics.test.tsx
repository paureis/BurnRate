// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BurnRateApp } from "../BurnRateApp";

vi.mock("recharts", () => {
  const Chart = ({ children }: { children?: React.ReactNode }) => <div data-testid="chart">{children}</div>;
  const Primitive = ({ children }: { children?: React.ReactNode }) => <div>{children}</div>;
  return {
    Bar: Primitive,
    BarChart: Chart,
    Cell: Primitive,
    Pie: Primitive,
    PieChart: Chart,
    ResponsiveContainer: Chart,
    Tooltip: Primitive,
    XAxis: Primitive,
    YAxis: Primitive,
  };
});

class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}

describe("ICS export button", () => {
  let consoleError: ReturnType<typeof vi.spyOn>;
  let consoleWarn: ReturnType<typeof vi.spyOn>;
  let anchorClick: ReturnType<typeof vi.spyOn>;
  let blobs: Blob[] = [];
  let lastDownload: string | null = null;

  beforeEach(() => {
    localStorage.clear();
    blobs = [];
    lastDownload = null;
    vi.stubGlobal("ResizeObserver", ResizeObserverMock);
    vi.stubGlobal("URL", {
      createObjectURL: vi.fn((blob: Blob) => {
        blobs.push(blob);
        return "blob:burnrate";
      }),
      revokeObjectURL: vi.fn(),
    });

    anchorClick = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) {
      lastDownload = this.getAttribute("download");
    });

    consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    consoleWarn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
  });

  afterEach(() => {
    expect(consoleError).not.toHaveBeenCalled();
    expect(consoleWarn).not.toHaveBeenCalled();
    anchorClick.mockRestore();
    consoleError.mockRestore();
    consoleWarn.mockRestore();
    vi.unstubAllGlobals();
    cleanup();
  });

  it("downloads an ICS file with a calendar header and an event line", async () => {
    const user = userEvent.setup();
    const future = new Date();
    future.setDate(future.getDate() + 30);
    const nextBillingDate = `${future.getFullYear()}-${String(future.getMonth() + 1).padStart(2, "0")}-${String(future.getDate()).padStart(2, "0")}`;
    localStorage.setItem(
      "burnrate.subscriptions.v1",
      JSON.stringify([
        {
          id: "sub-1",
          name: "Netflix",
          costCents: 1599,
          billingCycle: "monthly",
          category: "entertainment",
          nextBillingDate,
          notes: "",
          color: undefined,
          icon: undefined,
          createdAt: new Date().toISOString(),
        },
      ]),
    );

    render(<BurnRateApp />);
    await user.click(screen.getByRole("button", { name: /settings/i }));
    await user.click(screen.getByRole("button", { name: /download \.ics calendar/i }));

    expect(anchorClick).toHaveBeenCalled();
    expect(lastDownload).toMatch(/^burnrate-calendar-\d{4}-\d{2}-\d{2}\.ics$/);
    expect(blobs).toHaveLength(1);
    const text = await blobs[0].text();
    expect(text.startsWith("BEGIN:VCALENDAR")).toBe(true);
    expect(text).toContain("END:VCALENDAR");
    expect(text).toContain("SUMMARY:Netflix renews");
    expect(text).toContain("BEGIN:VALARM");
  });

  it("can produce a calendar even with no data (empty wrapper)", async () => {
    const user = userEvent.setup();
    render(<BurnRateApp />);
    await user.click(screen.getByRole("button", { name: /settings/i }));
    await user.click(screen.getByRole("button", { name: /download \.ics calendar/i }));

    expect(blobs).toHaveLength(1);
    const text = await blobs[0].text();
    expect(text.startsWith("BEGIN:VCALENDAR")).toBe(true);
    expect(text).toContain("END:VCALENDAR");
    expect(text).not.toContain("BEGIN:VEVENT");
  });

  it("sets correct MIME type for the calendar blob", async () => {
    const user = userEvent.setup();
    render(<BurnRateApp />);
    await user.click(screen.getByRole("button", { name: /settings/i }));
    await user.click(screen.getByRole("button", { name: /download \.ics calendar/i }));

    expect(blobs[0].type).toBe("text/calendar;charset=utf-8");
  });
});

// Helper used by hooks; jsdom fireEvent already imported above for any side use
void fireEvent;
