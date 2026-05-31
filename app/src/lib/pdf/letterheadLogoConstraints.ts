/**
 * Letterhead logo rules (before/after Sharp processing).
 * Upload size stays modest so Vercel/serverless request limits are not exceeded; the stored file is smaller still.
 */

/** Max incoming multipart file size (bytes). ~4 MB fits typical Vercel hobby limits after overhead. */
export const LETTERHEAD_LOGO_MAX_UPLOAD_BYTES = 4 * 1024 * 1024;

/** Target landscape ratio width ÷ height (≈ 3∶1 banner). */
export const LETTERHEAD_LOGO_ASPECT_WH = 3;

/** Max |ratio − target| / target — **0.1** ≈ ±10% on width/height proportion (keeps PDF `fit` box stable). */
export const LETTERHEAD_LOGO_ASPECT_TOLERANCE = LETTERHEAD_LOGO_ASPECT_WH * 0.1;

const ALLOWED_MIME = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/pjpeg",
  "image/jpg",
]);

export function letterheadLogoAllowedMime(mime: string): boolean {
  const m = mime.trim().toLowerCase();
  if (!m) return false;
  return ALLOWED_MIME.has(m);
}
