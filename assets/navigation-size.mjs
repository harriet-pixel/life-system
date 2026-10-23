export function navigationDensity(width,height){return height<=420?'tight':height<=600?'compact':'comfortable';}
export function initializeNavigationSize(bar){
 let stable={width:innerWidth,height:innerHeight},frame=0,density=navigationDensity(innerWidth,innerHeight);
 const editable=()=>document.activeElement?.matches('input:not([type=checkbox]):not([type=radio]):not([type=button]),textarea,select,[contenteditable=true]');
 function update(){
  frame=0;const viewport=window.visualViewport,width=innerWidth,height=innerHeight,visualHeight=viewport?.height??height;
  const rotated=Math.abs(width-stable.width)>40;
  const keyboard=editable()&&!rotated&&(!viewport||Math.abs(viewport.scale-1)<.05)&&(stable.height-Math.min(height,visualHeight)>120);
  if(!keyboard){stable={width,height};density=navigationDensity(width,height);}
  document.documentElement.dataset.navDensity=density;
  const inset=keyboard?Math.max(0,height-(viewport?.offsetTop??0)-visualHeight):0;
  document.documentElement.style.setProperty('--keyboard-inset',inset+'px');
  document.documentElement.dataset.keyboard=keyboard?'open':'closed';
  if(keyboard){const input=document.activeElement,rect=input?.getBoundingClientRect(),bottom=(viewport?.offsetTop??0)+visualHeight-bar.getBoundingClientRect().height-12;if(rect&&rect.bottom>bottom)window.scrollBy({top:rect.bottom-bottom,behavior:'instant'});}
 }
 const schedule=()=>{cancelAnimationFrame(frame);frame=requestAnimationFrame(update);};
 window.addEventListener('resize',schedule);window.visualViewport?.addEventListener('resize',schedule);window.visualViewport?.addEventListener('scroll',schedule);document.addEventListener('focusin',schedule);document.addEventListener('focusout',schedule);update();
 return()=>{cancelAnimationFrame(frame);window.removeEventListener('resize',schedule);window.visualViewport?.removeEventListener('resize',schedule);window.visualViewport?.removeEventListener('scroll',schedule);document.removeEventListener('focusin',schedule);document.removeEventListener('focusout',schedule);};
}
