import sharp from "sharp";
import { PDF_LETTERHEAD_LOGO_SPEC } from "@/lib/pdf/reportPdfLayoutModel";

const MAX_INPUT_PIXELS = 40_000_000;

export type LetterheadLogoPixelSize = { width: number; height: number };

export type LetterheadLogoDrawPt = { widthPt: number; heightPt: number };

export async function readLetterheadLogoPixelSize(buf: Buffer | null): Promise<LetterheadLogoPixelSize | null> {
  if (!buf?.length) return null;
  try {
    const meta = await sharp(buf, { failOn: "error", limitInputPixels: MAX_INPUT_PIXELS }).metadata();
    const width = meta.width ?? 0;
    const height = meta.height ?? 0;
    if (width > 0 && height > 0) return { width, height };
  } catch {
    // fall through
  }
  return null;
}

/** Size logo for PDF: width-first at ~50% page width; height from aspect, capped for tall marks. */
export function computeLetterheadLogoDrawPt(
  size: LetterheadLogoPixelSize,
  pageWidthPt: number,
  pageHeightPt: number,
  _pageMarginPt: number,
): LetterheadLogoDrawPt {
  const { logoPageWidthRatio, maxPageHeightRatio } = PDF_LETTERHEAD_LOGO_SPEC;
  const aspect = size.width / size.height;
  const maxWidthPt = pageWidthPt * logoPageWidthRatio;
  const maxHeightPt = pageHeightPt * maxPageHeightRatio;

  let widthPt = maxWidthPt;
  let heightPt = widthPt / aspect;

  if (heightPt > maxHeightPt) {
    heightPt = maxHeightPt;
    widthPt = heightPt * aspect;
  }

  return {
    widthPt: Math.max(1, widthPt),
    heightPt: Math.max(1, heightPt),
  };
}

export async function resolveLetterheadLogoDrawPt(
  logo: Buffer | null,
  opts: { pageWidthPt: number; pageHeightPt: number; pageMarginPt: number },
): Promise<LetterheadLogoDrawPt | null> {
  const size = await readLetterheadLogoPixelSize(logo);
  if (!size) return null;
  return computeLetterheadLogoDrawPt(size, opts.pageWidthPt, opts.pageHeightPt, opts.pageMarginPt);
}

export function letterheadLogoFallbackDrawPt(): LetterheadLogoDrawPt {
  return {
    widthPt: PDF_LETTERHEAD_LOGO_SPEC.fallbackWidthPt,
    heightPt: PDF_LETTERHEAD_LOGO_SPEC.fallbackHeightPt,
  };
}

/** Scale an ideal logo draw size down to fit a box (preserves aspect ratio). */
export function fitLetterheadLogoToBox(
  ideal: LetterheadLogoDrawPt,
  maxWidthPt: number,
  maxHeightPt: number,
): LetterheadLogoDrawPt {
  if (maxWidthPt <= 0 || maxHeightPt <= 0) return { widthPt: 0, heightPt: 0 };
  const aspect = ideal.widthPt / ideal.heightPt;
  let widthPt = maxWidthPt;
  let heightPt = widthPt / aspect;
  if (heightPt > maxHeightPt) {
    heightPt = maxHeightPt;
    widthPt = heightPt * aspect;
  }
  return { widthPt: Math.max(1, widthPt), heightPt: Math.max(1, heightPt) };
}

/** Actual size when the logo is drawn into the letterhead column slot (matches PDFKit `fit`). */
export function letterheadLogoRenderPt(
  ideal: LetterheadLogoDrawPt,
  slotWidthPt: number,
  maxHeightPt: number,
): LetterheadLogoDrawPt {
  return fitLetterheadLogoToBox(ideal, slotWidthPt, maxHeightPt);
}
