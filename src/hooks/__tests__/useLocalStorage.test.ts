// @vitest-environment jsdom

import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useLocalStorage } from "../useLocalStorage";

describe("useLocalStorage", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns the initial value when nothing is stored", () => {
    const { result } = renderHook(() => useLocalStorage("k1", { count: 0 }));
    expect(result.current[0]).toEqual({ count: 0 });
  });

  it("reads existing localStorage value synchronously on first render (no flash)", () => {
    localStorage.setItem("k2", JSON.stringify({ count: 42 }));
    const { result } = renderHook(() => useLocalStorage("k2", { count: 0 }));
    // Critical: first render must already have the stored value, not the fallback.
    expect(result.current[0]).toEqual({ count: 42 });
  });

  it("persists subsequent updates to localStorage", () => {
    const { result } = renderHook(() => useLocalStorage<number>("k3", 0));
    act(() => result.current[1](5));
    expect(JSON.parse(localStorage.getItem("k3")!)).toBe(5);
    act(() => result.current[1]((prev) => prev + 1));
    expect(JSON.parse(localStorage.getItem("k3")!)).toBe(6);
  });

  it("does not write the initial value back on first mount", () => {
    // Pre-existing storage value should not be clobbered by the fallback during mount.
    localStorage.setItem("k4", JSON.stringify("preexisting"));
    const setItem = vi.spyOn(Storage.prototype, "setItem");
    renderHook(() => useLocalStorage("k4", "fallback"));
    expect(setItem).not.toHaveBeenCalled();
  });

  it("recovers from invalid JSON in storage by returning the fallback", () => {
    localStorage.setItem("k5", "not-valid-json{");
    const { result } = renderHook(() => useLocalStorage("k5", "default"));
    expect(result.current[0]).toBe("default");
  });

  it("survives a setItem quota failure without throwing", () => {
    const setItem = vi
      .spyOn(Storage.prototype, "setItem")
      .mockImplementation(() => {
        throw new DOMException("QuotaExceededError");
      });
    const { result } = renderHook(() => useLocalStorage("k6", 0));
    expect(() => act(() => result.current[1](99))).not.toThrow();
    expect(result.current[0]).toBe(99);
    setItem.mockRestore();
  });

  it("supports arrays and objects (round trip)", () => {
    const { result } = renderHook(() => useLocalStorage<number[]>("k7", []));
    act(() => result.current[1]([1, 2, 3]));
    expect(JSON.parse(localStorage.getItem("k7")!)).toEqual([1, 2, 3]);
  });

  it("returns a stable setter reference across renders", () => {
    const { result, rerender } = renderHook(() => useLocalStorage("k8", 0));
    const firstSetter = result.current[1];
    rerender();
    expect(result.current[1]).toBe(firstSetter);
  });
});
