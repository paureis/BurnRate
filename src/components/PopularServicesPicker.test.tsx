// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Subscription } from "@/lib/burnrate";
import { PopularServicesPicker, type PopularServiceAdd } from "./PopularServicesPicker";

function makeSubscription(name: string): Subscription {
  return {
    id: name,
    name,
    costCents: 999,
    billingCycle: "monthly",
    category: "entertainment",
    nextBillingDate: "2026-06-01",
    notes: "",
    createdAt: "2026-01-01T00:00:00.000Z",
  };
}

describe("PopularServicesPicker", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders many service tiles", () => {
    render(<PopularServicesPicker existing={[]} onAdd={() => undefined} />);
    expect(screen.getByRole("button", { name: /netflix/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /spotify/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /1password/i })).toBeInTheDocument();
  });

  it("filters by query, case-insensitive on name and category", async () => {
    const user = userEvent.setup();
    render(<PopularServicesPicker existing={[]} onAdd={() => undefined} />);
    const input = screen.getByLabelText(/search popular services/i);
    await user.type(input, "music");

    expect(screen.getByRole("button", { name: /spotify/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /apple music/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^netflix$/i })).not.toBeInTheDocument();
  });

  it("shows a friendly empty state when no matches", async () => {
    const user = userEvent.setup();
    render(<PopularServicesPicker existing={[]} onAdd={() => undefined} />);
    await user.type(screen.getByLabelText(/search popular services/i), "zzzzz-no-match");
    expect(screen.getByText(/no popular services match/i)).toBeInTheDocument();
  });

  it("disables tiles for already-added services and labels them 'Added'", () => {
    render(<PopularServicesPicker existing={[makeSubscription("netflix")]} onAdd={() => undefined} />);
    const tile = screen.getByRole("button", { name: /netflix already added/i });
    expect(tile).toBeDisabled();
    expect(within(tile).getByText(/added/i)).toBeInTheDocument();
  });

  it("opens an inline form on click and adds a subscription", async () => {
    const user = userEvent.setup();
    const onAdd = vi.fn<(payload: PopularServiceAdd) => void>();
    render(<PopularServicesPicker existing={[]} onAdd={onAdd} />);

    await user.click(screen.getByRole("button", { name: /^netflix/i }));
    expect(screen.getByRole("button", { name: /add netflix/i })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /add netflix/i }));

    expect(onAdd).toHaveBeenCalledTimes(1);
    const payload = onAdd.mock.calls[0][0];
    expect(payload.name).toBe("Netflix");
    expect(payload.costCents).toBeGreaterThan(0);
    expect(payload.category).toBe("entertainment");
    expect(payload.billingCycle).toBe("monthly");
  });

  it("rejects negative cost in the inline form with an inline error", async () => {
    const user = userEvent.setup();
    const onAdd = vi.fn();
    render(<PopularServicesPicker existing={[]} onAdd={onAdd} />);

    await user.click(screen.getByRole("button", { name: /^spotify/i }));
    const costInput = screen.getByLabelText(/spotify cost/i);
    await user.clear(costInput);
    await user.type(costInput, "-5");
    await user.click(screen.getByRole("button", { name: /add spotify/i }));

    expect(screen.getByRole("alert")).toHaveTextContent(/cost greater than \$0/i);
    expect(onAdd).not.toHaveBeenCalled();
  });

  it("supports keyboard activation of a tile (Tab + Enter)", async () => {
    const user = userEvent.setup();
    render(<PopularServicesPicker existing={[]} onAdd={() => undefined} />);

    const tile = screen.getByRole("button", { name: /^netflix/i });
    tile.focus();
    expect(tile).toHaveFocus();
    await user.keyboard("{Enter}");
    expect(screen.getByRole("button", { name: /add netflix/i })).toBeInTheDocument();
  });

  it("cancel button closes the inline form without adding", async () => {
    const user = userEvent.setup();
    const onAdd = vi.fn();
    render(<PopularServicesPicker existing={[]} onAdd={onAdd} />);
    await user.click(screen.getByRole("button", { name: /^hulu/i }));
    expect(screen.getByRole("button", { name: /add hulu/i })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /^cancel$/i }));
    expect(screen.queryByRole("button", { name: /add hulu/i })).not.toBeInTheDocument();
    expect(onAdd).not.toHaveBeenCalled();
  });
});
