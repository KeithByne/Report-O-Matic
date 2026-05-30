/**
 * Letterhead logo rules (before/after Sharp processing).
 * Upload size stays modest so Vercel/serverless request limits are not exceeded; the stored file is smaller still.
 */

/** Max incoming multipart file size (bytes). 4 MB is typical for logo uploads (Slack/WordPress often 2 MB; some sites allow 5–8 MB). */
export const LETTERHEAD_LOGO_MAX_UPLOAD_BYTES = 4 * 1024 * 1024;

/** Min allowed width ÷ height (tall/narrow logo, 1∶6). */
export const LETTERHEAD_LOGO_MIN_ASPECT_WH = 1 / 6;

/** Max allowed width ÷ height (wide logo, 6∶1). */
export const LETTERHEAD_LOGO_MAX_ASPECT_WH = 6;

/** Sharp `metadata().format` values we accept after decode (MIME alone is not trusted). */
export const LETTERHEAD_LOGO_ALLOWED_SHARP_FORMATS = new Set(["jpeg", "jpg", "png", "webp"]);

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

export function letterheadLogoAllowedSharpFormat(format: string | undefined): boolean {
  const f = (format ?? "").trim().toLowerCase();
  return LETTERHEAD_LOGO_ALLOWED_SHARP_FORMATS.has(f);
}

export function letterheadLogoAspectRatioOk(width: number, height: number): boolean {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width < 16 || height < 16) return false;
  const ratio = width / height;
  return ratio >= LETTERHEAD_LOGO_MIN_ASPECT_WH && ratio <= LETTERHEAD_LOGO_MAX_ASPECT_WH;
}

export function letterheadLogoAspectRatioErrorMessage(): string {
  return "Logo proportions must be between 1∶6 and 6∶1 (width ÷ height from about 0.17 to 6). Examples: 600×600 px, 1200×400 px, or 200×1200 px.";
}
