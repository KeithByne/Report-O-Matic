/**
 * Letterhead logo rules (before/after Sharp processing).
 * Upload size stays modest so Vercel/serverless request limits are not exceeded; the stored file is smaller still.
 */

/** Max incoming multipart file size (bytes). ~4 MB fits typical Vercel hobby limits after overhead. */
export const LETTERHEAD_LOGO_MAX_UPLOAD_BYTES = 4 * 1024 * 1024;

/** Min allowed width ÷ height (3∶1 landscape). */
export const LETTERHEAD_LOGO_MIN_ASPECT_WH = 3;

/** Max allowed width ÷ height (4∶1 landscape). */
export const LETTERHEAD_LOGO_MAX_ASPECT_WH = 4;

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

export function letterheadLogoAspectRatioOk(width: number, height: number): boolean {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width < 16 || height < 16) return false;
  const ratio = width / height;
  return ratio >= LETTERHEAD_LOGO_MIN_ASPECT_WH && ratio <= LETTERHEAD_LOGO_MAX_ASPECT_WH;
}

export function letterheadLogoAspectRatioErrorMessage(): string {
  return "Logo must be landscape between 3∶1 and 4∶1 (width ÷ height from 3 to 4). Examples: 1200×400 px or 1600×400 px.";
}
