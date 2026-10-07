/**
 * Scrolls the window so `element` sits a fixed offset from the top of the viewport.
 * Smooth scroll uses a custom duration; a newer call cancels any in-flight animation.
 * Remeasures during motion so late-mounted content (PDF under a card) still lands at 25px.
 */

const SMOOTH_SCROLL_DURATION_MS = 1000;
/** Distance from the top of the viewing window to the active panel / PDF. */
export const VIEWPORT_TOP_OFFSET_PX = 25;

let scrollGeneration = 0;
let activeRaf = 0;

function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
}

function targetScrollYForElement(element: Element): number {
  const rect = element.getBoundingClientRect();
  return window.scrollY + rect.top - VIEWPORT_TOP_OFFSET_PX;
}

function clampScrollY(y: number): number {
  const maxY = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
  return Math.min(maxY, Math.max(0, y));
}

function animateWindowScrollToElement(
  element: Element,
  durationMs: number,
  generation: number,
): void {
  if (activeRaf) {
    cancelAnimationFrame(activeRaf);
    activeRaf = 0;
  }

  const startY = window.scrollY;
  let endY = clampScrollY(targetScrollYForElement(element));
  const initialDelta = endY - startY;
  if (Math.abs(initialDelta) < 2 && durationMs <= 0) return;

  if (durationMs <= 0) {
    window.scrollTo(0, endY);
    // One corrective jump after layout can settle (e.g. PDF chrome mounting).
    window.setTimeout(() => {
      if (generation !== scrollGeneration || !element.isConnected) return;
      window.scrollTo(0, clampScrollY(targetScrollYForElement(element)));
    }, 120);
    return;
  }

  const start = performance.now();
  const step = (now: number) => {
    if (generation !== scrollGeneration) {
      activeRaf = 0;
      return;
    }
    if (!element.isConnected) {
      activeRaf = 0;
      return;
    }

    // Remeasure so expanding content below the fold still aims for 25px from top.
    endY = clampScrollY(targetScrollYForElement(element));
    const t = Math.min(1, (now - start) / durationMs);
    const eased = easeInOutCubic(t);
    // Blend from the original start toward the latest target (not a stale endY).
    window.scrollTo(0, startY + (endY - startY) * eased);

    if (t < 1) {
      activeRaf = requestAnimationFrame(step);
    } else {
      activeRaf = 0;
      // Final snap after iframe/list height changes.
      window.setTimeout(() => {
        if (generation !== scrollGeneration || !element.isConnected) return;
        window.scrollTo(0, clampScrollY(targetScrollYForElement(element)));
      }, 150);
    }
  };
  activeRaf = requestAnimationFrame(step);
}

/**
 * Bring `element` to 25px from the top of the viewing window.
 * `block` is accepted for call-site clarity; positioning is always that fixed offset.
 */
export function scrollPanelContentTopIntoView(
  element: Element | null,
  options?: {
    /** Ignored for positioning — always 25px from top. */
    block?: ScrollLogicalPosition;
    behavior?: ScrollBehavior;
    /** Smooth scroll duration; default ~2× native browser smooth (~1000ms). */
    durationMs?: number;
  },
): void {
  if (!element || typeof window === "undefined") return;
  const behavior = options?.behavior ?? "smooth";
  const prefersReduced =
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const durationMs =
    behavior === "auto" || prefersReduced
      ? 0
      : (options?.durationMs ?? SMOOTH_SCROLL_DURATION_MS);

  const generation = ++scrollGeneration;

  const run = () => {
    if (generation !== scrollGeneration) return;
    if (!element.isConnected) return;
    animateWindowScrollToElement(element, durationMs, generation);
  };

  // Wait for React layout of newly opened panels under the same card.
  queueMicrotask(() => {
    if (generation !== scrollGeneration) return;
    window.requestAnimationFrame(() => {
      if (generation !== scrollGeneration) return;
      window.requestAnimationFrame(run);
    });
  });
}
