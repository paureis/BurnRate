import { describe, expect, it } from "vitest";
import { CANCELLATION_PLAYBOOKS, findPlaybook, GENERIC_PLAYBOOK } from "../cancellation-playbooks";

describe("CANCELLATION_PLAYBOOKS", () => {
  it("ships at least 20 playbooks", () => {
    expect(CANCELLATION_PLAYBOOKS.length).toBeGreaterThanOrEqual(20);
  });

  it("every playbook has the required shape", () => {
    for (const playbook of CANCELLATION_PLAYBOOKS) {
      expect(playbook.id).toMatch(/^[a-z0-9-]+$/);
      expect(playbook.serviceName.length).toBeGreaterThan(0);
      expect(playbook.matchService.length).toBeGreaterThan(0);
      expect(playbook.steps.length).toBeGreaterThanOrEqual(3);
      expect(playbook.gotchas.length).toBeGreaterThanOrEqual(1);
      expect(playbook.estimatedMinutes).toBeGreaterThan(0);
      expect(playbook.lastVerifiedOn).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });

  it("every matchService entry is lowercase", () => {
    for (const playbook of CANCELLATION_PLAYBOOKS) {
      for (const variant of playbook.matchService) {
        expect(variant).toBe(variant.toLowerCase());
      }
    }
  });

  it("ids are unique", () => {
    const ids = CANCELLATION_PLAYBOOKS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("findPlaybook", () => {
  it("matches Netflix variants", () => {
    expect(findPlaybook("Netflix")?.id).toBe("netflix");
    expect(findPlaybook("NETFLIX.COM")?.id).toBe("netflix");
  });

  it("matches partial substrings", () => {
    expect(findPlaybook("Apple Music")?.id).toBe("apple-music");
  });

  it("returns null for unknown services", () => {
    expect(findPlaybook("Some Obscure Service")).toBeNull();
  });

  it("returns null for empty input", () => {
    expect(findPlaybook("")).toBeNull();
  });
});

describe("GENERIC_PLAYBOOK", () => {
  it("provides a usable fallback shape", () => {
    expect(GENERIC_PLAYBOOK.steps.length).toBeGreaterThanOrEqual(3);
    expect(GENERIC_PLAYBOOK.gotchas.length).toBeGreaterThanOrEqual(1);
  });
});
