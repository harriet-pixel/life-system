// Dock the mobile chat to the visible viewport without scrolling the document.
export function mountChatViewport(root,context){
 const room=root.querySelector('.chat-room'),area=root.querySelector('#chat-messages'),input=root.querySelector('#chat-input'),panel=root.querySelector('#chat-panel'),placeholder=document.createElement('div');placeholder.className='chat-keyboard-placeholder';placeholder.hidden=true;placeholder.setAttribute('aria-hidden','true');room.before(placeholder);let frame=0,normalHeight=0;
 function restore(){if(!context.active||panel.hidden||document.activeElement!==input||innerWidth>=1024)document.documentElement.classList.remove('chat-input-active');room.classList.remove('is-keyboard-docked');placeholder.hidden=true;}
 function update(){frame=0;const v=window.visualViewport,dock=context.active&&!panel.hidden&&innerWidth<1024&&document.activeElement===input&&document.documentElement.dataset.keyboard==='open'&&!document.querySelector('dialog[open]');if(!dock){restore();return;}
  const latest=area.scrollHeight-area.scrollTop-area.clientHeight<4,top=area.scrollTop;
  if(!room.classList.contains('is-keyboard-docked')){const rect=room.getBoundingClientRect();const normalScale=rect.height/parseFloat(getComputedStyle(room).height)||1;placeholder.style.height=((normalHeight||rect.height)/normalScale)+'px';placeholder.hidden=false;room.style.setProperty('--chat-dock-left',rect.left+'px');room.style.setProperty('--chat-dock-width',rect.width+'px');}
  const bounds=placeholder.getBoundingClientRect();room.style.setProperty('--chat-dock-left',bounds.left+'px');room.style.setProperty('--chat-dock-width',bounds.width+'px');
  const viewportTop=v?.offsetTop??0,viewportHeight=v?.height??innerHeight;
  room.style.setProperty('--chat-dock-top',viewportTop+'px');room.style.setProperty('--chat-dock-height',viewportHeight+'px');room.classList.add('is-keyboard-docked');
  // Reconcile rendered coordinates, rather than assuming one CSS pixel per viewport pixel.
  const actual=room.getBoundingClientRect(),style=getComputedStyle(room),scale=actual.height/parseFloat(style.height)||1;
  room.style.setProperty('--chat-dock-left',(parseFloat(style.left)+(bounds.left-actual.left)/scale)+'px');room.style.setProperty('--chat-dock-width',(bounds.width/scale)+'px');
  room.style.setProperty('--chat-dock-top',(parseFloat(style.top)+(viewportTop-actual.top)/scale)+'px');room.style.setProperty('--chat-dock-height',(viewportHeight/scale)+'px');
  const composer=root.querySelector('.chat-composer');composer.scrollTop=composer.scrollHeight;area.scrollTop=latest?area.scrollHeight:top;
 }
 const schedule=()=>{cancelAnimationFrame(frame);frame=requestAnimationFrame(update);};
 context.listen(window,'resize',schedule);context.listen(document,'focusin',e=>{if(e.target===input&&!room.classList.contains('is-keyboard-docked')){normalHeight=room.getBoundingClientRect().height;if(innerWidth<1024)document.documentElement.classList.add('chat-input-active');}schedule();});context.listen(document,'focusout',schedule);if(window.visualViewport){context.listen(visualViewport,'resize',schedule);context.listen(visualViewport,'scroll',schedule);}
 const observer=new MutationObserver(schedule);const observe=()=>{observer.observe(document.documentElement,{attributes:true,attributeFilter:['data-keyboard']});observer.observe(panel,{attributes:true,attributeFilter:['hidden']});};observe();context.onSuspend(()=>{observer.disconnect();cancelAnimationFrame(frame);restore();});context.onResume(()=>{observe();schedule();});return {update:schedule};
}
