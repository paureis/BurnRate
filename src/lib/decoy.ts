// v6 Feature 5: decoy passphrase mode.
//
// Extends the v3 VaultMeta with a parallel verifier so the unlock flow
// can route the unlock to a separate storage slot (`real` vs `decoy`)
// without changing the visible UI.

import {
  bytesToBase64Url,
  base64UrlToBytes,
  deriveKey,
  encryptString,
  decryptString,
  PBKDF2_ITERATIONS,
  randomBytes,
  SALT_BYTES,
  VERIFIER_PLAINTEXT,
  type VaultMeta,
} from "./crypto";

export type VaultSlot = "real" | "decoy";

export interface DecoyMeta {
  verifier: string;
  salt: string;
  enabled: boolean;
}

export interface VaultMetaWithDecoy extends VaultMeta {
  decoy?: DecoyMeta;
}

export interface UnlockResolution {
  slot: VaultSlot;
  key: CryptoKey;
}

/**
 * Enable decoy mode on an existing vault. The decoy passphrase MUST differ
 * from the real passphrase; otherwise the slots collide.
 */
export async function enableDecoy(
  meta: VaultMetaWithDecoy,
  realPassphrase: string,
  decoyPassphrase: string,
): Promise<VaultMetaWithDecoy> {
  if (!meta.enabled) throw new Error("Cannot enable decoy without a real vault");
  if (decoyPassphrase === realPassphrase) throw new Error("Decoy passphrase must differ from real");
  // Verify the real passphrase first so we don't let an attacker enable decoy
  // mode without knowing the real one.
  const realSalt = base64UrlToBytes(meta.salt);
  const realKey = await deriveKey(realPassphrase, realSalt, meta.iterations);
  const verified = await decryptString(meta.verifier, realKey).catch(() => null);
  if (verified !== VERIFIER_PLAINTEXT) throw new Error("Incorrect real passphrase");

  const decoySaltBytes = randomBytes(SALT_BYTES);
  const decoyKey = await deriveKey(decoyPassphrase, decoySaltBytes, meta.iterations);
  const decoyVerifier = await encryptString(VERIFIER_PLAINTEXT, decoyKey);
  return {
    ...meta,
    decoy: {
      enabled: true,
      salt: bytesToBase64Url(decoySaltBytes),
      verifier: decoyVerifier,
    },
  };
}

/**
 * Disable decoy mode (forgets the decoy verifier). Caller is responsible
 * for wiping the decoy storage slot.
 */
export function disableDecoy(meta: VaultMetaWithDecoy): VaultMetaWithDecoy {
  const { decoy: _ignored, ...rest } = meta;
  void _ignored;
  return rest;
}

/**
 * Resolve an unlock attempt to a slot. Tries the real verifier first; if
 * that fails AND a decoy is enabled, tries that too. Throws if neither
 * passphrase matches.
 */
export async function resolveUnlock(
  meta: VaultMetaWithDecoy,
  passphrase: string,
): Promise<UnlockResolution> {
  if (!meta.enabled) throw new Error("Vault is not initialised");

  // Try real first.
  const realSalt = base64UrlToBytes(meta.salt);
  const realKey = await deriveKey(passphrase, realSalt, meta.iterations);
  try {
    const verified = await decryptString(meta.verifier, realKey);
    if (verified === VERIFIER_PLAINTEXT) return { slot: "real", key: realKey };
  } catch {
    /* fallthrough */
  }

  // Try decoy if enabled.
  if (meta.decoy?.enabled) {
    const decoySalt = base64UrlToBytes(meta.decoy.salt);
    const decoyKey = await deriveKey(passphrase, decoySalt, meta.iterations);
    try {
      const verified = await decryptString(meta.decoy.verifier, decoyKey);
      if (verified === VERIFIER_PLAINTEXT) return { slot: "decoy", key: decoyKey };
    } catch {
      /* fallthrough */
    }
  }

  throw new Error("Incorrect passphrase");
}

export const DEMO_DECOY_DATA = {
  subscriptions: [
    { name: "Netflix", costCents: 1599, billingCycle: "monthly", category: "entertainment" },
    { name: "Spotify", costCents: 1099, billingCycle: "monthly", category: "music" },
    { name: "iCloud+", costCents: 99, billingCycle: "monthly", category: "cloud/storage" },
    { name: "NYT Cooking", costCents: 500, billingCycle: "monthly", category: "news/media" },
    { name: "Notion", costCents: 1000, billingCycle: "monthly", category: "productivity" },
    { name: "Adobe CC Photography", costCents: 1199, billingCycle: "monthly", category: "productivity" },
  ],
} as const;

export const VAULT_META_DEFAULT: VaultMetaWithDecoy = {
  enabled: false,
  salt: "",
  verifier: "",
  iterations: PBKDF2_ITERATIONS,
  createdAt: "",
};
