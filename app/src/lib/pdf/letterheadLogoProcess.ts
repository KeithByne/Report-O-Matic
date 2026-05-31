import sharp from "sharp";
import {
  LETTERHEAD_LOGO_MAX_UPLOAD_BYTES,
  letterheadLogoAllowedSharpFormat,
} from "@/lib/pdf/letterheadLogoConstraints";

/** Max long edge after resize — ample for PDF letterhead. */
const MAX_RASTER_EDGE_PX = 3200;
const MAX_INPUT_PIXELS = 40_000_000;

export type LetterheadLogoProcess =
  | { ok: true; buffer: Buffer; contentType: "image/png" | "image/jpeg"; ext: "png" | "jpg" }
  | { ok: false; error: string };

async function prepareLetterheadRaster(buf: Buffer): Promise<Buffer> {
  const input = sharp(buf, { failOn: "error", limitInputPixels: MAX_INPUT_PIXELS }).rotate();
  try {
    return await input.clone().trim({ threshold: 12 }).toBuffer();
  } catch {
    return input.toBuffer();
  }
}

/** Trim empty borders before PDF draw (fixes padded exports). Safe to call on every PDF build. */
export async function trimLetterheadLogoForPdf(buf: Buffer): Promise<Buffer> {
  if (!buf.length) return buf;
  try {
    return await prepareLetterheadRaster(buf);
  } catch {
    return buf;
  }
}

export async function processLetterheadLogoUpload(buf: Buffer): Promise<LetterheadLogoProcess> {
  if (buf.length > LETTERHEAD_LOGO_MAX_UPLOAD_BYTES) {
    const mb = LETTERHEAD_LOGO_MAX_UPLOAD_BYTES / (1024 * 1024);
    return { ok: false, error: `Logo file is too large (max ${mb} MB per upload).` };
  }
  if (buf.length < 32) {
    return { ok: false, error: "File too small or corrupted." };
  }

  try {
    const trimmed = await prepareLetterheadRaster(buf);
    const meta = await sharp(trimmed, { failOn: "error", limitInputPixels: MAX_INPUT_PIXELS }).metadata();

    if (!letterheadLogoAllowedSharpFormat(meta.format)) {
      return { ok: false, error: "Unsupported image type. Use PNG, JPEG, or WebP only." };
    }
    if ((meta.pages ?? 1) > 1) {
      return { ok: false, error: "Animated images are not supported. Use a still PNG, JPEG, or WebP." };
    }

    const w = meta.width ?? 0;
    const h = meta.height ?? 0;
    if (w < 16 || h < 16) {
      return { ok: false, error: "Could not read image dimensions. Use PNG, JPEG, or WebP." };
    }

    const hasAlpha =
      meta.hasAlpha === true ||
      meta.channels === 4 ||
      (typeof meta.space === "string" && meta.space.toLowerCase() === "rgba");

    const pipeline = sharp(trimmed, { failOn: "error", limitInputPixels: MAX_INPUT_PIXELS }).resize(
      MAX_RASTER_EDGE_PX,
      MAX_RASTER_EDGE_PX,
      { fit: "inside", withoutEnlargement: true },
    );

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
