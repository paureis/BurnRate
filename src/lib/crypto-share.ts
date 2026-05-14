// v6 Feature 4: passphrase-wrapped share envelopes.
//
// Reuses the WebCrypto primitives from crypto.ts (PBKDF2 → AES-GCM 256)
// but uses a distinct ENC2. prefix and a "salt|iv|ciphertext" wire shape
// so a share link can carry its own salt without a separate vault.

import { bytesToBase64Url, base64UrlToBytes, deriveKey, IV_BYTES, randomBytes, SALT_BYTES } from "./crypto";

export const ENC2_PREFIX = "ENC2.";
export const SHARE_PAYLOAD_PREFIX = "BR5E.";

export interface ShareEnvelope {
  envelope: string; // ENC2.<base64url(salt|iv|ciphertext)>
  salt: string;     // base64url
}

function getSubtle(): SubtleCrypto {
  const subtle = (globalThis.crypto as Crypto | undefined)?.subtle;
  if (!subtle) throw new Error("WebCrypto SubtleCrypto API is not available");
  return subtle;
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const buffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(buffer).set(bytes);
  return buffer;
}

/**
 * Encrypt arbitrary plaintext (e.g. a `BR5.` sync payload) under a passphrase.
 * Result is fully self-contained — the receiver only needs the passphrase.
 */
export async function encryptForShare(plaintext: string, passphrase: string): Promise<ShareEnvelope> {
  if (!passphrase || passphrase.length < 1) throw new Error("Passphrase required");
  const subtle = getSubtle();
  const salt = randomBytes(SALT_BYTES);
  const key = await deriveKey(passphrase, salt);
  const iv = randomBytes(IV_BYTES);
  const data = new TextEncoder().encode(plaintext);
  const ciphertext = await subtle.encrypt({ name: "AES-GCM", iv: toArrayBuffer(iv) }, key, toArrayBuffer(data));
  const merged = new Uint8Array(salt.length + iv.length + ciphertext.byteLength);
  merged.set(salt, 0);
  merged.set(iv, salt.length);
  merged.set(new Uint8Array(ciphertext), salt.length + iv.length);
  return {
    envelope: ENC2_PREFIX + bytesToBase64Url(merged),
    salt: bytesToBase64Url(salt),
  };
}

/**
 * Decrypt an `ENC2.` envelope. Throws on wrong passphrase or tampering.
 */
export async function decryptFromShare(envelope: string, passphrase: string): Promise<string> {
  if (!envelope.startsWith(ENC2_PREFIX)) throw new Error("Not an encrypted share envelope");
  const subtle = getSubtle();
  const bytes = base64UrlToBytes(envelope.slice(ENC2_PREFIX.length));
  if (bytes.length <= SALT_BYTES + IV_BYTES) throw new Error("Envelope too short");
  const salt = bytes.slice(0, SALT_BYTES);
  const iv = bytes.slice(SALT_BYTES, SALT_BYTES + IV_BYTES);
  const ciphertext = bytes.slice(SALT_BYTES + IV_BYTES);
  const key = await deriveKey(passphrase, salt);
  let plaintextBuffer: ArrayBuffer;
  try {
    plaintextBuffer = await subtle.decrypt(
      { name: "AES-GCM", iv: toArrayBuffer(iv) },
      key,
      toArrayBuffer(ciphertext),
    );
  } catch {
    throw new Error("Incorrect passphrase");
  }
  return new TextDecoder().decode(plaintextBuffer);
}

/**
 * Inspect a payload prefix to decide whether the share page should prompt
 * for a passphrase before decoding.
 */
export function isEncryptedSharePayload(payload: string): boolean {
  return payload.startsWith(SHARE_PAYLOAD_PREFIX);
}

/**
 * Wrap a BR5. payload into a BR5E. payload using the user's passphrase.
 * The body of BR5E. is the ENC2. envelope (already base64url-safe).
 */
export async function wrapSharePayload(plain: string, passphrase: string): Promise<string> {
  const envelope = await encryptForShare(plain, passphrase);
  return SHARE_PAYLOAD_PREFIX + envelope.envelope;
}

export async function unwrapSharePayload(wrapped: string, passphrase: string): Promise<string> {
  if (!wrapped.startsWith(SHARE_PAYLOAD_PREFIX)) throw new Error("Not an encrypted share payload");
  return decryptFromShare(wrapped.slice(SHARE_PAYLOAD_PREFIX.length), passphrase);
}
