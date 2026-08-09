/**
 * Genera favicons + OG desde el isotipo oficial CMR.
 * Objetivo: el cubo ocupe bien el frame (sin quedar minúsculo en Google/tabs).
 */
import sharp from "sharp";
import path from "node:path";
import { fileURLToPath } from "node:url";
import fs from "node:fs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const img = (...parts) => path.join(root, "public", "IMG", ...parts);
const pub = (...parts) => path.join(root, "public", ...parts);

// Preferimos el PNG adjunto (fondo negro, isotipo limpio). Fallback: logo.png
const candidates = [img("_src-logo-dark.png"), img("logo.png")];
const sourcePath = candidates.find((p) => fs.existsSync(p));
if (!sourcePath) throw new Error("No logo source found");

async function extractIsotipo() {
  const meta = await sharp(sourcePath).metadata();
  const { data, info } = await sharp(sourcePath)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const w = info.width;
  const h = info.height;
  let minX = w,
    minY = h,
    maxX = 0,
    maxY = 0;

  // Detectar contenido no-negro (umbral bajo para mantener glow del logo)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * info.channels;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const a = info.channels > 3 ? data[i + 3] : 255;
      if (a < 16) continue;
      if (r + g + b > 28) {
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
    }
  }

  if (maxX <= minX || maxY <= minY) {
    // fallback: centro
    return sharp(sourcePath).resize(1024, 1024, { fit: "contain", background: "#000000" }).png();
  }

  const pad = Math.round(Math.max(maxX - minX, maxY - minY) * 0.06);
  const left = Math.max(0, minX - pad);
  const top = Math.max(0, minY - pad);
  const width = Math.min(w - left, maxX - minX + pad * 2 + 1);
  const height = Math.min(h - top, maxY - minY + pad * 2 + 1);

  const cropped = await sharp(sourcePath)
    .extract({ left, top, width, height })
    .png()
    .toBuffer();

  // Cuadrar sobre negro con padding generoso pero controlado (~10%)
  const side = Math.max(width, height);
  const canvas = side;
  const inner = Math.round(side * 0.86);
  const resized = await sharp(cropped)
    .resize(inner, inner, { fit: "inside", withoutEnlargement: false })
    .png()
    .toBuffer();
  const rm = await sharp(resized).metadata();

  return sharp({
    create: {
      width: canvas,
      height: canvas,
      channels: 3,
      background: { r: 0, g: 0, b: 0 },
    },
  })
    .composite([
      {
        input: resized,
        left: Math.round((canvas - (rm.width || inner)) / 2),
        top: Math.round((canvas - (rm.height || inner)) / 2),
      },
    ])
    .png();
}

async function squareIcon(pipeline, size, out) {
  const buffer = await pipeline
    .clone()
    .resize(size, size, { fit: "cover", position: "centre", kernel: sharp.kernel.lanczos3 })
    .png({ compressionLevel: 9 })
    .toBuffer();
  await fs.promises.writeFile(out, buffer);
  console.log("wrote", path.relative(root, out), `${size}x${size}`);
}

async function buildOg(isotipoBuf) {
  const width = 1200;
  const height = 630;
  const backdrop = Buffer.from(`<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#070d1c"/>
      <stop offset="50%" stop-color="#101a3c"/>
      <stop offset="100%" stop-color="#0c3540"/>
    </linearGradient>
    <radialGradient id="g1" cx="30%" cy="40%" r="50%">
      <stop offset="0%" stop-color="#2850c0" stop-opacity="0.28"/>
      <stop offset="100%" stop-color="#2850c0" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="g2" cx="75%" cy="60%" r="45%">
      <stop offset="0%" stop-color="#178e86" stop-opacity="0.26"/>
      <stop offset="100%" stop-color="#178e86" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="100%" height="100%" fill="url(#bg)"/>
  <rect width="100%" height="100%" fill="url(#g1)"/>
  <rect width="100%" height="100%" fill="url(#g2)"/>
</svg>`);

  // Preferir wordmark oficial si existe
  const wordmarkPath = img("logo2.png");
  let mark;
  if (fs.existsSync(wordmarkPath)) {
    mark = await sharp(wordmarkPath)
      .resize(900, 340, { fit: "inside", withoutEnlargement: true })
      .png()
      .toBuffer();
  } else {
    mark = await sharp(isotipoBuf).resize(360, 360, { fit: "inside" }).png().toBuffer();
  }
  const mm = await sharp(mark).metadata();

  const caption = Buffer.from(`<svg width="${width}" height="90" xmlns="http://www.w3.org/2000/svg">
  <text x="50%" y="36" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="28" font-weight="700" fill="#eef4ff">CMR Software Solutions</text>
  <text x="50%" y="70" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="18" fill="#9eb6d4">Desarrollo de software · San Nicolás de los Arroyos</text>
</svg>`);

  await sharp(backdrop)
    .composite([
      {
        input: mark,
        left: Math.round((width - (mm.width || 900)) / 2),
        top: Math.round((height - (mm.height || 340)) / 2) - 36,
      },
      { input: caption, left: 0, top: height - 100 },
    ])
    .jpeg({ quality: 92, mozjpeg: true })
    .toFile(img("og-cover.jpg"));
  console.log("wrote public/IMG/og-cover.jpg");
}

const isotipoPipeline = await extractIsotipo();
const isotipoBuf = await isotipoPipeline.png().toBuffer();

// Actualizar isotipo maestro del sitio
await sharp(isotipoBuf).resize(1080, 1080, { fit: "cover" }).png().toFile(img("logo.png"));
console.log("wrote public/IMG/logo.png");

const master = sharp(isotipoBuf);
await squareIcon(master, 32, pub("favicon.png"));
await squareIcon(master, 48, pub("favicon-48.png"));
await squareIcon(master, 180, img("apple-touch-icon.png"));
await squareIcon(master, 192, img("icon-192.png"));
await squareIcon(master, 512, img("icon-512.png"));

// Versión “Google”: un poco más zoomed para el círculo de resultados
const googleMark = await sharp(isotipoBuf)
  .resize(512, 512, { fit: "cover", position: "centre" })
  .extend({
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    background: "#000000",
  })
  .png()
  .toBuffer();

// Zoom 112% y recorte central → cubo más grande en el círculo SERP
await sharp(googleMark)
  .resize(Math.round(512 * 1.14), Math.round(512 * 1.14), { fit: "fill" })
  .extract({ left: Math.round((512 * 1.14 - 512) / 2), top: Math.round((512 * 1.14 - 512) / 2), width: 512, height: 512 })
  .png()
  .toFile(img("icon-512.png"));
await sharp(img("icon-512.png")).resize(192, 192).png().toFile(img("icon-192.png"));
await sharp(img("icon-512.png")).resize(180, 180).png().toFile(img("apple-touch-icon.png"));
await sharp(img("icon-512.png")).resize(48, 48).png().toFile(pub("favicon-48.png"));
await sharp(img("icon-512.png")).resize(32, 32).png().toFile(pub("favicon.png"));
console.log("rewrote favicons with SERP-optimized framing");

await buildOg(isotipoBuf);

// limpiar fuentes temporales del workspace copy
for (const tmp of [img("_src-logo-dark.png"), img("_src-logo-light.png")]) {
  if (fs.existsSync(tmp)) fs.unlinkSync(tmp);
}
