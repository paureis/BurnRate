import { describe, expect, it } from "vitest";
import { disableDecoy, enableDecoy, resolveUnlock, type VaultMetaWithDecoy } from "../decoy";
import { createVaultMeta } from "../crypto";

async function buildVault(): Promise<VaultMetaWithDecoy> {
  const { meta } = await createVaultMeta("real-pass");
  return meta as VaultMetaWithDecoy;
}

describe("enableDecoy", () => {
  it("requires the real passphrase to enable", async () => {
    const meta = await buildVault();
    await expect(enableDecoy(meta, "wrong", "decoy-pass")).rejects.toThrow();
  });

  it("rejects matching real and decoy passphrases", async () => {
    const meta = await buildVault();
    await expect(enableDecoy(meta, "real-pass", "real-pass")).rejects.toThrow();
  });

  it("attaches a decoy block on success", async () => {
    const meta = await buildVault();
    const updated = await enableDecoy(meta, "real-pass", "decoy-pass");
    expect(updated.decoy?.enabled).toBe(true);
    expect(updated.decoy?.salt.length).toBeGreaterThan(0);
  });
});

describe("resolveUnlock", () => {
  it("routes the real passphrase to slot=real", async () => {
    const meta = await buildVault();
    const enabled = await enableDecoy(meta, "real-pass", "decoy-pass");
    const result = await resolveUnlock(enabled, "real-pass");
    expect(result.slot).toBe("real");
  });

  it("routes the decoy passphrase to slot=decoy", async () => {
    const meta = await buildVault();
    const enabled = await enableDecoy(meta, "real-pass", "decoy-pass");
    const result = await resolveUnlock(enabled, "decoy-pass");
    expect(result.slot).toBe("decoy");
  });

  it("throws on a third unknown passphrase", async () => {
    const meta = await buildVault();
    const enabled = await enableDecoy(meta, "real-pass", "decoy-pass");
    await expect(resolveUnlock(enabled, "wrong")).rejects.toThrow();
  });

  it("works without a decoy block (real-only)", async () => {
    const meta = await buildVault();
    const result = await resolveUnlock(meta, "real-pass");
    expect(result.slot).toBe("real");
  });
});

describe("disableDecoy", () => {
  it("removes the decoy block while preserving real", async () => {
    const meta = await buildVault();
    const enabled = await enableDecoy(meta, "real-pass", "decoy-pass");
    const disabled = disableDecoy(enabled);
    expect(disabled.decoy).toBeUndefined();
    expect(disabled.enabled).toBe(true);
  });
});
