import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import sharp from "sharp";

const svgPath = resolve("src", "app", "icon.svg");
const outPath = resolve("public", "apple-touch-icon.png");

const svg = await readFile(svgPath);

const pngBuffer = await sharp(svg, { density: 384 })
  .resize(180, 180, { fit: "fill" })
  .png({ compressionLevel: 9 })
  .toBuffer();

await writeFile(outPath, pngBuffer);
console.log(`Wrote ${outPath} (${pngBuffer.length.toLocaleString()} bytes)`);
