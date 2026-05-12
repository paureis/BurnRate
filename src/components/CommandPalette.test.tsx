// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CommandPalette, type CommandItem, rankCommands, scoreCommand } from "./CommandPalette";

const makeCommands = (actions: Record<string, () => void> = {}): CommandItem[] => [
  {
    id: "open-dashboard",
    label: "Open dashboard",
    keywords: "view home",
    action: actions["open-dashboard"] ?? (() => undefined),
  },
  {
    id: "add-subscription",
    label: "Add subscription",
    keywords: "new recurring",
    action: actions["add-subscription"] ?? (() => undefined),
  },
  {
    id: "export-csv",
    label: "Export CSV",
    keywords: "download",
    action: actions["export-csv"] ?? (() => undefined),
  },
  {
    id: "toggle-theme",
    label: "Toggle dark/light mode",
    keywords: "color scheme",
    action: actions["toggle-theme"] ?? (() => undefined),
  },
];

describe("rank/score helpers", () => {
  it("scoreCommand returns 0 for non-matching", () => {
    expect(scoreCommand(makeCommands()[0], "xyz123")).toBe(0);
  });

  it("prefix match scores higher than substring match", () => {
    const prefix = scoreCommand(makeCommands()[0], "Open");
    const substring = scoreCommand(makeCommands()[1], "subscript");
    expect(prefix).toBeGreaterThan(substring);
  });

  it("rankCommands sorts by score and trims to 50", () => {
    const many = Array.from({ length: 100 }, (_, i) => ({
      id: `c-${i}`,
      label: `Cmd ${i}`,
      keywords: "",
      action: () => undefined,
    }));
    const ranked = rankCommands(many, "");
    expect(ranked.length).toBe(50);
  });

  it("returns no commands when query has no fuzzy match anywhere", () => {
    const ranked = rankCommands(makeCommands(), "zzz!!!");
    expect(ranked).toHaveLength(0);
  });
});

describe("CommandPalette component", () => {
  let consoleError: ReturnType<typeof vi.spyOn>;
  let consoleWarn: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    consoleWarn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
  });

  afterEach(() => {
    expect(consoleError).not.toHaveBeenCalled();
    expect(consoleWarn).not.toHaveBeenCalled();
    consoleError.mockRestore();
    consoleWarn.mockRestore();
    cleanup();
  });

  it("renders nothing when closed", () => {
    render(<CommandPalette open={false} onClose={() => undefined} commands={makeCommands()} />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("renders a dialog and focuses the search input when open", async () => {
    render(<CommandPalette open onClose={() => undefined} commands={makeCommands()} />);
    expect(screen.getByRole("dialog", { name: /command palette/i })).toBeInTheDocument();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(screen.getByLabelText(/search commands/i)).toHaveFocus();
  });

  it("filters the option list by typed query", async () => {
    const user = userEvent.setup();
    render(<CommandPalette open onClose={() => undefined} commands={makeCommands()} />);

    await user.type(screen.getByLabelText(/search commands/i), "export");
    const options = screen.getAllByRole("option");
    expect(options.length).toBe(1);
    expect(options[0]).toHaveTextContent(/export csv/i);
  });

  it("Enter activates the currently highlighted command and closes", async () => {
    const user = userEvent.setup();
    const open = vi.fn();
    const close = vi.fn();
    render(
      <CommandPalette
        open
        onClose={close}
        commands={makeCommands({ "open-dashboard": open })}
      />,
    );

    // First option is highlighted by default
    await user.keyboard("{Enter}");
    expect(open).toHaveBeenCalled();
    expect(close).toHaveBeenCalled();
  });

  it("Arrow keys move the active selection", async () => {
    const user = userEvent.setup();
    render(<CommandPalette open onClose={() => undefined} commands={makeCommands()} />);
    await user.keyboard("{ArrowDown}{ArrowDown}");
    const options = screen.getAllByRole("option");
    expect(options[2]).toHaveAttribute("aria-selected", "true");
  });

  it("Escape closes the palette", () => {
    const close = vi.fn();
    render(<CommandPalette open onClose={close} commands={makeCommands()} />);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(close).toHaveBeenCalled();
  });

  it("Clicking outside the dialog closes it", async () => {
    const close = vi.fn();
    const user = userEvent.setup();
    render(<CommandPalette open onClose={close} commands={makeCommands()} />);
    // Click backdrop (the role=dialog element acts as backdrop too)
    await user.click(screen.getByRole("dialog"));
    expect(close).toHaveBeenCalled();
  });
});
