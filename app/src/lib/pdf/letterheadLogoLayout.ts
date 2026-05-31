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

/** Size logo in PDF points: tall → up to 20% page height; wide → 40% header width. */
export function computeLetterheadLogoDrawPt(
  size: LetterheadLogoPixelSize,
  pageWidthPt: number,
  pageHeightPt: number,
  pageMarginPt: number,
): LetterheadLogoDrawPt {
  const headerWidthPt = Math.max(1, pageWidthPt - pageMarginPt * 2);
  const { tallMaxPageHeightRatio, wideHeaderWidthRatio } = PDF_LETTERHEAD_LOGO_SPEC;
  const aspect = size.width / size.height;
  const maxHeightPt = pageHeightPt * tallMaxPageHeightRatio;
  const maxWidthPt = headerWidthPt * wideHeaderWidthRatio;

  let widthPt: number;
  let heightPt: number;

  if (size.height > size.width) {
    heightPt = maxHeightPt;
    widthPt = heightPt * aspect;
    if (widthPt > maxWidthPt) {
      widthPt = maxWidthPt;
      heightPt = widthPt / aspect;
    }
  } else {
    widthPt = maxWidthPt;
    heightPt = widthPt / aspect;
    if (heightPt > maxHeightPt) {
      heightPt = maxHeightPt;
      widthPt = heightPt * aspect;
    }
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
