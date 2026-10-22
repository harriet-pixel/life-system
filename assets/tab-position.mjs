// Content tabs only. Call the returned handler after the tab selection changes.
export function createMobileTabPositioner(tablist, beforeMeasure = () => {}) {
  // Positioning threshold only; page and navigation layout breakpoints stay unchanged.
  const mobile = matchMedia('(max-width: 450px)');
  const region = tablist.parentElement;
  region.classList.add('mobile-tab-scroll-region');
  let pendingFrame = 0;
  return function positionAfterClick(event) {
    if (!event.isTrusted || !mobile.matches || document.querySelector('dialog[open]')) return;
    cancelAnimationFrame(pendingFrame);
    pendingFrame = requestAnimationFrame(() => {
      pendingFrame = 0;
      if (!mobile.matches || document.querySelector('dialog[open]')) return;
      beforeMeasure();
      let headerBottom = 0;
      document.querySelectorAll('header, [role="banner"], [data-tab-scroll-header]').forEach(header => {
        const position = getComputedStyle(header).position;
        const rect = header.getBoundingClientRect();
        if (['fixed','sticky'].includes(position) && rect.top <= 12 && rect.bottom > 0) headerBottom = Math.max(headerBottom, rect.bottom);
      });
      const offset = headerBottom + 12;
      const selected = tablist.querySelector('[aria-selected="true"]');
      const alignStart = selected?.dataset.tabScrollAlign === 'start';
      if (alignStart) {
        // History retains its existing top alignment and reserved scroll space.
        region.style.setProperty('--tab-scroll-top-offset', `${offset}px`);
        region.style.setProperty('--tab-scroll-viewport-height', `${innerHeight}px`);
      }
      const tabsRect = tablist.getBoundingClientRect();
      let desired = tabsRect.top + scrollY - offset;
      if (!alignStart) {
        const panel = document.getElementById(selected?.getAttribute('aria-controls'));
        if (!panel || panel.hidden) return;
        const panelRect = panel.getBoundingClientRect();
        const blockTop = Math.min(tabsRect.top, panelRect.top);
        const blockHeight = Math.max(tabsRect.bottom, panelRect.bottom) - blockTop;
        let bottom = innerHeight - 12;
        document.querySelectorAll('.mobile-navigation').forEach(navigation => {
          const rect = navigation.getBoundingClientRect();
          if (getComputedStyle(navigation).position === 'fixed' && rect.height > 0) bottom = Math.min(bottom, rect.top - 12);
        });
        const availableHeight = Math.max(0, bottom - offset);
        if (blockHeight <= availableHeight) {
          desired = blockTop + scrollY - offset - (availableHeight - blockHeight) / 2;
        }
      }
      const maximum = Math.max(0, document.scrollingElement.scrollHeight - innerHeight);
      const target = Math.max(0, Math.min(desired, maximum));
      if (Math.abs(scrollY - target) <= 1) return;
      window.scrollTo({ top: target, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
    });
  };
}
