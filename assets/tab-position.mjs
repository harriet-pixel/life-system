// Content tabs only. Call the returned handler after the tab selection changes.
export function createMobileTabPositioner(tablist) {
  const mobile = matchMedia('(max-width: 1023px)');
  const region = tablist.parentElement;
  region.classList.add('mobile-tab-scroll-region');
  let pendingFrame = 0;
  return function positionAfterClick(event) {
    if (!event.isTrusted || !mobile.matches || document.querySelector('dialog[open]')) return;
    cancelAnimationFrame(pendingFrame);
    pendingFrame = requestAnimationFrame(() => {
      pendingFrame = 0;
      if (!mobile.matches || document.querySelector('dialog[open]')) return;
      let headerBottom = 0;
      document.querySelectorAll('header, [role="banner"], [data-tab-scroll-header]').forEach(header => {
        const position = getComputedStyle(header).position;
        const rect = header.getBoundingClientRect();
        if (['fixed','sticky'].includes(position) && rect.top <= 12 && rect.bottom > 0) headerBottom = Math.max(headerBottom, rect.bottom);
      });
      const offset = headerBottom + 12;
      region.style.setProperty('--tab-scroll-top-offset', `${offset}px`);
      region.style.setProperty('--tab-scroll-viewport-height', `${innerHeight}px`);
      // Reserve enough space below even a short/empty panel to reach the target.
      const desired = tablist.getBoundingClientRect().top + scrollY - offset;
      const maximum = Math.max(0, document.scrollingElement.scrollHeight - innerHeight);
      const target = Math.max(0, Math.min(desired, maximum));
      if (Math.abs(scrollY - target) <= 1) return;
      window.scrollTo({ top: target, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
    });
  };
}
