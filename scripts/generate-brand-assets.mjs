/**
 * Genera favicons desde IMG/brand-isotipo-master.png (única fuente oficial).
 * NO sobrescribe brand-isotipo-master.png.
 * NO redibuja el logo: solo escala con transparencia conservada.
 * Open Graph sigue siendo un recurso independiente (logo2 lockup).
 */
import sharp from "sharp";
import path from "node:path";
import { fileURLToPath } from "node:url";
import fs from "node:fs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const img = (...parts) => path.join(root, "public", "IMG", ...parts);
const pub = (...parts) => path.join(root, "public", ...parts);

const TRANSPARENT = { r: 0, g: 0, b: 0, alpha: 0 };
const BRAND_DARK = { r: 12, g: 22, b: 48, alpha: 1 }; // #0c1630 — solo Apple Touch / maskable

const MASTER = img("brand-isotipo-master.png");
if (!fs.existsSync(MASTER)) {
  throw new Error("Falta la fuente oficial: public/IMG/brand-isotipo-master.png");
}

/** Bounding box del contenido no-transparente / no-negro-puro. */
async function contentBBox(input, threshold = 28) {
  const { data, info } = await sharp(input).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
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
      if (data[i + 3] < 16) continue;
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

/**
 * Prepara el master para favicon: recorte al isotipo + padding en canvas transparente.
 * No altera colores ni geometría; no pinta fondo negro.
 */
async function prepareTransparentIsotipo(padRatio = 0.06) {
  const meta = await sharp(MASTER).metadata();
  const bbox = await contentBBox(MASTER);
  const pad = Math.round(Math.max(bbox.width, bbox.height) * 0.03);
  const left = Math.max(0, bbox.left - pad);
  const top = Math.max(0, bbox.top - pad);
  const width = Math.min((meta.width || left + 1) - left, bbox.width + pad * 2);
  const height = Math.min((meta.height || top + 1) - top, bbox.height + pad * 2);

  const cropped = await sharp(MASTER).extract({ left, top, width, height }).ensureAlpha().png().toBuffer();

  const cmeta = await sharp(cropped).metadata();
  const side = Math.max(cmeta.width || width, cmeta.height || height);
  const canvas = Math.round(side * (1 + padRatio * 2));
  const inner = Math.round(side * (1 + padRatio * 0.05));
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
      background: TRANSPARENT,
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

async function writePng(buffer, size, outPath, { sharpenTiny = false, background = TRANSPARENT, flatten = false } = {}) {
  let input = buffer;
  if (flatten) {
    input = await sharp(buffer).ensureAlpha().flatten({ background }).png().toBuffer();
  }

  let pipeline = sharp(input).resize(size, size, {
    fit: "contain",
    background,
    kernel: sharp.kernel.lanczos3,
  });

  if (sharpenTiny && size <= 48) {
    pipeline = pipeline.sharpen({ sigma: size <= 16 ? 0.85 : 0.55, m1: 0.5, m2: 0.4 });
  }

  await pipeline.png({ compressionLevel: 9, adaptiveFiltering: true }).toFile(outPath);
  console.log("wrote", path.relative(root, outPath), `${size}x${size}`);
}

function buildIco(pngBuffers) {
  const count = pngBuffers.length;
  const headerSize = 6 + count * 16;
  let offset = headerSize;
  const entries = [];
  for (const png of pngBuffers) {
    const metaSize = png.readUInt32BE(16);
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

/** OG independiente: no usa el favicon ni altera brand-isotipo-master. */
async function buildOg() {
  const width = 1200;
  const height = 630;
  const ogPath = img("og-cmr-software-solutions.jpg");
  const coverPath = img("og-cover.jpg");

  // Si ya existen, no regenerar (evitar tocar preview sin necesidad)
  if (fs.existsSync(ogPath) && fs.existsSync(coverPath)) {
    console.log("OG intacto (no regenerado):", path.relative(root, ogPath));
    return;
  }

  const backdrop = Buffer.from(`<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#070d1c"/>
      <stop offset="45%" stop-color="#0f1a3a"/>
      <stop offset="100%" stop-color="#0a2f3a"/>
    </linearGradient>
  </defs>
  <rect width="100%" height="100%" fill="url(#bg)"/>
</svg>`);

  const wordmarkPath = img("logo2.png");
  let mark;
  if (fs.existsSync(wordmarkPath)) {
    mark = await sharp(wordmarkPath)
      .resize(980, 420, { fit: "inside", withoutEnlargement: true })
      .png()
      .toBuffer();
  } else {
    mark = await sharp(MASTER).resize(380, 380, { fit: "inside" }).png().toBuffer();
  }
  const mm = await sharp(mark).metadata();
  await sharp(backdrop)
    .composite([
      {
        input: mark,
        left: Math.round((width - (mm.width || 900)) / 2),
        top: Math.round((height - (mm.height || 340)) / 2),
      },
    ])
    .jpeg({ quality: 92, mozjpeg: true })
    .toFile(coverPath);
  await fs.promises.copyFile(coverPath, ogPath);
  console.log("wrote OG covers");
}

// --- main ---
console.log("source (única):", path.relative(root, MASTER));
const isotipoBuf = await prepareTransparentIsotipo(0.06);

// logo.png = copia escalada del master (usos schema), sin fondo negro
await sharp(isotipoBuf)
  .resize(1080, 1080, { fit: "contain", background: TRANSPARENT, kernel: sharp.kernel.lanczos3 })
  .png({ compressionLevel: 9 })
  .toFile(img("logo.png"));
console.log("wrote public/IMG/logo.png");

const transparentSizes = [
  [16, pub("favicon-16x16.png"), true],
  [32, pub("favicon-32x32.png"), true],
  [32, pub("favicon.png"), true],
  [48, pub("favicon-48.png"), true],
  [64, pub("favicon-64x64.png"), true],
  [192, img("icon-192.png"), false],
  [512, img("icon-512.png"), false],
];

for (const [size, out, tiny] of transparentSizes) {
  await writePng(isotipoBuf, size, out, { sharpenTiny: tiny, background: TRANSPARENT });
}

await writePng(isotipoBuf, 180, img("apple-touch-icon.png"), {
  background: BRAND_DARK,
  flatten: true,
});
await writePng(isotipoBuf, 512, img("icon-512-maskable.png"), {
  background: BRAND_DARK,
  flatten: true,
});

const icoPngs = await Promise.all(
  [16, 32, 48].map((s) =>
    sharp(isotipoBuf)
      .resize(s, s, { fit: "contain", background: TRANSPARENT, kernel: sharp.kernel.lanczos3 })
      .sharpen({ sigma: s <= 16 ? 0.85 : 0.5 })
      .png()
      .toBuffer(),
  ),
);
await fs.promises.writeFile(pub("favicon.ico"), buildIco(icoPngs));
console.log("wrote public/favicon.ico");

await writeSvgIcon(pub("favicon-32x32.png"), pub("favicon.svg"), 32);
await writeSvgIcon(img("icon-192.png"), img("icon-192.svg"), 192);
await writeSvgIcon(img("icon-512.png"), img("icon-512.svg"), 512);

await buildOg();

// Verificación de transparencia en esquinas
const check = await sharp(pub("favicon-32x32.png")).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const a0 = check.data[3];
if (a0 !== 0) {
  console.warn("WARN: favicon-32 corner alpha is", a0, "(expected 0)");
} else {
  console.log("OK: favicon-32 corners are transparent");
}

console.log("done — brand-isotipo-master.png NO fue modificado");
