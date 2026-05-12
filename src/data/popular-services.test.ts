import { describe, expect, it } from "vitest";
import { billingCycles, defaultCategories } from "@/lib/burnrate";
import { popularServices } from "@/data/popular-services";

const requiredNames = [
  "Netflix",
  "Spotify",
  "Hulu",
  "Disney+",
  "Max",
  "Apple TV+",
  "Apple Music",
  "YouTube Premium",
  "YouTube TV",
  "Amazon Prime",
  "Paramount+",
  "Peacock",
  "Audible",
  "Kindle Unlimited",
  "Dropbox",
  "Google One",
  "iCloud+",
  "OneDrive",
  "Notion",
  "Figma",
  "Canva Pro",
  "Adobe Creative Cloud",
  "GitHub Pro",
  "ChatGPT Plus",
  "Claude Pro",
  "Grammarly",
  "1Password",
  "NordVPN",
  "Peloton",
  "DoorDash DashPass",
];

describe("popularServices", () => {
  it("exports at least 30 entries", () => {
    expect(popularServices.length).toBeGreaterThanOrEqual(30);
  });

  it("contains the required minimum set", () => {
    const names = new Set(popularServices.map((service) => service.name));
    for (const required of requiredNames) {
      expect(names.has(required)).toBe(true);
    }
  });

  it("has no duplicate names", () => {
    const seen = new Set<string>();
    for (const service of popularServices) {
      const key = service.name.toLowerCase();
      expect(seen.has(key)).toBe(false);
      seen.add(key);
    }
  });

  it("only uses categories from defaultCategories", () => {
    const allowed = new Set(defaultCategories);
    for (const service of popularServices) {
      expect(allowed.has(service.category as (typeof defaultCategories)[number])).toBe(true);
    }
  });

  it("only uses valid billing cycles", () => {
    const allowed = new Set(billingCycles);
    for (const service of popularServices) {
      expect(allowed.has(service.defaultBillingCycle)).toBe(true);
    }
  });

  it("uses positive defaultCents and valid color hex codes", () => {
    for (const service of popularServices) {
      expect(service.defaultCents).toBeGreaterThan(0);
      expect(service.color).toMatch(/^#[0-9a-fA-F]{3,8}$/);
    }
  });

  it("provides a domain string for every entry", () => {
    for (const service of popularServices) {
      expect(service.domain).toMatch(/\./);
    }
  });
});
