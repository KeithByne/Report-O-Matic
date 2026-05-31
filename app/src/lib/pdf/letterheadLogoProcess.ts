import sharp from "sharp";
import {
  LETTERHEAD_LOGO_MAX_UPLOAD_BYTES,
  letterheadLogoAspectRatioErrorMessage,
  letterheadLogoAspectRatioOk,
} from "@/lib/pdf/letterheadLogoConstraints";

/**
 * Max raster size after resize. PDF slot is landscape 216×72 pt (~3″×1″); up to 4∶1 (3200×800 px) when scaled down.
 */
const MAX_PIXEL_W = 3200;
const MAX_PIXEL_H = 800;
const MAX_INPUT_PIXELS = 40_000_000;

export type LetterheadLogoProcess =
  | { ok: true; buffer: Buffer; contentType: "image/png" | "image/jpeg"; ext: "png" | "jpg" }
  | { ok: false; error: string };

export async function processLetterheadLogoUpload(buf: Buffer): Promise<LetterheadLogoProcess> {
  if (buf.length > LETTERHEAD_LOGO_MAX_UPLOAD_BYTES) {
    const mb = LETTERHEAD_LOGO_MAX_UPLOAD_BYTES / (1024 * 1024);
    return { ok: false, error: `Logo file is too large (max ${mb} MB per upload).` };
  }
  if (buf.length < 32) {
    return { ok: false, error: "File too small or corrupted." };
  }

  try {
    const meta = await sharp(buf, { failOn: "error", limitInputPixels: MAX_INPUT_PIXELS }).rotate().metadata();
    const w = meta.width ?? 0;
    const h = meta.height ?? 0;
    if (!w || !h || w < 16 || h < 16) {
      return { ok: false, error: "Could not read image dimensions. Use PNG, JPEG, or WebP." };
    }
    if (!letterheadLogoAspectRatioOk(w, h)) {
      return { ok: false, error: letterheadLogoAspectRatioErrorMessage() };
    }

    const hasAlpha =
      meta.hasAlpha === true ||
      meta.channels === 4 ||
      (typeof meta.space === "string" && meta.space.toLowerCase() === "rgba");

    const pipeline = sharp(buf, { failOn: "error", limitInputPixels: MAX_INPUT_PIXELS })
      .rotate()
      .resize(MAX_PIXEL_W, MAX_PIXEL_H, { fit: "inside", withoutEnlargement: true });

    if (hasAlpha) {
      const buffer = await pipeline.png({ compressionLevel: 9, effort: 6 }).toBuffer();
      return { ok: true, buffer, contentType: "image/png", ext: "png" };
    }

    const buffer = await pipeline.jpeg({ quality: 88, mozjpeg: true }).toBuffer();
    return { ok: true, buffer, contentType: "image/jpeg", ext: "jpg" };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Could not process image.";
    if (/unsupported|input|metadata|vips|bitmap|format/i.test(msg)) {
      return { ok: false, error: "Unsupported or corrupted image. Use PNG, JPEG, or WebP." };
    }
    return { ok: false, error: msg };
  }
}
