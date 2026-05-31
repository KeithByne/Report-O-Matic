/**
 * Letterhead logo upload rules (before/after Sharp processing).
 */

/** Max incoming multipart file size (bytes). */
export const LETTERHEAD_LOGO_MAX_UPLOAD_BYTES = 4 * 1024 * 1024;

/** Sharp `metadata().format` values we accept after decode. */
export const LETTERHEAD_LOGO_ALLOWED_SHARP_FORMATS = new Set(["jpeg", "jpg", "png", "webp"]);

const ALLOWED_MIME = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/pjpeg",
  "image/jpg",
  "image/x-png",
]);

export function letterheadLogoAllowedMime(mime: string): boolean {
  const m = mime.trim().toLowerCase();
  if (!m || m === "application/octet-stream") return true;
  return ALLOWED_MIME.has(m);
}

export function letterheadLogoAllowedSharpFormat(format: string | undefined): boolean {
  const f = (format ?? "").trim().toLowerCase();
  return LETTERHEAD_LOGO_ALLOWED_SHARP_FORMATS.has(f);
}
