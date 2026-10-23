// Measure the existing panels synchronously, offscreen and inaccessible: no clones
// or extra interactive content are introduced, and hidden state is restored before paint.
export function createActivityHeightSync(container, panels, lifecycle) {
  const narrow = matchMedia('(max-width: 450px)');
  let frame = 0;
  function update() {
    cancelAnimationFrame(frame);
    frame = 0;
    if (!narrow.matches) {
      panels.forEach(panel => panel.style.removeProperty('min-height'));
      return;
    }
    const width = container.getBoundingClientRect().width;
    if (!width) return;
    // Keep document height stable while the visible panel is measured offscreen.
    const previousMinimum = container.style.getPropertyValue('min-height');
    container.style.minHeight = `${container.getBoundingClientRect().height}px`;
    const heights = panels.map(panel => {
      const attributes = ['style', 'hidden', 'inert', 'aria-hidden'].map(name => [name, panel.getAttribute(name)]);
      try {
        panel.inert = true;
        panel.setAttribute('aria-hidden', 'true');
        panel.style.cssText += `;position:fixed;left:-100000px;top:0;width:${width}px;min-height:0;height:auto;visibility:hidden;pointer-events:none;display:block;`;
        panel.hidden = false;
        return panel.getBoundingClientRect().height;
      } finally {
        attributes.forEach(([name, value]) => value === null ? panel.removeAttribute(name) : panel.setAttribute(name, value));
      }
    });
    const height = `${Math.ceil(Math.max(0, ...heights))}px`;
    panels.forEach(panel => {
      if (panel.style.minHeight !== height) panel.style.minHeight = height;
    });
    if (previousMinimum) container.style.minHeight = previousMinimum;
    else container.style.removeProperty('min-height');
  }
  function schedule() {
    if(lifecycle&&!lifecycle.active)return;
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(update);
  }
  const resize = new ResizeObserver(schedule);
  const watchResize=()=>{resize.observe(container);panels.forEach(panel=>resize.observe(panel));};
  watchResize();
  const mutations = new MutationObserver(schedule);
  mutations.observe(container, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ['class'] });
  const listen=(target,event,fn)=>lifecycle?lifecycle.listen(target,event,fn):target.addEventListener(event,fn);
  listen(window,'resize',schedule);
  listen(narrow,'change',update);
  document.fonts.ready.then(schedule);
  listen(document.fonts,'loadingdone',schedule);
  lifecycle?.onSuspend(()=>{cancelAnimationFrame(frame);resize.disconnect();mutations.disconnect();});
  lifecycle?.onResume(()=>{watchResize();mutations.observe(container,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['class']});update();});
  update();
  return update;
}
