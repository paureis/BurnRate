// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { encodeSyncPayload } from "@/lib/sync";
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

const validPayload = encodeSyncPayload({
  subscriptions: [
    {
      id: "sub-sync-1",
      name: "Spotify",
      costCents: 999,
      billingCycle: "monthly",
      category: "music",
      nextBillingDate: "2026-06-01",
      notes: "",
      createdAt: "2026-01-01T00:00:00.000Z",
    },
  ],
  trials: [],
  theme: "dark",
});

describe("Sync modal flows", () => {
  let consoleError: ReturnType<typeof vi.spyOn>;
  let consoleWarn: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    localStorage.clear();
    vi.stubGlobal("ResizeObserver", ResizeObserverMock);
    vi.stubGlobal("URL", {
      createObjectURL: vi.fn(() => "blob:burnrate"),
      revokeObjectURL: vi.fn(),
    });
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
    window.location.hash = "";
  });

  it("does not open the modal when hash is empty", () => {
    render(<BurnRateApp />);
    expect(screen.queryByRole("dialog", { name: /sync payload/i })).not.toBeInTheDocument();
  });

  it("opens the modal with summary when a #sync= hash is present", async () => {
    window.location.hash = `#sync=${validPayload}`;
    render(<BurnRateApp />);

    await waitFor(() => {
      expect(screen.getByRole("dialog", { name: /sync payload/i })).toBeInTheDocument();
    });
    expect(screen.getByRole("dialog")).toHaveTextContent("1");
  });

  it("Cancel closes modal and strips the hash without changing data", async () => {
    window.location.hash = `#sync=${validPayload}`;
    const user = userEvent.setup();
    render(<BurnRateApp />);

    await waitFor(() => screen.getByRole("dialog"));
    await user.click(screen.getByRole("button", { name: /^cancel$/i }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(window.location.hash).toBe("");
    expect(localStorage.getItem("burnrate.subscriptions.v1") ?? "[]").not.toContain("Spotify");
  });

  it("Replace overwrites local data after a second confirm", async () => {
    window.location.hash = `#sync=${validPayload}`;
    const user = userEvent.setup();
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(true);
    render(<BurnRateApp />);

    await waitFor(() => screen.getByRole("dialog"));
    await user.click(screen.getByRole("button", { name: /replace my data/i }));

    await waitFor(() => {
      expect(localStorage.getItem("burnrate.subscriptions.v1")).toContain("Spotify");
    });
    expect(confirm).toHaveBeenCalled();
    confirm.mockRestore();
  });

  it("Merge appends incoming items without duplicating existing ones", async () => {
    localStorage.setItem(
      "burnrate.subscriptions.v1",
      JSON.stringify([
        {
          id: "existing",
          name: "Netflix",
          costCents: 1500,
          billingCycle: "monthly",
          category: "entertainment",
          nextBillingDate: "2026-06-01",
          notes: "",
          createdAt: "2026-01-01T00:00:00.000Z",
        },
      ]),
    );
    window.location.hash = `#sync=${validPayload}`;
    const user = userEvent.setup();
    render(<BurnRateApp />);

    await waitFor(() => screen.getByRole("dialog"));
    await user.click(screen.getByRole("button", { name: /merge into my data/i }));

    await waitFor(() => {
      const stored = localStorage.getItem("burnrate.subscriptions.v1") ?? "";
      expect(stored).toContain("Netflix");
      expect(stored).toContain("Spotify");
    });
  });

  it("Tampered hash shows the error banner instead of summary", async () => {
    window.location.hash = `#sync=BR1.garbage`;
    render(<BurnRateApp />);

    await waitFor(() => screen.getByRole("dialog"));
    expect(screen.getByRole("dialog")).toHaveTextContent(/could not be decompressed|missing|version|invalid/i);
    expect(screen.queryByRole("button", { name: /merge into my data/i })).not.toBeInTheDocument();
  });
});
