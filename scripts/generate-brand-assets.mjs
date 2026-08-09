/**
 * Genera favicons + Open Graph desde el isotipo/lockup oficial de CMR.
 * No redibuja el logo: solo recorta, enmarca y escala el archivo oficial.
 */
import sharp from "sharp";
import path from "node:path";
import { fileURLToPath } from "node:url";
import fs from "node:fs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const img = (...parts) => path.join(root, "public", "IMG", ...parts);
const pub = (...parts) => path.join(root, "public", ...parts);

const BLACK = { r: 0, g: 0, b: 0, alpha: 1 };

/**
 * Fuente del isotipo (prioridad):
 * 1) Cubo cromático extraído del lockup oficial logo2.png (alta resolución)
 * 2) PNG/JPEG oficial adjunto brand-official-isotipo.png
 * 3) logo.png existente
 */
async function resolveIsotipoSource() {
  const lockup = img("logo2.png");
  if (fs.existsSync(lockup)) {
    const extracted = img("brand-isotipo-master.png");
    await extractCubeFromLockup(lockup, extracted);
    return extracted;
  }
  const fallbacks = [img("brand-official-isotipo.png"), img("_src-logo-dark.png"), img("logo.png")];
  const hit = fallbacks.find((p) => fs.existsSync(p));
  if (!hit) throw new Error("No se encontró el logo oficial fuente");
  return hit;
}

/** Aísla el cubo CMR del lockup (excluye tipografía plateada). */
async function extractCubeFromLockup(lockupPath, outPath) {
  const { data, info } = await sharp(lockupPath).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const w = info.width;
  const h = info.height;
  const ch = info.channels;
  let minX = w;
  let minY = h;
  let maxX = 0;
  let maxY = 0;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * ch;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const a = data[i + 3];
      if (a < 16) continue;
      const chroma = Math.max(r, g, b) - Math.min(r, g, b);
      const isBrand = chroma > 28 && (b > 80 || g > 90) && (b > r + 10 || g > r + 5);
      if (!isBrand) continue;
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    }
  }

  if (maxX <= minX || maxY <= minY) {
    throw new Error("No se pudo aislar el isotipo desde logo2.png");
  }

  const pad = 24;
  const left = Math.max(0, minX - pad);
  const top = Math.max(0, minY - pad);
  const width = Math.min(w - left, maxX - minX + 1 + pad * 2);
  const height = Math.min(h - top, maxY - minY + 1 + pad * 2);

  await sharp(lockupPath)
    .extract({ left, top, width, height })
    .png()
    .toFile(outPath);
  console.log("extracted isotipo master from logo2.png →", path.relative(root, outPath), `${width}x${height}`);
}

/** Bounding box del contenido no-negro (mantiene glow del isotipo). */
async function contentBBox(filePath, threshold = 36) {
  const { data, info } = await sharp(filePath).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const w = info.width;
  const h = info.height;
  const ch = info.channels;
  let minX = w;
  let minY = h;
  let maxX = 0;
  let maxY = 0;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * ch;
      const a = data[i + 3];
      if (a < 16) continue;
      if (data[i] + data[i + 1] + data[i + 2] > threshold) {
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
    }
  }

  if (maxX <= minX || maxY <= minY) {
    return { left: 0, top: 0, width: w, height: h };
  }

  return {
    left: minX,
    top: minY,
    width: maxX - minX + 1,
    height: maxY - minY + 1,
  };
}

/** Recorta el isotipo y lo centra en un cuadrado negro sin deformar ni hacer zoom-crop. */
async function extractIsotipoSquare(sourcePath, padRatio = 0.1) {
  const meta = await sharp(sourcePath).metadata();
  const bbox = await contentBBox(sourcePath);
  const pad = Math.round(Math.max(bbox.width, bbox.height) * 0.04);
  const left = Math.max(0, bbox.left - pad);
  const top = Math.max(0, bbox.top - pad);
  const width = Math.min((meta.width || left + 1) - left, bbox.width + pad * 2);
  const height = Math.min((meta.height || top + 1) - top, bbox.height + pad * 2);

  const cropped = await sharp(sourcePath).extract({ left, top, width, height }).png().toBuffer();

  const side = Math.max(width, height);
  const canvas = Math.round(side * (1 + padRatio * 2));
  const inner = Math.round(side * (1 + padRatio * 0.15));
  const resized = await sharp(cropped)
    .resize(inner, inner, { fit: "inside", withoutEnlargement: false, kernel: sharp.kernel.lanczos3 })
    .png()
    .toBuffer();
  const rm = await sharp(resized).metadata();

  return sharp({
    create: {
      width: canvas,
      height: canvas,
      channels: 4,
      background: BLACK,
    },
  })
    .composite([
      {
        input: resized,
        left: Math.round((canvas - (rm.width || inner)) / 2),
        top: Math.round((canvas - (rm.height || inner)) / 2),
      },
    ])
    .png()
    .toBuffer();
}

