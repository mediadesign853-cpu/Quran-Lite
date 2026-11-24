const CSS_VARIABLE = '--header-bottom';

let observedHeader: HTMLElement | null = null;
let resizeObserver: ResizeObserver | null = null;

function updateHeaderBottom(): void {
  if (!observedHeader) return;
  const bottom = observedHeader.getBoundingClientRect().bottom;
  document.documentElement.style.setProperty(CSS_VARIABLE, `${Math.max(0, Math.round(bottom))}px`);
}

/**
 * Publishes the reader header's bottom edge so overlays can start underneath it.
 * The header has a different height on narrow screens, so it is measured instead
 * of hard-coded, and it is re-measured whenever its size changes.
 */
export function registerReaderHeader(element: HTMLElement | null): void {
  if (observedHeader === element) return;
  if (observedHeader && resizeObserver) resizeObserver.unobserve(observedHeader);
  observedHeader = element;

  if (!element) {
    document.documentElement.style.removeProperty(CSS_VARIABLE);
    resizeObserver?.disconnect();
    resizeObserver = null;
    return;
  }

  if (typeof ResizeObserver !== 'undefined') {
    resizeObserver ??= new ResizeObserver(updateHeaderBottom);
    resizeObserver.observe(element);
  }
  window.addEventListener('resize', updateHeaderBottom);
  updateHeaderBottom();
}
