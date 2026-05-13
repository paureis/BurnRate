import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const manifestPath = resolve(process.cwd(), "public", "manifest.webmanifest");
const swPath = resolve(process.cwd(), "public", "sw.js");

describe("PWA manifest", () => {
  it("exists at /manifest.webmanifest", () => {
    expect(existsSync(manifestPath)).toBe(true);
  });

  it("contains required PWA fields", () => {
    const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as Record<string, unknown>;
    expect(manifest.name).toBeTypeOf("string");
    expect(manifest.short_name).toBeTypeOf("string");
    expect(manifest.start_url).toBe("/");
    expect(manifest.display).toBe("standalone");
    expect(manifest.background_color).toBeTypeOf("string");
    expect(manifest.theme_color).toBeTypeOf("string");
    expect(Array.isArray(manifest.icons)).toBe(true);
  });

  it("includes 192, 512, and 512 maskable icons", () => {
    const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as {
      icons: Array<{ src: string; sizes: string; purpose?: string }>;
    };
    const sizes = new Set(manifest.icons.map((icon) => icon.sizes));
    expect(sizes.has("192x192")).toBe(true);
    expect(sizes.has("512x512")).toBe(true);
    expect(manifest.icons.some((icon) => icon.purpose === "maskable")).toBe(true);
  });

  it("references icon files that exist on disk", () => {
    const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as {
      icons: Array<{ src: string }>;
    };
    for (const icon of manifest.icons) {
      const path = resolve(process.cwd(), "public", icon.src.replace(/^\//, ""));
      expect(existsSync(path)).toBe(true);
    }
  });
});

describe("service worker", () => {
  it("exists at /sw.js", () => {
    expect(existsSync(swPath)).toBe(true);
  });

  it("declares a versioned cache and registers install/activate/fetch handlers", () => {
    const source = readFileSync(swPath, "utf8");
    expect(source).toMatch(/CACHE_VERSION/);
    expect(source).toMatch(/addEventListener\(["']install["']/);
    expect(source).toMatch(/addEventListener\(["']activate["']/);
    expect(source).toMatch(/addEventListener\(["']fetch["']/);
  });

  it("precaches the home page and manifest in the app shell", () => {
    const source = readFileSync(swPath, "utf8");
    expect(source).toContain('"/"');
    expect(source).toContain("/manifest.webmanifest");
  });

  it("avoids caching cross-origin and dynamic OG images", () => {
    const source = readFileSync(swPath, "utf8");
    expect(source).toMatch(/isSameOrigin/);
    expect(source).toMatch(/opengraph-image/);
  });
});