async function writePng(buffer, size, outPath, { sharpenTiny = false } = {}) {
  let pipeline = sharp(buffer).resize(size, size, {
    fit: "contain",
    background: BLACK,
    kernel: sharp.kernel.lanczos3,
  });

  // A tamaños diminutos, un leve sharpen mejora legibilidad sin redibujar el logo.
  if (sharpenTiny && size <= 48) {
    pipeline = pipeline.sharpen({ sigma: size <= 16 ? 0.8 : 0.55, m1: 0.5, m2: 0.4 });
  }

  await pipeline.png({ compressionLevel: 9, adaptiveFiltering: true }).toFile(outPath);
  console.log("wrote", path.relative(root, outPath), `${size}x${size}`);
}

/** ICO multi-tamaño con PNGs embebidos (soportado por navegadores modernos). */
function buildIco(pngBuffers) {
  const count = pngBuffers.length;
  const headerSize = 6 + count * 16;
  let offset = headerSize;
  const entries = [];
  for (const png of pngBuffers) {
    const metaSize = png.readUInt32BE(16); // IHDR width
    const sizeByte = metaSize >= 256 ? 0 : metaSize;
    entries.push({ sizeByte, bytes: png.length, offset, png });
    offset += png.length;
  }

  const buf = Buffer.alloc(offset);
  buf.writeUInt16LE(0, 0);
  buf.writeUInt16LE(1, 2);
  buf.writeUInt16LE(count, 4);
  let entryAt = 6;
  for (const e of entries) {
    buf.writeUInt8(e.sizeByte, entryAt);
    buf.writeUInt8(e.sizeByte, entryAt + 1);
    buf.writeUInt8(0, entryAt + 2);
    buf.writeUInt8(0, entryAt + 3);
    buf.writeUInt16LE(1, entryAt + 4);
    buf.writeUInt16LE(32, entryAt + 6);
    buf.writeUInt32LE(e.bytes, entryAt + 8);
    buf.writeUInt32LE(e.offset, entryAt + 12);
    e.png.copy(buf, e.offset);
    entryAt += 16;
  }
  return buf;
}

