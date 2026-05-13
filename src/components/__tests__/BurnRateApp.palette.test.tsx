// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
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

describe("Command palette integration", () => {
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

  it("Ctrl+K opens the command palette anywhere in the app", () => {
    render(<BurnRateApp />);
    fireEvent.keyDown(window, { key: "k", ctrlKey: true });
    expect(screen.getByRole("dialog", { name: /command palette/i })).toBeInTheDocument();
  });

  it("Cmd+K also opens it (Mac case)", () => {
    render(<BurnRateApp />);
    fireEvent.keyDown(window, { key: "k", metaKey: true });
    expect(screen.getByRole("dialog", { name: /command palette/i })).toBeInTheDocument();
  });

  it("Header button labeled ⌘K opens the palette", async () => {
    const user = userEvent.setup();
    render(<BurnRateApp />);
    await user.click(screen.getByRole("button", { name: /open command palette/i }));
    expect(screen.getByRole("dialog", { name: /command palette/i })).toBeInTheDocument();
  });

  it("'Open trials' command jumps to trials view", async () => {
    const user = userEvent.setup();
    render(<BurnRateApp />);
    fireEvent.keyDown(window, { key: "k", ctrlKey: true });
    await user.type(screen.getByLabelText(/search commands/i), "trial");
    await user.keyboard("{Enter}");

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /add trial/i })).toBeInTheDocument();
    });
  });

  it("Per-subscription Edit and Delete commands appear", async () => {
    localStorage.setItem(
      "burnrate.subscriptions.v1",
      JSON.stringify([
        {
          id: "sub-X",
          name: "Spotify",
          costCents: 999,
          billingCycle: "monthly",
          category: "music",
          nextBillingDate: "2026-06-01",
          notes: "",
          createdAt: "2026-01-01T00:00:00.000Z",
        },
      ]),
    );

    const user = userEvent.setup();
    render(<BurnRateApp />);
    fireEvent.keyDown(window, { key: "k", ctrlKey: true });
    await user.type(screen.getByLabelText(/search commands/i), "spotify");
    expect(screen.getByRole("option", { name: /edit spotify/i })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: /delete spotify/i })).toBeInTheDocument();
  });
});
