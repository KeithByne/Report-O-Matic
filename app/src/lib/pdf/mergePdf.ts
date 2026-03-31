import { PDFDocument } from "pdf-lib";

export async function mergePdfBuffers(buffers: Buffer[]): Promise<Buffer> {
  const out = await PDFDocument.create();
  for (const buf of buffers) {
    if (!buf || buf.length === 0) continue;
    const src = await PDFDocument.load(buf);
    const pages = await out.copyPages(src, src.getPageIndices());
    for (const p of pages) out.addPage(p);
  }
  const bytes = await out.save();
  return Buffer.from(bytes);
}

