// Bounded local measurements only: no values, prompts, keys or persisted records.
const completed=[];let active=null;
export const currentSaveTrace=()=>active;
export function beginSaveTrace(operation,start=performance.now()){
 const trace={operation,start,phases:[],phase(name,began){this.phases.push({name,startMs:Math.max(0,began-this.start),durationMs:Math.max(0,performance.now()-began)});},finish(status){completed.push({operation:this.operation,status,durationMs:performance.now()-this.start,phases:this.phases});if(completed.length>30)completed.shift();if(active===this)active=null;}};active=trace;return trace;
}
export function saveTimings(){return structuredClone(completed);}
export function captureSubmitStart(form){let start=null;form.addEventListener('pointerdown',event=>{if(event.target.closest('button[type=submit]'))start=performance.now();},true);form.addEventListener('pointercancel',()=>{start=null;});form.addEventListener('click',event=>{if(event.target.closest('button[type=submit]'))queueMicrotask(()=>{start=null;});},true);return()=>start??performance.now();}
export function setSaving(form,pending){form.setAttribute('aria-busy',String(pending));const button=form.querySelector('[type=submit]');button.disabled=pending;if(pending){button.dataset.idleText=button.textContent;button.textContent='儲存中…';}else{button.textContent=button.dataset.idleText??button.textContent;delete button.dataset.idleText;}}
