import sharp from "sharp";

/**
 * Light, symbol-safe preprocessing for scanned pages and photos:
 *  - EXIF orientation correction
 *  - flatten alpha onto white
 *  - deskew (projection-profile search, ±4°)
 *  - trim uniform scanner borders
 *  - gentle contrast normalization (no thresholding, no heavy denoise —
 *    faint superscripts, minus signs and dots must survive)
 *
 * The un-normalized original is always kept alongside for comparison.
 */

export interface NormalizedImage {
  png: Buffer;
  width: number;
  height: number;
  skewDeg: number;
}

async function estimateSkew(input: Buffer): Promise<number> {
  const small = await sharp(input).grayscale().resize({ width: 900, withoutEnlargement: true }).negate().raw().toBuffer({ resolveWithObject: true });
  const { width, height } = small.info;
  let best = 0;
  let bestScore = -1;
  for (let deg = -4; deg <= 4.001; deg += 0.25) {
    const rotated = await sharp(small.data, { raw: { width, height, channels: 1 } })
      .rotate(deg, { background: { r: 0, g: 0, b: 0 } })
      .raw()
      .toBuffer({ resolveWithObject: true });
    const w = rotated.info.width;
    const h = rotated.info.height;
    // Sharp text lines produce strongly varying row sums when perfectly level.
    let prev = 0;
    let score = 0;
    for (let y = 0; y < h; y++) {
      let sum = 0;
      const row = y * w;
      for (let x = 0; x < w; x++) sum += rotated.data[row + x];
      if (y > 0) score += (sum - prev) * (sum - prev);
      prev = sum;
    }
    if (score > bestScore) {
      bestScore = score;
      best = deg;
    }
  }
  return Math.abs(best) < 0.2 ? 0 : best;
}

export async function normalizeScan(input: Buffer, opts: { minHeightPx?: number } = {}): Promise<NormalizedImage> {
  const oriented = await sharp(input).rotate().flatten({ background: "#ffffff" }).png().toBuffer();
  const skewDeg = await estimateSkew(oriented);
  let pipeline = sharp(oriented);
  if (skewDeg !== 0) pipeline = pipeline.rotate(skewDeg, { background: "#ffffff" });
  let buf = await pipeline.png().toBuffer();
  // Trim uniform borders (scanner bed), but never more than the image content.
  try {
    buf = await sharp(buf).trim({ background: "#ffffff", threshold: 25 }).extend({ top: 24, bottom: 24, left: 24, right: 24, background: "#ffffff" }).png().toBuffer();
  } catch {
    // trim throws on a uniform image; keep as is.
  }
  const meta = await sharp(buf).metadata();
  const minH = opts.minHeightPx ?? 2400;
  let out = sharp(buf).normalize({ lower: 1, upper: 99 });
  if ((meta.height ?? 0) < minH) {
    // Modest upscale only (max 2x) — never invent detail beyond the source.
    const factor = Math.min(2, minH / (meta.height ?? minH));
    out = out.resize({ height: Math.round((meta.height ?? minH) * factor), kernel: "lanczos3" });
  }
  const { data, info } = await out.png({ compressionLevel: 6 }).toBuffer({ resolveWithObject: true });
  return { png: data, width: info.width, height: info.height, skewDeg };
}

export async function thumbnail(png: Buffer, width = 360): Promise<Buffer> {
  return sharp(png).resize({ width }).jpeg({ quality: 80 }).toBuffer();
}

/** Data URL for model input, JPEG keeps payloads small while preserving text. */
export async function toDataUrl(png: Buffer, opts: { maxWidth?: number; quality?: number } = {}): Promise<string> {
  let s = sharp(png);
  if (opts.maxWidth) s = s.resize({ width: opts.maxWidth, withoutEnlargement: true });
  const jpg = await s.jpeg({ quality: opts.quality ?? 88, chromaSubsampling: "4:4:4" }).toBuffer();
  return `data:image/jpeg;base64,${jpg.toString("base64")}`;
}

/**
 * Split a page into overlapping full-width horizontal bands. Each band is at
 * most ~2000px wide and ~700px tall so vision models read it at near-native
 * resolution (full pages are downscaled to ~768px on the short side).
 */
export async function horizontalBands(png: Buffer, opts: { bandHeight?: number; overlap?: number; maxWidth?: number } = {}): Promise<string[]> {
  const meta = await sharp(png).metadata();
  const W = meta.width!;
  const H = meta.height!;
  const maxWidth = opts.maxWidth ?? 2000;
  const scale = Math.min(1, maxWidth / W);
  const bandH = Math.round((opts.bandHeight ?? 700) / scale);
  const overlap = Math.round((opts.overlap ?? 60) / scale);
  const out: string[] = [];
  for (let top = 0; top < H; top += bandH - overlap) {
    const h = Math.min(bandH, H - top);
    if (h < overlap * 1.5 && out.length) break;
    const band = await sharp(png).extract({ left: 0, top, width: W, height: h }).png().toBuffer();
    out.push(await toDataUrl(band, { maxWidth }));
    if (top + h >= H) break;
  }
  return out;
}

export async function cropNormalized(png: Buffer, bbox: { x: number; y: number; w: number; h: number }, padFrac = 0.01): Promise<{ png: Buffer; width: number; height: number }> {
  const meta = await sharp(png).metadata();
  const W = meta.width!;
  const H = meta.height!;
  const left = Math.max(0, Math.floor((bbox.x - padFrac) * W));
  const top = Math.max(0, Math.floor((bbox.y - padFrac) * H));
  const right = Math.min(W, Math.ceil((bbox.x + bbox.w + padFrac) * W));
  const bottom = Math.min(H, Math.ceil((bbox.y + bbox.h + padFrac) * H));
  const width = Math.max(1, right - left);
  const height = Math.max(1, bottom - top);
  const out = await sharp(png).extract({ left, top, width, height }).png().toBuffer();
  return { png: out, width, height };
}
