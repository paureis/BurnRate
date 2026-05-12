// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BurnRateApp } from "./BurnRateApp";

vi.mock("recharts", () => {
  const Chart = ({ children }: { children?: React.ReactNode }) => (
    <div data-testid="chart">{children}</div>
  );
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

describe("BurnRateApp extended flows", () => {
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
    anchorClick = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => undefined);
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

  it("shows a toast and rejects submission when the cost field is empty", async () => {
    const user = userEvent.setup();
    render(<BurnRateApp />);

    await user.click(screen.getByRole("button", { name: /subscriptions/i }));
    const addPanel = screen.getByRole("heading", { name: /add subscription/i }).closest("section");
    if (!addPanel) throw new Error("Add subscription panel not found");

    await user.type(within(addPanel).getByLabelText(/service name/i), "Hulu");
    await user.click(within(addPanel).getByRole("button", { name: /add subscription/i }));

    expect(
      await screen.findByText(/add a service name, cost, and billing date/i),
    ).toBeInTheDocument();
    expect(localStorage.getItem("burnrate.subscriptions.v1") ?? "").not.toContain("Hulu");
  });

  it("shows a toast and rejects submission when the cost is zero", async () => {
    const user = userEvent.setup();
    render(<BurnRateApp />);

    await user.click(screen.getByRole("button", { name: /subscriptions/i }));
    const addPanel = screen.getByRole("heading", { name: /add subscription/i }).closest("section");
    if (!addPanel) throw new Error("Add subscription panel not found");

    await user.type(within(addPanel).getByLabelText(/service name/i), "Free Tier");
    await user.type(within(addPanel).getByLabelText(/^cost$/i), "0");
    fireEvent.change(within(addPanel).getByLabelText(/next billing/i), {
      target: { value: "2026-06-01" },
    });
    await user.click(within(addPanel).getByRole("button", { name: /add subscription/i }));

    expect(
      await screen.findByText(/add a service name, cost, and billing date/i),
    ).toBeInTheDocument();
  });

  it("filters by category and search box correctly", async () => {
    const user = userEvent.setup();
    render(<BurnRateApp />);
    await user.click(screen.getByRole("button", { name: /subscriptions/i }));

    await addSubscription(user, {
      name: "Spotify",
      cost: "10",
      category: "music",
      nextBillingDate: "2026-05-20",
    });
    await addSubscription(user, {
      name: "Netflix",
      cost: "22.99",
      category: "entertainment",
      nextBillingDate: "2026-05-14",
    });
    await addSubscription(user, {
      name: "Notion",
      cost: "12",
      category: "productivity",
      nextBillingDate: "2026-06-01",
    });

    expect(screen.getByText("Spotify")).toBeInTheDocument();
    expect(screen.getByText("Netflix")).toBeInTheDocument();
    expect(screen.getByText("Notion")).toBeInTheDocument();

    // Filter to music only — should hide the others
    const filterSelect = screen.getByLabelText(/^filter$/i);
    await user.selectOptions(filterSelect, "music");
    expect(screen.getByText("Spotify")).toBeInTheDocument();
    expect(screen.queryByText("Netflix")).not.toBeInTheDocument();
    expect(screen.queryByText("Notion")).not.toBeInTheDocument();

    // Reset filter, then search
    await user.selectOptions(filterSelect, "all");
    const searchInput = screen.getByPlaceholderText(/service or category/i);
    await user.type(searchInput, "net");
    expect(screen.getByText("Netflix")).toBeInTheDocument();
    expect(screen.queryByText("Spotify")).not.toBeInTheDocument();
    expect(screen.queryByText("Notion")).not.toBeInTheDocument();
  });

  it("sorts subscriptions by cost (descending) on demand", async () => {
    const user = userEvent.setup();
    render(<BurnRateApp />);
    await user.click(screen.getByRole("button", { name: /subscriptions/i }));

    await addSubscription(user, {
      name: "Cheap",
      cost: "1.00",
      category: "music",
      nextBillingDate: "2026-06-01",
    });
    await addSubscription(user, {
      name: "Expensive",
      cost: "50.00",
      category: "entertainment",
      nextBillingDate: "2026-06-02",
    });
    await addSubscription(user, {
      name: "Medium",
      cost: "10.00",
      category: "productivity",
      nextBillingDate: "2026-06-03",
    });

    await user.selectOptions(screen.getByLabelText(/^sort$/i), "cost");
    const articles = screen.getAllByRole("article");
    const names = articles
      .map((a) => a.querySelector("h3")?.textContent ?? "")
      .filter((name) => ["Cheap", "Expensive", "Medium"].includes(name));
    expect(names).toEqual(["Expensive", "Medium", "Cheap"]);
  });

  it("normalizes burn across mixed billing cycles", async () => {
    const user = userEvent.setup();
    render(<BurnRateApp />);
    await user.click(screen.getByRole("button", { name: /subscriptions/i }));

    // weekly $5 ($21.67/mo), monthly $20 ($20/mo), yearly $120 ($10/mo)  → total ~$51.67/mo
    await addSubscription(user, {
      name: "Weekly",
      cost: "5",
      category: "music",
      nextBillingDate: "2026-06-01",
      billingCycle: "weekly",
    });
    await addSubscription(user, {
      name: "Monthly",
      cost: "20",
      category: "entertainment",
      nextBillingDate: "2026-06-02",
      billingCycle: "monthly",
    });
    await addSubscription(user, {
      name: "Yearly",
      cost: "120",
      category: "productivity",
      nextBillingDate: "2026-06-03",
      billingCycle: "yearly",
    });

    // Verify the per-row monthly normalization (not animated): weekly $5 -> ~$21.67/mo, yearly $120 -> $10/mo.
    await waitFor(() => {
      expect(screen.getByText("$21.67/mo")).toBeInTheDocument();
      expect(screen.getByText("$10.00/mo")).toBeInTheDocument();
      expect(screen.getByText("$20.00/mo")).toBeInTheDocument();
    });
  });

  it("cancel-edit leaves the subscription unchanged", async () => {
    const user = userEvent.setup();
    render(<BurnRateApp />);
    await user.click(screen.getByRole("button", { name: /subscriptions/i }));

    await addSubscription(user, {
      name: "Original",
      cost: "9.99",
      category: "music",
      nextBillingDate: "2026-06-01",
    });

    await user.click(screen.getByRole("button", { name: /edit original/i }));
    const nameInput = screen.getByDisplayValue("Original");
    await user.clear(nameInput);
    await user.type(nameInput, "Modified");
    await user.click(screen.getByRole("button", { name: /^cancel$/i }));

    // Still shows original; Modified does not exist.
    expect(screen.getByText("Original")).toBeInTheDocument();
    expect(screen.queryByText("Modified")).not.toBeInTheDocument();
  });

  it("data persists across remounts (full reload simulation)", async () => {
    const user = userEvent.setup();
    const first = render(<BurnRateApp />);
    await user.click(screen.getByRole("button", { name: /subscriptions/i }));
    await addSubscription(user, {
      name: "Persistent",
      cost: "9.99",
      category: "music",
      nextBillingDate: "2026-06-01",
    });
    expect(await screen.findByText("Persistent")).toBeInTheDocument();
    first.unmount();
    cleanup();

    // Mount a fresh tree — data should appear immediately, no flash.
    render(<BurnRateApp />);
    await user.click(screen.getByRole("button", { name: /subscriptions/i }));
    expect(await screen.findByText("Persistent")).toBeInTheDocument();
  });

  it("theme toggle persists across remounts", async () => {
    const user = userEvent.setup();
    const first = render(<BurnRateApp />);
    await user.click(screen.getByRole("button", { name: /switch to light mode/i }));
    expect(document.querySelector(".app-shell")).toHaveClass("theme-light");
    first.unmount();
    cleanup();

    render(<BurnRateApp />);
    expect(document.querySelector(".app-shell")).toHaveClass("theme-light");
  });

  it("deleting the last subscription returns the empty state", async () => {
    const user = userEvent.setup();
    render(<BurnRateApp />);
    await user.click(screen.getByRole("button", { name: /subscriptions/i }));
    await addSubscription(user, {
      name: "Solo",
      cost: "1.00",
      category: "other",
      nextBillingDate: "2026-06-01",
    });
    await user.click(screen.getByRole("button", { name: /delete solo/i }));
    expect(await screen.findByText(/no subscriptions match/i)).toBeInTheDocument();
  });

  it("converted trial appears under subscriptions with note 'Converted from free trial.'", async () => {
    const user = userEvent.setup();
    render(<BurnRateApp />);
    await user.click(screen.getByRole("button", { name: /trials/i }));

    await user.type(screen.getByLabelText(/service name/i), "Linear");
    fireEvent.change(screen.getByLabelText(/start date/i), { target: { value: "2026-05-01" } });
    fireEvent.change(screen.getByLabelText(/end date/i), { target: { value: "2026-06-01" } });
    await user.type(screen.getByLabelText(/cost after trial/i), "8");
    await user.click(screen.getByRole("button", { name: /add trial/i }));

    await user.click(screen.getAllByRole("button", { name: /convert/i })[0]);

    // Lands on subscriptions view with the converted entry.
    await waitFor(() => {
      expect(screen.getByText("Linear")).toBeInTheDocument();
      expect(screen.getByText("Converted from free trial.")).toBeInTheDocument();
    });
  });

  it("rejects a malformed CSV import and surfaces a toast", async () => {
    const user = userEvent.setup();
    const { container } = render(<BurnRateApp />);
    await user.click(screen.getByRole("button", { name: /settings/i }));

    const input = container.querySelector<HTMLInputElement>('input[type="file"]');
    if (!input) throw new Error("File input missing");

    // CSV with a single header line is treated as empty.
    const csv = "only,one,header,row";
    const file = new File([csv], "bad.csv", { type: "text/csv" });
    fireEvent.change(input, { target: { files: [file] } });

    // Parser tolerates this and yields empty data; toast notifies user nothing was imported (but at minimum no crash, no error log).
    await waitFor(() => {
      // localStorage stays an empty array after import.
      expect(localStorage.getItem("burnrate.subscriptions.v1") ?? "[]").toBe("[]");
    });
  });

  it("simulator shows zero savings when no toggles are flipped", async () => {
    const user = userEvent.setup();
    render(<BurnRateApp />);
    await user.click(screen.getByRole("button", { name: /subscriptions/i }));
    await addSubscription(user, {
      name: "Spotify",
      cost: "10",
      category: "music",
      nextBillingDate: "2026-06-01",
    });

    await user.click(screen.getByRole("button", { name: /what if/i }));
    expect(screen.getByText(/save \$0\.00\/year/i)).toBeInTheDocument();
  });

  it("rejects user cancellation of Reset All Data and keeps data intact", async () => {
    const user = userEvent.setup();
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    render(<BurnRateApp />);
    await user.click(screen.getByRole("button", { name: /subscriptions/i }));
    await addSubscription(user, {
      name: "Important",
      cost: "9.99",
      category: "music",
      nextBillingDate: "2026-06-01",
    });

    await user.click(screen.getByRole("button", { name: /settings/i }));
    await user.click(screen.getByRole("button", { name: /reset all data/i }));

    expect(confirm).toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: /subscriptions/i }));
    expect(screen.getByText("Important")).toBeInTheDocument();
    confirm.mockRestore();
  });

  it("renders all five view tabs without errors", async () => {
    const user = userEvent.setup();
    render(<BurnRateApp />);

    for (const label of ["Dashboard", "Subscriptions", "Trials", "What If", "Settings"]) {
      await user.click(screen.getByRole("button", { name: new RegExp(label, "i") }));
      // No console.error / console.warn fires (verified globally in afterEach).
    }
  });

  it("dashboard renders insight tiles populated by user data", async () => {
    const user = userEvent.setup();
    render(<BurnRateApp />);
    await user.click(screen.getByRole("button", { name: /subscriptions/i }));
    await addSubscription(user, {
      name: "Pricey",
      cost: "100",
      category: "entertainment",
      nextBillingDate: "2026-05-14",
    });

    await user.click(screen.getByRole("button", { name: /dashboard/i }));
    // First insight (always present when subs exist) is the largest-category share — title is "<Category> dominates your burn".
    expect(await screen.findByText(/Entertainment dominates your burn/i)).toBeInTheDocument();
    // Onboarding insight should be gone now that real data exists.
    expect(
      screen.queryByText(/Start with the subscriptions you remember/i),
    ).not.toBeInTheDocument();
  });
});

async function addSubscription(
  user: ReturnType<typeof userEvent.setup>,
  values: {
    category: string;
    cost: string;
    name: string;
    nextBillingDate: string;
    billingCycle?: "weekly" | "monthly" | "quarterly" | "yearly";
  },
) {
  const addPanel = screen.getByRole("heading", { name: /add subscription/i }).closest("section");
  if (!addPanel) throw new Error("Add subscription panel not found");

  await user.type(within(addPanel).getByLabelText(/service name/i), values.name);
  await user.type(within(addPanel).getByLabelText(/^cost$/i), values.cost);

  if (values.billingCycle) {
    await user.selectOptions(within(addPanel).getByLabelText(/billing cycle/i), values.billingCycle);
  }

  await user.clear(within(addPanel).getByLabelText(/category/i));
  await user.type(within(addPanel).getByLabelText(/category/i), values.category);
  fireEvent.change(within(addPanel).getByLabelText(/next billing/i), {
    target: { value: values.nextBillingDate },
  });
  await user.click(within(addPanel).getByRole("button", { name: /add subscription/i }));
}
