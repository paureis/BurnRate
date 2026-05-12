import { readFile, writeFile, mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import sharp from "sharp";

const svgPath = resolve("src", "app", "icon.svg");
const iconsDir = resolve("public", "icons");

await mkdir(iconsDir, { recursive: true });
const svg = await readFile(svgPath);

async function renderIcon(size, filename, options = {}) {
  const padding = options.maskable ? Math.round(size * 0.18) : 0;
  const innerSize = size - padding * 2;
  const inner = await sharp(svg, { density: 768 })
    .resize(innerSize, innerSize, { fit: "contain" })
    .png({ compressionLevel: 9 })
    .toBuffer();

  const background = options.maskable ? "#0f1115" : { r: 0, g: 0, b: 0, alpha: 0 };
  const canvas = sharp({
    create: { width: size, height: size, channels: 4, background },
  })
    .composite([{ input: inner, top: padding, left: padding }])
    .png({ compressionLevel: 9 });

  const buffer = await canvas.toBuffer();
  const target = resolve(iconsDir, filename);
  await writeFile(target, buffer);
  console.log(`Wrote ${target} (${buffer.length.toLocaleString()} bytes)`);
}

await renderIcon(192, "icon-192.png");
await renderIcon(512, "icon-512.png");
await renderIcon(512, "icon-512-maskable.png", { maskable: true });
