/**
 * Scrolls the window so `element` is brought into the upper portion of the viewport
 * (top under scroll-padding), after layout so conditional panels have mounted.
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

/** Pin element top into the upper portion of the viewport (under scroll-padding). */
function targetScrollYUpper(element: Element): number {
  const rect = element.getBoundingClientRect();
  return window.scrollY + rect.top - scrollMarginPx();
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

  if (durationMs <= 0) {
    window.scrollTo(0, endY);
    return;
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

/**
 * Bring `element` into the upper portion of the window.
 * `block` is accepted for call-site clarity; positioning is always upper/top
 * (same Registers / PDF preview behavior). Use native overflow scrolling separately
 * when the target sits inside a nested scroll container.
 */
export function scrollPanelContentTopIntoView(
  element: Element | null,
  options?: {
    /** Ignored for positioning — always upper/top. Kept so call sites can pass `{ block: "start" }`. */
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
    // Keep the target visible inside nested overflow parents first.
    element.scrollIntoView({ behavior: "auto", block: "nearest", inline: "nearest" });
    const targetY = targetScrollYUpper(element);
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
