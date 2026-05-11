import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import sharp from "sharp";

const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 630" width="1200" height="630">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#0f1115"/>
      <stop offset="100%" stop-color="#171a21"/>
    </linearGradient>
    <radialGradient id="glow1" cx="0.15" cy="0.25" r="0.55">
      <stop offset="0%" stop-color="#ff5a3d" stop-opacity="0.35"/>
      <stop offset="100%" stop-color="#ff5a3d" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="glow2" cx="0.85" cy="0.9" r="0.55">
      <stop offset="0%" stop-color="#37f29b" stop-opacity="0.22"/>
      <stop offset="100%" stop-color="#37f29b" stop-opacity="0"/>
    </radialGradient>
    <pattern id="grid" width="48" height="48" patternUnits="userSpaceOnUse">
      <path d="M 48 0 L 0 0 0 48" fill="none" stroke="#ffffff" stroke-opacity="0.04" stroke-width="1"/>
    </pattern>
    <filter id="flameGlow" x="-50%" y="-50%" width="200%" height="200%">
      <feGaussianBlur stdDeviation="14" result="blur"/>
      <feMerge>
        <feMergeNode in="blur"/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>
  </defs>

  <rect width="1200" height="630" fill="url(#bg)"/>
  <rect width="1200" height="630" fill="url(#grid)"/>
  <rect width="1200" height="630" fill="url(#glow1)"/>
  <rect width="1200" height="630" fill="url(#glow2)"/>

  <!-- Flame icon (BurnRate brand — official Lucide flame path, scaled into the 120x120 tile) -->
  <g transform="translate(90, 86)" filter="url(#flameGlow)">
    <rect width="120" height="120" rx="22" fill="#ff5a3d"/>
    <g transform="translate(20, 20) scale(3.333)">
      <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z" fill="#140b08" fill-rule="evenodd" stroke="#140b08" stroke-width="0.6" stroke-linecap="round" stroke-linejoin="round"/>
    </g>
  </g>

  <!-- BURNRATE word -->
  <text x="240" y="172" font-family="Impact, 'Arial Black', sans-serif" font-size="96" font-weight="900" fill="#f6f1e8" letter-spacing="2">BURNRATE</text>

  <!-- Pill: free no signup -->
  <g transform="translate(240, 200)">
    <rect width="380" height="40" rx="20" fill="rgba(255,209,102,0.14)" stroke="#ffd166" stroke-width="2"/>
    <text x="190" y="27" font-family="'Helvetica Neue', Arial, sans-serif" font-size="14" font-weight="800" fill="#ffd166" text-anchor="middle" letter-spacing="3">FREE · NO SIGN-UP · IN BROWSER</text>
  </g>

  <!-- Tagline -->
  <text x="90" y="346" font-family="Impact, 'Arial Black', sans-serif" font-size="78" font-weight="900" fill="#f6f1e8" letter-spacing="1">See what your</text>
  <text x="90" y="424" font-family="Impact, 'Arial Black', sans-serif" font-size="78" font-weight="900" fill="#ff5a3d" letter-spacing="1">subscriptions</text>
  <text x="90" y="502" font-family="Impact, 'Arial Black', sans-serif" font-size="78" font-weight="900" fill="#f6f1e8" letter-spacing="1">really cost.</text>

  <!-- Right-side stat block -->
  <g transform="translate(740, 280)">
    <rect width="380" height="220" rx="18" fill="rgba(31,36,45,0.85)" stroke="rgba(255,255,255,0.10)" stroke-width="2"/>
    <text x="28" y="50" font-family="'Helvetica Neue', Arial, sans-serif" font-size="14" font-weight="800" fill="#ff5a3d" letter-spacing="3">MONTHLY BURN</text>
    <text x="28" y="140" font-family="Impact, 'Arial Black', sans-serif" font-size="96" font-weight="900" fill="#f6f1e8" letter-spacing="0">$184</text>
    <line x1="28" y1="160" x2="352" y2="160" stroke="rgba(255,255,255,0.10)" stroke-width="1"/>
    <text x="28" y="185" font-family="'Helvetica Neue', Arial, sans-serif" font-size="14" font-weight="700" fill="#a9b0bc">Track every charge. Spot trials before</text>
    <text x="28" y="203" font-family="'Helvetica Neue', Arial, sans-serif" font-size="14" font-weight="700" fill="#a9b0bc">they auto-bill. Simulate cancellations.</text>
  </g>

  <!-- Bottom row: dots/categories -->
  <g transform="translate(90, 552)">
    <circle cx="8" cy="8" r="8" fill="#ff5a3d"/>
    <text x="28" y="14" font-family="'Helvetica Neue', Arial, sans-serif" font-size="14" font-weight="800" fill="#a9b0bc" letter-spacing="2">ENTERTAINMENT</text>

    <circle cx="208" cy="8" r="8" fill="#ffd166"/>
    <text x="228" y="14" font-family="'Helvetica Neue', Arial, sans-serif" font-size="14" font-weight="800" fill="#a9b0bc" letter-spacing="2">PRODUCTIVITY</text>

    <circle cx="408" cy="8" r="8" fill="#37f29b"/>
    <text x="428" y="14" font-family="'Helvetica Neue', Arial, sans-serif" font-size="14" font-weight="800" fill="#a9b0bc" letter-spacing="2">MUSIC</text>

    <circle cx="528" cy="8" r="8" fill="#ff435f"/>
    <text x="548" y="14" font-family="'Helvetica Neue', Arial, sans-serif" font-size="14" font-weight="800" fill="#a9b0bc" letter-spacing="2">CLOUD</text>
  </g>

  <!-- watermark/url -->
  <text x="1110" y="592" font-family="'Helvetica Neue', Arial, sans-serif" font-size="14" font-weight="800" fill="rgba(255,255,255,0.45)" text-anchor="end" letter-spacing="3">BURNRATE-BAY.VERCEL.APP</text>
</svg>`;

const outPath = resolve("public", "og-image.png");
const svgBuffer = Buffer.from(svg);

const pngBuffer = await sharp(svgBuffer, { density: 144 })
  .resize(1200, 630, { fit: "fill" })
  .png({ compressionLevel: 9 })
  .toBuffer();

await writeFile(outPath, pngBuffer);
console.log(`Wrote ${outPath} (${pngBuffer.length.toLocaleString()} bytes)`);
