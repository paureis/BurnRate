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

describe("BurnRateApp flows", () => {
  let consoleError: ReturnType<typeof vi.spyOn>;
  let consoleWarn: ReturnType<typeof vi.spyOn>;
  let anchorClick: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    localStorage.clear();
    vi.stubGlobal("ResizeObserver", ResizeObserverMock);
    vi.stubGlobal("URL", {
      createObjectURL: vi.fn(() => "blob:burnrate"),
      revokeObjectURL: vi.fn(),
    });
    anchorClick = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);
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

  it("adds, edits, deletes, and persists a subscription", async () => {
    const user = userEvent.setup();
    render(<BurnRateApp />);

    await user.click(screen.getByRole("button", { name: /subscriptions/i }));
    await addSubscription(user, {
      name: "Netflix",
      cost: "22.99",
      category: "entertainment",
      nextBillingDate: "2026-05-14",
    });

    expect(await screen.findByText("Netflix")).toBeInTheDocument();
    expect(screen.getByText("$22.99/mo")).toBeInTheDocument();
    expect(localStorage.getItem("burnrate.subscriptions.v1")).toContain("Netflix");

    await user.click(screen.getByRole("button", { name: /edit netflix/i }));
    const editedName = screen.getByDisplayValue("Netflix");
    await user.clear(editedName);
    await user.type(editedName, "Netflix Premium");
    await user.click(screen.getByRole("button", { name: /save changes/i }));

    expect(await screen.findByText("Netflix Premium")).toBeInTheDocument();
    expect(screen.getByText("$22.99/mo")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /delete netflix premium/i }));
    await waitFor(() => expect(screen.queryByText("Netflix Premium")).not.toBeInTheDocument());
    expect(localStorage.getItem("burnrate.subscriptions.v1")).not.toContain("Netflix Premium");
  });

  it("adds a trial, shows its countdown, and converts it into a subscription", async () => {
    const user = userEvent.setup();
    render(<BurnRateApp />);

    await user.click(screen.getByRole("button", { name: /trials/i }));
    await user.type(screen.getByLabelText(/service name/i), "Figma");
    fireEvent.change(screen.getByLabelText(/start date/i), { target: { value: "2026-05-01" } });
    fireEvent.change(screen.getByLabelText(/end date/i), { target: { value: "2026-05-13" } });
    await user.type(screen.getByLabelText(/cost after trial/i), "15");
    await user.click(screen.getByRole("button", { name: /add trial/i }));

    expect(await screen.findByText("Figma")).toBeInTheDocument();
    expect(screen.getByText("days left")).toBeInTheDocument();

    await user.click(screen.getAllByRole("button", { name: /convert/i })[0]);
    expect(await screen.findByText("Converted from free trial.")).toBeInTheDocument();
    expect(localStorage.getItem("burnrate.subscriptions.v1")).toContain("Figma");
    expect(localStorage.getItem("burnrate.trials.v1")).not.toContain("Figma");
  });

  it("updates simulator savings, exports CSV, and toggles light mode", async () => {
    const user = userEvent.setup();
    render(<BurnRateApp />);

    await user.click(screen.getByRole("button", { name: /subscriptions/i }));
    await addSubscription(user, {
      name: "Spotify",
      cost: "10",
      category: "music",
      nextBillingDate: "2026-05-20",
    });

    await user.click(screen.getByRole("button", { name: /what if/i }));
    const spotifyToggle = screen.getByRole("checkbox", { name: /spotify/i });
    await user.click(spotifyToggle);
    expect(screen.getByText(/You'd save \$120\.00\/year/i)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /settings/i }));
    await user.click(screen.getByRole("button", { name: /export csv/i }));
    expect(URL.createObjectURL).toHaveBeenCalledTimes(1);
    expect(anchorClick).toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: /switch to light mode/i }));
    expect(document.querySelector(".app-shell")).toHaveClass("theme-light");
  });

  it("imports CSV data and resets local browser data after confirmation", async () => {
    const user = userEvent.setup();
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(true);
    const { container } = render(<BurnRateApp />);

    await user.click(screen.getByRole("button", { name: /settings/i }));
    const input = container.querySelector<HTMLInputElement>('input[type="file"]');
    if (!input) {
      throw new Error("Import input not found");
    }

    const csv = [
      "recordType,id,name,costCents,billingCycle,category,nextBillingDate,notes,color,icon,createdAt,trialStartDate,trialEndDate,costAfterTrialCents,remindMe,theme",
      "meta,,,,,,,,,,,,,,,light",
      "subscription,sub-import,Imported Music,999,monthly,music,2026-05-20,Imported note,#37f29b,music,2026-05-11T00:00:00.000Z,,,,,",
      "trial,trial-import,Imported Trial,,,,,,,,2026-05-11T00:00:00.000Z,2026-05-01,2026-05-13,1299,true,",
    ].join("\n");
    const file = new File([csv], "burnrate.csv", { type: "text/csv" });
    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => expect(localStorage.getItem("burnrate.subscriptions.v1")).toContain("Imported Music"));
    expect(localStorage.getItem("burnrate.trials.v1")).toContain("Imported Trial");
    expect(document.querySelector(".app-shell")).toHaveClass("theme-light");

    await user.click(screen.getByRole("button", { name: /reset all data/i }));
    await waitFor(() => expect(localStorage.getItem("burnrate.subscriptions.v1")).toBe("[]"));
    expect(localStorage.getItem("burnrate.trials.v1")).toBe("[]");
    expect(confirm).toHaveBeenCalledWith("Reset all BurnRate data stored in this browser?");
    confirm.mockRestore();
  });
});

async function addSubscription(
  user: ReturnType<typeof userEvent.setup>,
  values: { category: string; cost: string; name: string; nextBillingDate: string },
) {
  const addPanel = screen.getByRole("heading", { name: /add subscription/i }).closest("section");
  if (!addPanel) {
    throw new Error("Add subscription panel not found");
  }

  await user.type(within(addPanel).getByLabelText(/service name/i), values.name);
  await user.type(within(addPanel).getByLabelText(/cost/i), values.cost);
  await user.clear(within(addPanel).getByLabelText(/category/i));
  await user.type(within(addPanel).getByLabelText(/category/i), values.category);
  fireEvent.change(within(addPanel).getByLabelText(/next billing/i), {
    target: { value: values.nextBillingDate },
  });
  await user.click(within(addPanel).getByRole("button", { name: /add subscription/i }));
}
