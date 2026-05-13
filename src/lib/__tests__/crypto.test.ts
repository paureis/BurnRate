import { describe, it, expect } from "vitest";
import {
  base64UrlToBytes,
  bytesToBase64Url,
  createVaultMeta,
  decryptString,
  deriveKey,
  encryptString,
  isEncryptedValue,
  randomBytes,
  unlockVault,
  unwrapEncrypted,
  wrapEncrypted,
  VERIFIER_PLAINTEXT,
} from "../crypto";

describe("base64url helpers", () => {
  it("round-trips arbitrary bytes", () => {
    const bytes = new Uint8Array([0, 1, 254, 255, 13, 200]);
    const encoded = bytesToBase64Url(bytes);
    expect(encoded).not.toMatch(/[+/=]/); // URL-safe alphabet only
    const decoded = base64UrlToBytes(encoded);
    expect(Array.from(decoded)).toEqual(Array.from(bytes));
  });
});

describe("randomBytes", () => {
  it("returns the requested length", () => {
    expect(randomBytes(12).length).toBe(12);
    expect(randomBytes(32).length).toBe(32);
  });

  it("produces different bytes across consecutive calls (overwhelmingly likely)", () => {
    const a = bytesToBase64Url(randomBytes(16));
    const b = bytesToBase64Url(randomBytes(16));
    expect(a).not.toBe(b);
  });
});

describe("deriveKey + encryptString + decryptString", () => {
  // PBKDF2 with 250k iterations is slow; use a small iteration count in tests.
  const ITERS = 1000;

  it("round-trips a plaintext", async () => {
    const salt = randomBytes(16);
    const key = await deriveKey("hunter2", salt, ITERS);
    const ciphertext = await encryptString("hello world", key);
    const back = await decryptString(ciphertext, key);
    expect(back).toBe("hello world");
  });

  it("each encrypt produces a different ciphertext (random IV)", async () => {
    const salt = randomBytes(16);
    const key = await deriveKey("hunter2", salt, ITERS);
    const a = await encryptString("same plaintext", key);
    const b = await encryptString("same plaintext", key);
    expect(a).not.toBe(b);
  });

  it("the wrong passphrase fails to decrypt", async () => {
    const salt = randomBytes(16);
    const key = await deriveKey("right", salt, ITERS);
    const ciphertext = await encryptString("secret", key);
    const wrongKey = await deriveKey("wrong", salt, ITERS);
    await expect(decryptString(ciphertext, wrongKey)).rejects.toBeTruthy();
  });
});

describe("vault create + unlock", () => {
  it("createVaultMeta produces a verifier that unlocks with the same passphrase", async () => {
    const { meta, key: createdKey } = await createVaultMeta("correct horse battery staple");
    expect(meta.enabled).toBe(true);
    expect(meta.salt).not.toBe("");
    expect(meta.verifier).not.toBe("");
    const ok = await decryptString(meta.verifier, createdKey);
    expect(ok).toBe(VERIFIER_PLAINTEXT);
    // unlockVault re-derives the key from passphrase + salt.
    const unlocked = await unlockVault("correct horse battery staple", meta);
    expect(unlocked).toBeTruthy();
  });

  it("wrong passphrase throws on unlock", async () => {
    const { meta } = await createVaultMeta("a-strong-pass");
    await expect(unlockVault("not-the-pass", meta)).rejects.toThrow(/Incorrect passphrase/);
  });
});

describe("wrap / unwrap", () => {
  it("isEncryptedValue detects the ENC1 prefix", () => {
    expect(isEncryptedValue("ENC1.something")).toBe(true);
    expect(isEncryptedValue("plain")).toBe(false);
  });

  it("wraps and unwraps with a CryptoKey", async () => {
    const salt = randomBytes(16);
    const key = await deriveKey("p@ss", salt, 1000);
    const wrapped = await wrapEncrypted("hidden value", key);
    expect(wrapped.startsWith("ENC1.")).toBe(true);
    const back = await unwrapEncrypted(wrapped, key);
    expect(back).toBe("hidden value");
  });

  it("unwrap returns plaintext unchanged for non-encrypted values", async () => {
    const salt = randomBytes(16);
    const key = await deriveKey("p@ss", salt, 1000);
    const back = await unwrapEncrypted("plain", key);
    expect(back).toBe("plain");
  });
});
