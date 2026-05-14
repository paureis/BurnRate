import { describe, expect, it } from "vitest";
import { MAX_QR_BINARY_BYTES, MAX_QR_VERSION, encodeQr } from "../qrcode";

describe("encodeQr", () => {
  it("encodes the empty string at version 1", () => {
    const result = encodeQr("");
    if (!result.ok) throw new Error("expected ok");
    expect(result.version).toBe(1);
    expect(result.modules).toBe(21);
    expect(result.svg.startsWith("<svg")).toBe(true);
  });

  it("encodes a single character at version 1", () => {
    const result = encodeQr("X");
    if (!result.ok) throw new Error("expected ok");
    expect(result.version).toBe(1);
    expect(result.svg).toContain("viewBox");
  });

  it("picks a larger version for a 100-byte payload", () => {
    const payload = "x".repeat(100);
    const result = encodeQr(payload);
    if (!result.ok) throw new Error("expected ok");
    expect(result.version).toBeGreaterThanOrEqual(5);
    expect(result.capacityBytes).toBeGreaterThanOrEqual(100);
  });

  it("returns too-large for a 1 KB payload", () => {
    const payload = "x".repeat(1024);
    const result = encodeQr(payload);
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected fail");
    expect(result.reason).toBe("too-large");
    expect(result.byteLength).toBe(1024);
    expect(result.maxBytes).toBe(MAX_QR_BINARY_BYTES);
  });

  it("encodes the exact v10 maximum payload (271 bytes)", () => {
    const payload = "x".repeat(MAX_QR_BINARY_BYTES);
    const result = encodeQr(payload);
    if (!result.ok) throw new Error("expected ok");
    expect(result.version).toBe(MAX_QR_VERSION);
  });

  it("rejects 1 byte over the v10 maximum", () => {
    const payload = "x".repeat(MAX_QR_BINARY_BYTES + 1);
    const result = encodeQr(payload);
    expect(result.ok).toBe(false);
  });

  it("output SVG is structurally valid", () => {
    const result = encodeQr("hello");
    if (!result.ok) throw new Error("expected ok");
    expect(result.svg).toContain("<svg");
    expect(result.svg).toContain("viewBox");
    expect(result.svg).toContain('shape-rendering="crispEdges"');
    expect(result.svg).toContain("</svg>");
  });

  it("module count matches the nominal grid", () => {
    for (let v = 1; v <= 4; v += 1) {
      const payload = "x".repeat(Math.max(1, v * 10));
      const result = encodeQr(payload);
      if (!result.ok) throw new Error("expected ok");
      const expected = 17 + 4 * result.version;
      expect(result.modules).toBe(expected);
    }
  });

  it("handles UTF-8 multibyte characters by byte length", () => {
    const result = encodeQr("café — multibyte 한글");
    if (!result.ok) throw new Error("expected ok");
    expect(result.version).toBeGreaterThanOrEqual(1);
  });
});
