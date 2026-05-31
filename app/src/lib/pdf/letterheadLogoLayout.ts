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

/** Logo width ≈50% page; height from aspect ratio (width-first). */
export function computeLetterheadLogoDrawPt(
  size: LetterheadLogoPixelSize,
  pageWidthPt: number,
  pageHeightPt: number,
): LetterheadLogoDrawPt {
  const { logoPageWidthRatio, maxPageHeightRatio } = PDF_LETTERHEAD_LOGO_SPEC;
  const aspect = size.width / size.height;
  const widthPt = pageWidthPt * logoPageWidthRatio;
  let heightPt = widthPt / aspect;
  const maxHeightPt = pageHeightPt * maxPageHeightRatio;
  if (heightPt > maxHeightPt) {
    heightPt = maxHeightPt;
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
  return computeLetterheadLogoDrawPt(size, opts.pageWidthPt, opts.pageHeightPt);
}

export function letterheadLogoFallbackDrawPt(pageWidthPt: number): LetterheadLogoDrawPt {
  const widthPt = pageWidthPt * PDF_LETTERHEAD_LOGO_SPEC.logoPageWidthRatio;
  const { fallbackWidthPt, fallbackHeightPt } = PDF_LETTERHEAD_LOGO_SPEC;
  const aspect = fallbackWidthPt / fallbackHeightPt;
  return {
    widthPt,
    heightPt: Math.max(1, widthPt / aspect),
  };
}
