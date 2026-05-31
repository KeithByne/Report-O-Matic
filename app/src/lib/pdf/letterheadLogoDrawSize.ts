import sharp from "sharp";
import { PDF_LETTERHEAD_BLOCK_SPEC_V1 } from "@/lib/pdf/reportPdfLayoutModel";

const MAX_INPUT_PIXELS = 40_000_000;
const lhSpec = PDF_LETTERHEAD_BLOCK_SPEC_V1;

export type LetterheadLogoDrawPt = { widthPt: number; heightPt: number; columnWidthPt: number };

export function letterheadLogoColumnWidthPt(pageWidthPt: number, pageMarginPt: number): number {
  const usableW = pageWidthPt - pageMarginPt * 2;
  return usableW * lhSpec.logoColumnWidthRatio;
}

export function computeLetterheadLogoDrawPt(
  pixelWidth: number,
  pixelHeight: number,
  pageWidthPt: number,
  pageMarginPt: number,
): LetterheadLogoDrawPt {
  const columnWidthPt = letterheadLogoColumnWidthPt(pageWidthPt, pageMarginPt);
  const maxH = lhSpec.logoMaxHeightPt;
  if (pixelWidth < 1 || pixelHeight < 1) {
    return { widthPt: columnWidthPt, heightPt: maxH, columnWidthPt };
  }
  const aspect = pixelWidth / pixelHeight;
  let drawW = columnWidthPt;
  let drawH = drawW / aspect;
  if (drawH > maxH) {
    drawH = maxH;
    drawW = drawH * aspect;
  }
  return {
    widthPt: Math.max(1, drawW),
    heightPt: Math.max(1, drawH),
    columnWidthPt,
  };
}

export async function resolveLetterheadLogoDrawPt(
  logo: Buffer | null,
  pageWidthPt: number,
  pageMarginPt: number,
): Promise<LetterheadLogoDrawPt | null> {
  if (!logo?.length) return null;
  try {
    const meta = await sharp(logo, { failOn: "error", limitInputPixels: MAX_INPUT_PIXELS }).metadata();
    return computeLetterheadLogoDrawPt(meta.width ?? 0, meta.height ?? 0, pageWidthPt, pageMarginPt);
  } catch {
    return computeLetterheadLogoDrawPt(0, 0, pageWidthPt, pageMarginPt);
  }
}
