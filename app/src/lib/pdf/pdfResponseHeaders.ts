/** Response headers for generated PDF routes (`inline=1` allows same-origin iframe preview). */
export function pdfResponseHeaders(opts: {
  inline: boolean;
  filename: string;
  watermarked?: boolean;
}): Record<string, string> {
  const { inline, filename, watermarked = false } = opts;
  const headers: Record<string, string> = {
    "Content-Type": "application/pdf",
    "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="${filename}"`,
  };
  if (inline) {
    headers["X-Frame-Options"] = "SAMEORIGIN";
    headers["Content-Security-Policy"] = "frame-ancestors 'self'";
  }
  if (watermarked) {
    headers["X-ROM-Export-Watermarked"] = "1";
  }
  return headers;
}
