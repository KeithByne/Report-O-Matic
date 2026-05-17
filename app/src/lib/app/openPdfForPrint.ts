/** Same-origin API path with `inline=1` for embedding in an iframe on the page. */
export function pdfInlineSrc(url: string, cacheBust?: number): string {
  if (typeof window === "undefined") return url;
  try {
    const u =
      url.startsWith("http://") || url.startsWith("https://")
        ? new URL(url)
        : new URL(url, window.location.origin);
    u.searchParams.set("inline", "1");
    if (cacheBust !== undefined) u.searchParams.set("t", String(cacheBust));
    return u.toString();
  } catch {
    const sep = url.includes("?") ? "&" : "?";
    const t = cacheBust !== undefined ? `&t=${cacheBust}` : "";
    return `${url}${sep}inline=1${t}`;
  }
}

/**
 * Opens a PDF URL in a new browser tab with `inline=1` so the built-in PDF viewer loads
 * (print / save as from the viewer toolbar or Ctrl/Cmd+P).
 */
export function openPdfForPrint(url: string): void {
  if (typeof window === "undefined") return;
  try {
    const u =
      url.startsWith("http://") || url.startsWith("https://")
        ? new URL(url)
        : new URL(url, window.location.origin);
    u.searchParams.set("inline", "1");
    window.open(u.toString(), "_blank", "noopener,noreferrer");
  } catch {
    const withInline = url.includes("?") ? `${url}&inline=1` : `${url}?inline=1`;
    window.open(withInline, "_blank", "noopener,noreferrer");
  }
}
