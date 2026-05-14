import { describe, expect, it } from "vitest";
import { packDescription, unpackDescription, PEER_DEFAULT_STUN } from "../peer-sync";

describe("packDescription / unpackDescription", () => {
  it("round-trips a minimal offer", () => {
    const offer = { type: "offer" as const, sdp: "v=0\r\no=- 1 1 IN IP4 0.0.0.0\r\n" };
    const packed = packDescription(offer);
    expect(typeof packed).toBe("string");
    expect(packed).not.toContain(" ");
    const unpacked = unpackDescription(packed);
    expect(unpacked.type).toBe("offer");
    expect(unpacked.sdp).toBe(offer.sdp);
  });

  it("round-trips an answer", () => {
    const answer = { type: "answer" as const, sdp: "v=0\r\n" };
    const packed = packDescription(answer);
    const unpacked = unpackDescription(packed);
    expect(unpacked.type).toBe("answer");
  });

  it("base64url output has no padding or unsafe chars", () => {
    const packed = packDescription({ type: "offer" as const, sdp: "x" });
    expect(packed).not.toContain("=");
    expect(packed).not.toContain("+");
    expect(packed).not.toContain("/");
  });

  it("throws on malformed input", () => {
    expect(() => unpackDescription("not-base64url-?")).toThrow();
  });

  it("throws when JSON is missing required fields", () => {
    const malformed = packDescription({ type: "" as RTCSdpType, sdp: "" });
    expect(() => unpackDescription(malformed)).toThrow();
  });
});

describe("PEER_DEFAULT_STUN", () => {
  it("points at a public STUN server", () => {
    expect(PEER_DEFAULT_STUN.startsWith("stun:")).toBe(true);
  });
});
