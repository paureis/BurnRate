import { describe, expect, it } from "vitest";
import {
  ENC2_PREFIX,
  SHARE_PAYLOAD_PREFIX,
  decryptFromShare,
  encryptForShare,
  isEncryptedSharePayload,
  unwrapSharePayload,
  wrapSharePayload,
} from "../crypto-share";

describe("encryptForShare / decryptFromShare", () => {
  it("round-trips with the correct passphrase", async () => {
    const envelope = await encryptForShare("hello world", "correct horse battery staple");
    expect(envelope.envelope.startsWith(ENC2_PREFIX)).toBe(true);
    const plain = await decryptFromShare(envelope.envelope, "correct horse battery staple");
    expect(plain).toBe("hello world");
  });

  it("throws on wrong passphrase", async () => {
    const envelope = await encryptForShare("secret", "right");
    await expect(decryptFromShare(envelope.envelope, "wrong")).rejects.toThrow();
  });

  it("throws on a tampered envelope", async () => {
    const envelope = await encryptForShare("secret", "pass");
    const tampered = envelope.envelope.slice(0, -5) + "xxxxx";
    await expect(decryptFromShare(tampered, "pass")).rejects.toThrow();
  });

  it("emits unique IVs across consecutive encrypts", async () => {
    const a = await encryptForShare("plain", "pw");
    const b = await encryptForShare("plain", "pw");
    expect(a.envelope).not.toBe(b.envelope);
  });

  it("rejects empty passphrase", async () => {
    await expect(encryptForShare("plain", "")).rejects.toThrow();
  });
});

describe("BR5E. payload wrappers", () => {
  it("isEncryptedSharePayload flags BR5E. payloads", () => {
    expect(isEncryptedSharePayload(`${SHARE_PAYLOAD_PREFIX}whatever`)).toBe(true);
    expect(isEncryptedSharePayload("BR5.whatever")).toBe(false);
  });

  it("round-trips wrap / unwrap", async () => {
    const wrapped = await wrapSharePayload("payload", "pass");
    expect(wrapped.startsWith(SHARE_PAYLOAD_PREFIX)).toBe(true);
    const unwrapped = await unwrapSharePayload(wrapped, "pass");
    expect(unwrapped).toBe("payload");
  });

  it("unwrap throws when prefix is missing", async () => {
    await expect(unwrapSharePayload("not-a-payload", "pass")).rejects.toThrow();
  });
});
