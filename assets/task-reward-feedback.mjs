import {ABILITIES} from './abilities.mjs?v=task-pool-5';
// Called only by the initiating completion promise, never by subscriptions or replay.
export function createRewardFeedback(root,context){
 const active=new Set(),seen=new Set();
 function clear(){for(const node of active)node.remove();active.clear();}
 context.onSuspend(clear);
 return (completion,anchor)=>{
  if(!context.active||!completion||seen.has(completion.id))return;seen.add(completion.id);
  const lines=[`貨幣 +${completion.reward.currency}`,`經驗值 +${completion.reward.experience}`,...ABILITIES.filter(a=>completion.reward.abilities[a.id]>0).map(a=>`${a.name} +${completion.reward.abilities[a.id]}`)];
  const node=document.createElement('div');node.className='task-reward-feedback';node.setAttribute('aria-hidden','true');lines.forEach(text=>{const line=document.createElement('div');line.textContent=text;node.append(line);});
  const rect=anchor?.getBoundingClientRect(),viewport=window.visualViewport,left=rect?.left??16,top=rect?.top??80;node.style.left=Math.max(8,Math.min(left,innerWidth-208))+'px';node.style.top=Math.max((viewport?.offsetTop??0)+8,Math.min(top,(viewport?.offsetTop??0)+(viewport?.height??innerHeight)-150))+'px';root.append(node);active.add(node);
  if(matchMedia('(prefers-reduced-motion:reduce)').matches)node.classList.add('is-static');
  const remove=()=>{node.remove();active.delete(node);};node.addEventListener('animationend',remove,{once:true});setTimeout(remove,node.classList.contains('is-static')?1800:3200);
 };
}
