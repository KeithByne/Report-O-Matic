import { getTenantCreditBalance } from "@/lib/data/credits";
import { watermarkPdfBuffer } from "@/lib/pdf/watermarkPdf";
import { pdfResponseHeaders } from "@/lib/pdf/pdfResponseHeaders";
import { NextResponse } from "next/server";

export function canExportWithCredits(balance: number): boolean {
  return balance > 0;
}

export async function finalizeExportPdf(
  tenantId: string,
  pdf: Buffer,
): Promise<{ pdf: Buffer; watermarked: boolean; creditBalance: number }> {
  const creditBalance = await getTenantCreditBalance(tenantId);
  if (canExportWithCredits(creditBalance)) {
    return { pdf, watermarked: false, creditBalance };
  }
  return {
    pdf: await watermarkPdfBuffer(pdf),
    watermarked: true,
    creditBalance,
  };
}

export async function pdfExportResponse(
  tenantId: string,
  pdf: Buffer,
  opts: { inline: boolean; filename: string },
): Promise<NextResponse> {
  const { pdf: out, watermarked } = await finalizeExportPdf(tenantId, pdf);
  return new NextResponse(new Uint8Array(out), {
    status: 200,
    headers: pdfResponseHeaders({ inline: opts.inline, filename: opts.filename, watermarked }),
  });
}
