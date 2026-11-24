const CSS_VARIABLE = '--footer-height';

let observedFooter: HTMLElement | null = null;
let resizeObserver: ResizeObserver | null = null;

function updateFooterHeight(): void {
  if (!observedFooter) return;
  const height = observedFooter.getBoundingClientRect().height;
  document.documentElement.style.setProperty(CSS_VARIABLE, `${Math.max(0, Math.round(height))}px`);
}

/**
 * Publishes the reader footer's height so drawers and overlays can stop above it.
 * The footer is shorter on narrow screens, so it is measured instead of
 * hard-coded, and re-measured whenever its size changes.
 */
export function registerReaderFooter(element: HTMLElement | null): void {
  if (observedFooter === element) return;
  if (observedFooter && resizeObserver) resizeObserver.unobserve(observedFooter);
  observedFooter = element;

  if (!element) {
    document.documentElement.style.removeProperty(CSS_VARIABLE);
    resizeObserver?.disconnect();
    resizeObserver = null;
    return;
  }

  if (typeof ResizeObserver !== 'undefined') {
    resizeObserver ??= new ResizeObserver(updateFooterHeight);
    resizeObserver.observe(element);
  }
  window.addEventListener('resize', updateFooterHeight);
  updateFooterHeight();
}
