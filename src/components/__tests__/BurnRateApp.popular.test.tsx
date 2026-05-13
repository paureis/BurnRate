// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
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

describe("Popular services integration", () => {
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

  it("shows the popular services picker on the empty dashboard", () => {
    render(<BurnRateApp />);
    expect(screen.getByRole("region", { name: /popular services picker/i })).toBeInTheDocument();
  });

  it("hides the popular services picker on the dashboard once a subscription exists", async () => {
    const user = userEvent.setup();
    render(<BurnRateApp />);

    // Use the empty-state picker to add the first subscription.
    await user.click(screen.getByRole("button", { name: /^netflix/i }));
    await user.click(screen.getByRole("button", { name: /add netflix/i }));

    // Once we have a subscription, the empty-state picker on the dashboard disappears.
    await waitFor(() => {
      expect(screen.queryByRole("region", { name: /popular services picker/i })).not.toBeInTheDocument();
    });
  });

  it("toggles the picker open from the Subscriptions view via Add-from-popular button", async () => {
    const user = userEvent.setup();
    render(<BurnRateApp />);
    await user.click(screen.getByRole("button", { name: /subscriptions/i }));

    const toggle = screen.getByRole("button", { name: /add from popular services/i });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    await user.click(toggle);
    expect(screen.getByRole("button", { name: /hide popular services/i })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: /popular services picker/i })).toBeInTheDocument();
  });

  it("adds a subscription via the picker and persists it", async () => {
    const user = userEvent.setup();
    render(<BurnRateApp />);

    await user.click(screen.getByRole("button", { name: /^netflix/i }));
    await user.click(screen.getByRole("button", { name: /add netflix/i }));

    expect(localStorage.getItem("burnrate.subscriptions.v1")).toContain("Netflix");

    await user.click(screen.getByRole("button", { name: /subscriptions/i }));
    expect(await screen.findByText("Netflix")).toBeInTheDocument();
  });
});
