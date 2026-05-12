// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BurnRateApp } from "./BurnRateApp";

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

const SUBSCRIPTIONS_FIXTURE = [
  {
    id: "sub-1",
    name: "Netflix",
    costCents: 5000,
    billingCycle: "monthly",
    category: "entertainment",
    nextBillingDate: "2026-06-01",
    notes: "",
    createdAt: "2026-01-01T00:00:00.000Z",
  },
];

describe("Budget tracker integration", () => {
  let consoleError: ReturnType<typeof vi.spyOn>;
  let consoleWarn: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    localStorage.clear();
    vi.stubGlobal("ResizeObserver", ResizeObserverMock);
    consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    consoleWarn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
  });

  afterEach(() => {
    expect(consoleError).not.toHaveBeenCalled();
    expect(consoleWarn).not.toHaveBeenCalled();
    consoleError.mockRestore();
    consoleWarn.mockRestore();
    vi.unstubAllGlobals();
    cleanup();
  });

  it("shows the budget tracker section on the dashboard", () => {
    render(<BurnRateApp />);
    expect(screen.getByRole("region", { name: /budget tracker/i })).toBeInTheDocument();
  });

  it("sets a monthly cap and persists it to localStorage", async () => {
    localStorage.setItem("burnrate.subscriptions.v1", JSON.stringify(SUBSCRIPTIONS_FIXTURE));
    const user = userEvent.setup();
    render(<BurnRateApp />);

    const region = screen.getByRole("region", { name: /budget tracker/i });
    await user.click(within(region).getByRole("button", { name: /set goal/i }));
    await user.type(within(region).getByLabelText(/^monthly cap$/i), "40");
    await user.click(within(region).getByRole("button", { name: /save goal/i }));

    await waitFor(() => {
      const raw = localStorage.getItem("burnrate.budget.v1") ?? "";
      expect(raw).toContain('"monthlyCapCents":4000');
    });
    // 40$ cap, 50$ burn → should show "over" copy
    expect(screen.getByText(/Over by/i)).toBeInTheDocument();
  });

  it("rejects a cap of 0 with an inline error", async () => {
    const user = userEvent.setup();
    render(<BurnRateApp />);
    const region = screen.getByRole("region", { name: /budget tracker/i });
    await user.click(within(region).getByRole("button", { name: /set goal/i }));
    await user.type(within(region).getByLabelText(/^monthly cap$/i), "0");
    await user.click(within(region).getByRole("button", { name: /save goal/i }));

    expect(within(region).getByRole("alert")).toHaveTextContent(/greater than \$0/i);
  });

  it("clears a goal and removes it from localStorage", async () => {
    localStorage.setItem(
      "burnrate.budget.v1",
      JSON.stringify({
        monthlyCapCents: 5000,
        annualSavingsTargetCents: null,
        targetDate: null,
        baselineYearlyCents: null,
        createdAt: null,
      }),
    );
    const user = userEvent.setup();
    render(<BurnRateApp />);

    const region = screen.getByRole("region", { name: /budget tracker/i });
    await user.click(within(region).getByRole("button", { name: /clear goal/i }));

    await waitFor(() => {
      expect(localStorage.getItem("burnrate.budget.v1") ?? "").toContain('"monthlyCapCents":null');
    });
  });

  it("CSV export contains a budget row when a cap is set, and a re-import restores it", async () => {
    localStorage.setItem("burnrate.subscriptions.v1", JSON.stringify(SUBSCRIPTIONS_FIXTURE));
    localStorage.setItem(
      "burnrate.budget.v1",
      JSON.stringify({
        monthlyCapCents: 5000,
        annualSavingsTargetCents: 20000,
        targetDate: "2026-12-31",
        baselineYearlyCents: 60000,
        createdAt: "2026-01-01T00:00:00.000Z",
      }),
    );

    let capturedCsv = "";
    const originalCreate = URL.createObjectURL;
    vi.stubGlobal("URL", {
      createObjectURL: vi.fn((blob: Blob) => {
        blob.text().then((text) => (capturedCsv = text));
        return "blob:burnrate";
      }),
      revokeObjectURL: vi.fn(),
    });
    const anchorClick = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);

    const user = userEvent.setup();
    const { container } = render(<BurnRateApp />);
    await user.click(screen.getByRole("button", { name: /settings/i }));
    await user.click(screen.getByRole("button", { name: /export csv/i }));

    await waitFor(() => expect(capturedCsv).toContain("budget,"));
    expect(capturedCsv).toContain("5000");
    expect(capturedCsv).toContain("20000");

    // Now wipe and re-import
    localStorage.setItem("burnrate.budget.v1", JSON.stringify({ monthlyCapCents: null, annualSavingsTargetCents: null, targetDate: null, baselineYearlyCents: null, createdAt: null }));
    const input = container.querySelector<HTMLInputElement>('input[type="file"]');
    if (!input) throw new Error("File input missing");
    const file = new File([capturedCsv], "burnrate.csv", { type: "text/csv" });
    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => {
      const stored = localStorage.getItem("burnrate.budget.v1") ?? "";
      expect(stored).toContain('"monthlyCapCents":5000');
      expect(stored).toContain('"annualSavingsTargetCents":20000');
    });

    anchorClick.mockRestore();
    void originalCreate;
  });
});