async function writeSvgIcon(pngPath, outPath, view = 64) {
  const b64 = fs.readFileSync(pngPath).toString("base64");
  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${view} ${view}" role="img" aria-label="CMR Software Solutions">
  <image href="data:image/png;base64,${b64}" width="${view}" height="${view}" preserveAspectRatio="xMidYMid meet"/>
</svg>
`;
  await fs.promises.writeFile(outPath, svg, "utf8");
  console.log("wrote", path.relative(root, outPath));
}

async function buildOg(isotipoBuf) {
  const width = 1200;
  const height = 630;

  const backdrop = Buffer.from(`<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#070d1c"/>
      <stop offset="45%" stop-color="#0f1a3a"/>
      <stop offset="100%" stop-color="#0a2f3a"/>
    </linearGradient>
    <radialGradient id="g1" cx="28%" cy="45%" r="48%">
      <stop offset="0%" stop-color="#2850c0" stop-opacity="0.32"/>
      <stop offset="100%" stop-color="#2850c0" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="g2" cx="78%" cy="55%" r="46%">
      <stop offset="0%" stop-color="#178e86" stop-opacity="0.30"/>
      <stop offset="100%" stop-color="#178e86" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="100%" height="100%" fill="url(#bg)"/>
  <rect width="100%" height="100%" fill="url(#g1)"/>
  <rect width="100%" height="100%" fill="url(#g2)"/>
</svg>`);

  // Preferir el lockup oficial (isotipo + SOFTWARE SOLUTIONS).
  const wordmarkPath = img("logo2.png");
  let mark;
  let markMeta;
  if (fs.existsSync(wordmarkPath)) {
    // Recortar letterbox del lockup y escalar grande sin deformar.
    const wmMeta = await sharp(wordmarkPath).metadata();
    const wmW = wmMeta.width || 1920;
    const wmH = wmMeta.height || 1080;
    const bbox = await contentBBox(wordmarkPath, 28);
    const padX = Math.round(bbox.width * 0.02);
    const padY = Math.round(bbox.height * 0.04);
    const left = Math.max(0, bbox.left - padX);
    const top = Math.max(0, bbox.top - padY);
    const extract = {
      left,
      top,
      width: Math.min(wmW - left, bbox.width + padX * 2),
      height: Math.min(wmH - top, bbox.height + padY * 2),
    };
    const cropped = await sharp(wordmarkPath).extract(extract).png().toBuffer();
    mark = await sharp(cropped)
      .resize(980, 420, { fit: "inside", withoutEnlargement: true, kernel: sharp.kernel.lanczos3 })
      .png()
      .toBuffer();
  } else {
    mark = await sharp(isotipoBuf).resize(380, 380, { fit: "inside" }).png().toBuffer();
  }
  markMeta = await sharp(mark).metadata();

  const title = Buffer.from(`<svg width="${width}" height="120" xmlns="http://www.w3.org/2000/svg">
  <text x="50%" y="48" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="42" font-weight="700" letter-spacing="6" fill="#f2f6ff">CMR</text>
  <text x="50%" y="92" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="22" font-weight="600" letter-spacing="4" fill="#c5d4ea">SOFTWARE SOLUTIONS</text>
</svg>`);

  // Si el lockup ya incluye "SOFTWARE SOLUTIONS", evitamos duplicar tipografía
  // y usamos solo "CMR" como refuerzo de marca encima del logo oficial.
  const caption = Buffer.from(`<svg width="${width}" height="70" xmlns="http://www.w3.org/2000/svg">
  <text x="50%" y="28" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="34" font-weight="700" letter-spacing="8" fill="#eef4ff">CMR</text>
  <text x="50%" y="58" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="16" fill="#8fa6c4">Desarrollo de software · San Nicolás de los Arroyos</text>
</svg>`);

  const markW = markMeta.width || 900;
  const markH = markMeta.height || 340;
  const markTop = Math.round((height - markH) / 2) + 10;

  await sharp(backdrop)
    .composite([
      { input: caption, left: 0, top: 36 },
      {
        input: mark,
        left: Math.round((width - markW) / 2),
        top: markTop,
      },
    ])
    .jpeg({ quality: 93, mozjpeg: true })
    .toFile(img("og-cover.jpg"));
  console.log("wrote public/IMG/og-cover.jpg");

  // Alias con nombre nuevo para forzar re-fetch en crawlers cacheados.
  await fs.promises.copyFile(img("og-cover.jpg"), img("og-cmr-software-solutions.jpg"));
  console.log("wrote public/IMG/og-cmr-software-solutions.jpg");

  // silence unused in case wordmark missing branch used title
  void title;
}

// --- main ---
const sourcePath = await resolveIsotipoSource();
console.log("source:", path.relative(root, sourcePath));
const isotipoBuf = await extractIsotipoSquare(sourcePath, 0.1);

// Isotipo maestro del sitio (cuadrado, proporciones originales)
await sharp(isotipoBuf)
  .resize(1080, 1080, { fit: "contain", background: BLACK, kernel: sharp.kernel.lanczos3 })
  .png({ compressionLevel: 9 })
  .toFile(img("logo.png"));
console.log("wrote public/IMG/logo.png");

// Favicons / PWA icons — sin zoom-crop (sin deformar el cubo)
const sizes = [
  [16, pub("favicon-16x16.png"), true],
  [32, pub("favicon-32x32.png"), true],
  [32, pub("favicon.png"), true], // compat
  [48, pub("favicon-48.png"), true],
  [64, pub("favicon-64x64.png"), true],
  [180, img("apple-touch-icon.png"), false],
  [192, img("icon-192.png"), false],
  [512, img("icon-512.png"), false],
];

for (const [size, out, tiny] of sizes) {
  await writePng(isotipoBuf, size, out, { sharpenTiny: tiny });
}

// favicon.ico (16 + 32 + 48)
const icoPngs = await Promise.all(
  [16, 32, 48].map((s) =>
    sharp(isotipoBuf)
      .resize(s, s, { fit: "contain", background: BLACK, kernel: sharp.kernel.lanczos3 })
      .sharpen({ sigma: s <= 16 ? 0.8 : 0.5 })
      .png()
      .toBuffer(),
  ),
);
await fs.promises.writeFile(pub("favicon.ico"), buildIco(icoPngs));
console.log("wrote public/favicon.ico");

// SVG = PNG oficial embebido (no se redibuja el isotipo)
await writeSvgIcon(pub("favicon-32x32.png"), pub("favicon.svg"), 32);
await writeSvgIcon(img("icon-192.png"), img("icon-192.svg"), 192);
await writeSvgIcon(img("icon-512.png"), img("icon-512.svg"), 512);

await buildOg(isotipoBuf);

// Cleanup de fuentes temporales si existían
for (const tmp of [img("_src-logo-dark.png"), img("_src-logo-light.png")]) {
  if (fs.existsSync(tmp)) fs.unlinkSync(tmp);
}

console.log("done");
