/**
 * Genera favicons e imagen OG a partir del logo oficial CMR (sin recrear marca).
 * - Isotipo: public/IMG/logo.png (cubo C/M/R)
 * - Wordmark: public/IMG/logo2.png
 */
import sharp from "sharp";
import path from "node:path";
import { fileURLToPath } from "node:url";
import fs from "node:fs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const img = (...parts) => path.join(root, "public", "IMG", ...parts);
const pub = (...parts) => path.join(root, "public", ...parts);

const isotipo = img("logo.png");
const wordmark = img("logo2.png");

async function squareIcon(size, out) {
  const buffer = await sharp(isotipo)
    .resize(size, size, { fit: "cover", position: "centre" })
    .png({ compressionLevel: 9, palette: false })
    .toBuffer();
  await fs.promises.writeFile(out, buffer);
  console.log("wrote", path.relative(root, out), size);
}

async function buildOg() {
  const width = 1200;
  const height = 630;

  const backdrop = Buffer.from(`<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0a1228"/>
      <stop offset="45%" stop-color="#121c48"/>
      <stop offset="100%" stop-color="#0f3d48"/>
    </linearGradient>
    <radialGradient id="glowA" cx="22%" cy="30%" r="45%">
      <stop offset="0%" stop-color="#2850c0" stop-opacity="0.35"/>
      <stop offset="100%" stop-color="#2850c0" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="glowB" cx="82%" cy="70%" r="40%">
      <stop offset="0%" stop-color="#178e86" stop-opacity="0.32"/>
      <stop offset="100%" stop-color="#178e86" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="100%" height="100%" fill="url(#bg)"/>
  <rect width="100%" height="100%" fill="url(#glowA)"/>
  <rect width="100%" height="100%" fill="url(#glowB)"/>
  <g opacity="0.12" stroke="#8ec8ff" stroke-width="1">
    ${Array.from({ length: 12 }, (_, i) => {
      const y = 40 + i * 48;
      return `<line x1="0" y1="${y}" x2="${width}" y2="${y}"/>`;
    }).join("")}
  </g>
</svg>`);

  const logoBuf = await sharp(wordmark)
    .resize(920, 360, { fit: "inside", withoutEnlargement: true })
    .png()
    .toBuffer();
  const logoMeta = await sharp(logoBuf).metadata();

  const caption = Buffer.from(`<svg width="${width}" height="80" xmlns="http://www.w3.org/2000/svg">
  <text x="50%" y="34" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="26" font-weight="600" fill="#e8f1ff">Desarrollo de software a medida</text>
  <text x="50%" y="66" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="18" fill="#9eb6d4">San Nicolás de los Arroyos · Buenos Aires · Argentina</text>
</svg>`);

  const left = Math.round((width - (logoMeta.width || 920)) / 2);
  const top = Math.round((height - (logoMeta.height || 360)) / 2) - 28;

  await sharp(backdrop)
    .composite([
      { input: logoBuf, left, top },
      { input: caption, left: 0, top: height - 96 },
    ])
    .jpeg({ quality: 92, mozjpeg: true })
    .toFile(img("og-cover.jpg"));

  console.log("wrote public/IMG/og-cover.jpg");
}

await squareIcon(32, pub("favicon.png"));
await squareIcon(48, pub("favicon-48.png"));
await squareIcon(180, img("apple-touch-icon.png"));
await squareIcon(192, img("icon-192.png"));
await squareIcon(512, img("icon-512.png"));
await buildOg();
