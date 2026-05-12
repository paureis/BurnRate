// WebCrypto AES-GCM + PBKDF2 helpers for the passphrase-locked vault.
// All operations run in the browser (or any environment exposing globalThis.crypto.subtle).
// Stored ciphertext is `base64url(iv|ciphertext)`; the iv is 12 bytes per AES-GCM recommendation.

export const PBKDF2_ITERATIONS = 250000;
export const SALT_BYTES = 16;
export const IV_BYTES = 12;
export const VERIFIER_PLAINTEXT = "BURNRATE_OK";

function getSubtle(): SubtleCrypto {
  const subtle = (globalThis.crypto as Crypto | undefined)?.subtle;
  if (!subtle) {
    throw new Error("WebCrypto SubtleCrypto API is not available");
  }
  return subtle;
}

function getCrypto(): Crypto {
  if (!globalThis.crypto) {
    throw new Error("WebCrypto API is not available");
  }
  return globalThis.crypto;
}

export function randomBytes(length: number): Uint8Array {
  const bytes = new Uint8Array(length);
  getCrypto().getRandomValues(bytes);
  return bytes;
}

const BASE64URL_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";

export function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]);
  }
  const base64 = (typeof btoa === "function" ? btoa(binary) : Buffer.from(binary, "binary").toString("base64"));
  return base64.replace(/=+$/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

export function base64UrlToBytes(input: string): Uint8Array {
  const normalized = input.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
  const binary = typeof atob === "function" ? atob(padded) : Buffer.from(padded, "base64").toString("binary");
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

void BASE64URL_ALPHABET; // kept exported for documentation

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  // Copy into a fresh ArrayBuffer to avoid SharedArrayBuffer-typing ambiguity in TS 6.
  const buffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(buffer).set(bytes);
  return buffer;
}

export async function deriveKey(
  passphrase: string,
  salt: Uint8Array,
  iterations: number = PBKDF2_ITERATIONS,
): Promise<CryptoKey> {
  const subtle = getSubtle();
  const passphraseBytes = new TextEncoder().encode(passphrase);
  const baseKey = await subtle.importKey("raw", toArrayBuffer(passphraseBytes), "PBKDF2", false, ["deriveKey"]);
  return subtle.deriveKey(
    {
      name: "PBKDF2",
      hash: "SHA-256",
      salt: toArrayBuffer(salt),
      iterations,
    },
    baseKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

export async function encryptString(plaintext: string, key: CryptoKey): Promise<string> {
  const subtle = getSubtle();
  const iv = randomBytes(IV_BYTES);
  const data = new TextEncoder().encode(plaintext);
  const ciphertext = await subtle.encrypt({ name: "AES-GCM", iv: toArrayBuffer(iv) }, key, toArrayBuffer(data));
  const merged = new Uint8Array(iv.length + ciphertext.byteLength);
  merged.set(iv, 0);
  merged.set(new Uint8Array(ciphertext), iv.length);
  return bytesToBase64Url(merged);
}

export async function decryptString(token: string, key: CryptoKey): Promise<string> {
  const subtle = getSubtle();
  const bytes = base64UrlToBytes(token);
  if (bytes.length <= IV_BYTES) {
    throw new Error("Ciphertext is too short");
  }
  const iv = bytes.slice(0, IV_BYTES);
  const ciphertext = bytes.slice(IV_BYTES);
  const plaintext = await subtle.decrypt({ name: "AES-GCM", iv: toArrayBuffer(iv) }, key, toArrayBuffer(ciphertext));
  return new TextDecoder().decode(plaintext);
}

export interface VaultMeta {
  enabled: boolean;
  salt: string; // base64url
  verifier: string; // ciphertext of VERIFIER_PLAINTEXT
  iterations: number;
  createdAt: string;
}

export const emptyVaultMeta: VaultMeta = {
  enabled: false,
  salt: "",
  verifier: "",
  iterations: PBKDF2_ITERATIONS,
  createdAt: "",
};

export async function createVaultMeta(passphrase: string): Promise<{ meta: VaultMeta; key: CryptoKey }> {
  const salt = randomBytes(SALT_BYTES);
  const key = await deriveKey(passphrase, salt);
  const verifier = await encryptString(VERIFIER_PLAINTEXT, key);
  return {
    meta: {
      enabled: true,
      salt: bytesToBase64Url(salt),
      verifier,
      iterations: PBKDF2_ITERATIONS,
      createdAt: new Date().toISOString(),
    },
    key,
  };
}

export async function unlockVault(passphrase: string, meta: VaultMeta): Promise<CryptoKey> {
  if (!meta.enabled || !meta.salt || !meta.verifier) {
    throw new Error("Vault is not initialised");
  }
  const salt = base64UrlToBytes(meta.salt);
  const key = await deriveKey(passphrase, salt, meta.iterations);
  let plaintext: string;
  try {
    plaintext = await decryptString(meta.verifier, key);
  } catch {
    throw new Error("Incorrect passphrase");
  }
  if (plaintext !== VERIFIER_PLAINTEXT) {
    throw new Error("Incorrect passphrase");
  }
  return key;
}

export const ENCRYPTED_PREFIX = "ENC1.";

export function isEncryptedValue(value: string): boolean {
  return value.startsWith(ENCRYPTED_PREFIX);
}

export async function wrapEncrypted(plaintext: string, key: CryptoKey): Promise<string> {
  return ENCRYPTED_PREFIX + (await encryptString(plaintext, key));
}

export async function unwrapEncrypted(value: string, key: CryptoKey): Promise<string> {
  if (!isEncryptedValue(value)) return value;
  return decryptString(value.slice(ENCRYPTED_PREFIX.length), key);
}
