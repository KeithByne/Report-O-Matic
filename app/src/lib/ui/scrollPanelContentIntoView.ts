/**
 * Scrolls the window so `element` is brought into view, after layout so conditional panels have mounted.
 */
export function scrollPanelContentTopIntoView(
  element: Element | null,
  options?: { block?: ScrollLogicalPosition; behavior?: ScrollBehavior },
): void {
  if (!element || typeof window === "undefined") return;
  const block = options?.block ?? "start";
  const behavior = options?.behavior ?? "smooth";
  const run = () => {
    element.scrollIntoView({ behavior, block });
  };
  queueMicrotask(() => {
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(run);
    });
  });
}
