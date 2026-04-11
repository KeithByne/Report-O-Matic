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
