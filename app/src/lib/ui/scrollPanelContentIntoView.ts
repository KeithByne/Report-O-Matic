/**
 * Scrolls the window so `element` is brought into view, after layout so conditional panels have mounted.
 * Smooth scroll uses a custom duration (~2× native) so motion is slower and easier to follow.
 * A newer call cancels any in-flight animated scroll so open-panel and open-PDF do not fight.
 */

const SMOOTH_SCROLL_DURATION_MS = 1000;

let scrollGeneration = 0;
let activeRaf = 0;

function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
}

function scrollMarginPx(): number {
  if (typeof window === "undefined") return 8;
  const raw = getComputedStyle(document.documentElement).scrollPaddingTop;
  const n = parseFloat(raw);
  return Number.isFinite(n) ? n : 8;
}

function targetScrollYForBlock(element: Element, block: ScrollLogicalPosition): number | null {
  const rect = element.getBoundingClientRect();
  const viewH = window.innerHeight;
  const current = window.scrollY;
  const margin = scrollMarginPx();

  if (block === "nearest") {
    if (rect.top >= margin && rect.bottom <= viewH - margin) return null;
    if (rect.top < margin) return current + rect.top - margin;
    return current + rect.bottom - viewH + margin;
  }

  // "start" / "center" / "end": pin the element's top into the upper portion of the viewport.
  return current + rect.top - margin;
}

function animateWindowScrollTo(targetY: number, durationMs: number, generation: number): void {
  const startY = window.scrollY;
  const maxY = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
  const endY = Math.min(maxY, Math.max(0, targetY));
  const delta = endY - startY;
  if (Math.abs(delta) < 2) return;

  if (activeRaf) {
    cancelAnimationFrame(activeRaf);
    activeRaf = 0;
  }

  const start = performance.now();
  const step = (now: number) => {
    if (generation !== scrollGeneration) {
      activeRaf = 0;
      return;
    }
    const t = Math.min(1, (now - start) / durationMs);
    window.scrollTo(0, startY + delta * easeInOutCubic(t));
    if (t < 1) {
      activeRaf = requestAnimationFrame(step);
    } else {
      activeRaf = 0;
    }
  };
  activeRaf = requestAnimationFrame(step);
}

export function scrollPanelContentTopIntoView(
  element: Element | null,
  options?: {
    block?: ScrollLogicalPosition;
    behavior?: ScrollBehavior;
    /** Smooth scroll duration; default ~2× native browser smooth (~1000ms). */
    durationMs?: number;
  },
): void {
  if (!element || typeof window === "undefined") return;
  const block = options?.block ?? "start";
  const behavior = options?.behavior ?? "smooth";
  const durationMs =
    options?.durationMs ?? (behavior === "smooth" ? SMOOTH_SCROLL_DURATION_MS : 0);

  const generation = ++scrollGeneration;

  const run = () => {
    if (generation !== scrollGeneration) return;
    if (!element.isConnected) return;
    if (behavior === "auto" || durationMs <= 0) {
      element.scrollIntoView({ behavior: "auto", block });
      return;
    }
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      element.scrollIntoView({ behavior: "auto", block });
      return;
    }
    const targetY = targetScrollYForBlock(element, block);
    if (targetY === null) return;
    animateWindowScrollTo(targetY, durationMs, generation);
  };

  queueMicrotask(() => {
    if (generation !== scrollGeneration) return;
    window.requestAnimationFrame(() => {
      if (generation !== scrollGeneration) return;
      window.requestAnimationFrame(run);
    });
  });
}
