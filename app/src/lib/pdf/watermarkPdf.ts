import { degrees, PDFDocument, rgb, StandardFonts } from "pdf-lib";

const WATERMARK_LINES = [
  "PREVIEW ONLY",
  "Add report credits to print or download",
] as const;

/** Diagonal watermark on every page when the account has no export credits. */
export async function watermarkPdfBuffer(input: Buffer): Promise<Buffer> {
  const doc = await PDFDocument.load(input);
  const font = await doc.embedFont(StandardFonts.HelveticaBold);
  const pages = doc.getPages();

  for (const page of pages) {
    const { width, height } = page.getSize();
    const fontSize = Math.max(14, Math.min(width, height) * 0.038);
    const lineGap = fontSize * 1.35;

    WATERMARK_LINES.forEach((line, index) => {
      const textWidth = font.widthOfTextAtSize(line, fontSize);
      const y = height / 2 + (index === 0 ? lineGap / 2 : -lineGap / 2);
      page.drawText(line, {
        x: width / 2 - textWidth / 2,
        y,
        size: fontSize,
        font,
        color: rgb(0.72, 0.12, 0.12),
        opacity: 0.38,
        rotate: degrees(-32),
      });
    });
  }

  return Buffer.from(await doc.save());
}
