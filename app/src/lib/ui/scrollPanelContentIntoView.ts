/**
 * Scrolls the window so the top of `element` aligns with the viewport top,
 * after layout so conditional panels have mounted.
 */
export function scrollPanelContentTopIntoView(element: Element | null): void {
  if (!element || typeof window === "undefined") return;
  const run = () => {
    element.scrollIntoView({ behavior: "smooth", block: "start" });
  };
  queueMicrotask(() => {
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(run);
    });
  });
}
