// Generates public/og-v3.png by rendering an HTML page in headless Chromium.
// Browser-quality text rendering (subpixel AA, real Bebas Neue + Manrope from
// Google Fonts) — the previous sharp+librsvg pipeline produced soft text
// because librsvg falls back to generic fonts when fontconfig can't resolve
// "Impact" and "Helvetica Neue" by name.
import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import puppeteer from "puppeteer";

const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Manrope:wght@500;700;800&display=swap" rel="stylesheet" />
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  html, body { width: 1200px; height: 630px; }
  body {
    width: 1200px;
    height: 630px;
    color: #f6f1e8;
    font-family: "Manrope", system-ui, sans-serif;
    background:
      radial-gradient(circle at 15% 25%, rgba(255, 90, 61, 0.35), transparent 55%),
      radial-gradient(circle at 85% 90%, rgba(55, 242, 155, 0.22), transparent 55%),
      linear-gradient(135deg, #0f1115 0%, #171a21 100%);
    position: relative;
    overflow: hidden;
  }
  .grid {
    position: absolute;
    inset: 0;
    background-image:
      linear-gradient(rgba(255, 255, 255, 0.04) 1px, transparent 1px),
      linear-gradient(90deg, rgba(255, 255, 255, 0.04) 1px, transparent 1px);
    background-size: 48px 48px;
    pointer-events: none;
  }
  .header { position: absolute; top: 86px; left: 90px; display: flex; align-items: center; gap: 28px; }
  .logo-tile {
    width: 120px;
    height: 120px;
    border-radius: 22px;
    background: #0f1115;
    box-shadow: 0 0 60px rgba(255, 90, 61, 0.45);
    display: grid;
    place-items: center;
  }
  .logo-tile svg { width: 86px; height: 86px; }
  .brand h1 {
    font-family: "Bebas Neue", Impact, sans-serif;
    font-size: 96px;
    line-height: 1;
    letter-spacing: 2px;
    color: #f6f1e8;
    margin-bottom: 14px;
  }
  .pill {
    display: inline-block;
    padding: 8px 22px;
    border-radius: 999px;
    background: rgba(255, 209, 102, 0.14);
    border: 2px solid #ffd166;
    color: #ffd166;
    font-size: 14px;
    font-weight: 800;
    letter-spacing: 3px;
  }
  .tagline {
    position: absolute;
    left: 90px;
    top: 286px;
    font-family: "Bebas Neue", Impact, sans-serif;
    font-size: 78px;
    line-height: 0.98;
    letter-spacing: 1px;
  }
  .tagline div { margin-bottom: 6px; }
  .tagline .accent { color: #ff5a3d; }
  .stat-card {
    position: absolute;
    right: 80px;
    top: 280px;
    width: 380px;
    background: rgba(31, 36, 45, 0.85);
    border: 2px solid rgba(255, 255, 255, 0.10);
    border-radius: 18px;
    padding: 28px;
  }
  .stat-card .label {
    font-size: 14px;
    font-weight: 800;
    color: #ff5a3d;
    letter-spacing: 3px;
    margin-bottom: 8px;
  }
  .stat-card .value {
    font-family: "Bebas Neue", Impact, sans-serif;
    font-size: 96px;
    line-height: 1;
    color: #f6f1e8;
    margin-bottom: 18px;
  }
  .stat-card hr {
    border: 0;
    border-top: 1px solid rgba(255, 255, 255, 0.10);
    margin-bottom: 14px;
  }
  .stat-card .desc {
    font-size: 14px;
    font-weight: 700;
    color: #a9b0bc;
    line-height: 1.35;
  }
  .footer { position: absolute; left: 90px; bottom: 60px; display: flex; gap: 28px; align-items: center; }
  .cat { display: inline-flex; align-items: center; gap: 10px; font-size: 14px; font-weight: 800; color: #a9b0bc; letter-spacing: 2px; }
  .dot { width: 14px; height: 14px; border-radius: 999px; }
  .watermark {
    position: absolute;
    right: 80px;
    bottom: 60px;
    font-size: 14px;
    font-weight: 800;
    color: rgba(255, 255, 255, 0.45);
    letter-spacing: 3px;
  }
</style>
</head>
<body>
  <div class="grid"></div>

  <div class="header">
    <div class="logo-tile">
      <!-- BurnRate flame from src/app/icon.svg, scaled into the 120x120 tile -->
      <svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
        <path d="M33 8c2 10 11 14 14 23 4 13-6 25-20 25S8 47 11 35c2-8 8-10 9-17 6 6 8 10 7 17 7-5 2-15 6-27Z" fill="#ff5a3d"/>
        <path d="M32 39c4 4 5 9 0 14-5-2-8-6-7-11 1-4 5-6 7-12 3 4 5 6 0 9Z" fill="#ffd166"/>
      </svg>
    </div>
    <div class="brand">
      <h1>BURNRATE</h1>
      <span class="pill">FREE · NO SIGN-UP · IN BROWSER</span>
    </div>
  </div>

  <div class="tagline">
    <div>See what your</div>
    <div class="accent">subscriptions</div>
    <div>really cost.</div>
  </div>

  <div class="stat-card">
    <div class="label">MONTHLY BURN</div>
    <div class="value">$184</div>
    <hr />
    <div class="desc">Track every charge. Spot trials before they auto-bill. Simulate cancellations.</div>
  </div>

  <div class="footer">
    <span class="cat"><span class="dot" style="background:#ff5a3d"></span>ENTERTAINMENT</span>
    <span class="cat"><span class="dot" style="background:#ffd166"></span>PRODUCTIVITY</span>
    <span class="cat"><span class="dot" style="background:#37f29b"></span>MUSIC</span>
    <span class="cat"><span class="dot" style="background:#ff435f"></span>CLOUD</span>
  </div>

  <div class="watermark">BURNRATE-BAY.VERCEL.APP</div>
</body>
</html>`;

const outPath = resolve("public", "og-v3.png");

const browser = await puppeteer.launch({
  args: ["--no-sandbox", "--disable-setuid-sandbox"],
});

try {
  const page = await browser.newPage();
  await page.setViewport({ width: 1200, height: 630, deviceScaleFactor: 1 });
  await page.setContent(html, { waitUntil: "networkidle0" });
  // Wait for Google Fonts to finish loading so the screenshot uses Bebas Neue + Manrope, not fallbacks.
  await page.evaluate(() => document.fonts.ready);
  const buffer = await page.screenshot({ type: "png", omitBackground: false });
  await writeFile(outPath, buffer);
  console.log(`Wrote ${outPath} (${buffer.length.toLocaleString()} bytes)`);
} finally {
  await browser.close();
}
