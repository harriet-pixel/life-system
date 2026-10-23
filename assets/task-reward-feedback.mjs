import {ABILITIES} from './abilities.mjs?v=task-context-7';
// A single, non-persistent playback queue; route changes discard old visuals, never replay them.
export function createRewardFeedback(root,context){
 const queue=[],seen=new Set();let nodes=[],timer,playing=false,sequence=0,layoutCurrent;
 function clear(){clearTimeout(timer);queue.length=0;nodes.forEach(n=>n.remove());nodes=[];playing=false;layoutCurrent=null;}
 context.onSuspend(clear);document.addEventListener('life-system:route-ready',clear);
 const resize=()=>layoutCurrent?.();window.addEventListener('resize',resize);document.fonts.addEventListener('loadingdone',resize);window.visualViewport?.addEventListener('resize',resize);window.visualViewport?.addEventListener('scroll',resize);
 function play(){if(playing||!queue.length)return;playing=true;const lines=queue.shift(),reduced=matchMedia('(prefers-reduced-motion:reduce)').matches,identifier=document.querySelector('#current-page-name'),style=getComputedStyle(identifier??document.body),seed=++sequence;
  nodes=lines.map((line,i)=>{const n=document.createElement('span');n.className='task-reward-text'+(reduced?' is-static':'');n.textContent=line;n.setAttribute('aria-hidden','true');for(const property of ['fontFamily','fontSize','fontWeight','lineHeight','letterSpacing'])n.style[property]=style[property];n.style.animationDelay=(i*110)+'ms';if(!reduced)n.addEventListener('animationend',()=>n.remove(),{once:true});root.append(n);return n;});
  let firstLayout=true;
  layoutCurrent=()=>{nodes=nodes.filter(n=>n.isConnected);if(!nodes.length)return;const current=getComputedStyle(document.querySelector('#current-page-name')??document.body);nodes.forEach(n=>{for(const property of ['fontFamily','fontSize','fontWeight','lineHeight','letterSpacing'])n.style[property]=current[property];});const v=window.visualViewport,w=v?.width??innerWidth,h=v?.height??innerHeight,x=v?.offsetLeft??0,y=v?.offsetTop??0;let rects=nodes.map(n=>n.getBoundingClientRect());const maxWidth=Math.max(...rects.map(r=>r.width)),maxHeight=Math.max(...rects.map(r=>r.height)),columns=maxWidth*2+48<w-24?2:1,maxRows=Math.max(1,Math.floor((h-60+8)/(maxHeight+8))),capacity=columns*maxRows;
   if(nodes.length>capacity){const removed=nodes.splice(capacity);if(firstLayout)queue.unshift(removed.map(n=>n.textContent));removed.forEach(n=>n.remove());rects=rects.slice(0,capacity);}
   const rows=Math.ceil(nodes.length/columns),gap=Math.min(24,Math.max(8,(h-60-rows*maxHeight)/Math.max(1,rows-1))),blockHeight=rows*maxHeight+(rows-1)*gap,start=Math.max(y+Math.min(44,Math.max(0,h-blockHeight-12)),y+(h-blockHeight)/2);
   nodes.forEach((n,i)=>{const col=i%columns,row=Math.floor(i/columns),jitter=((seed+i*7)%3-1)*4,cx=x+w/2+(columns===2?(col-.5)*(maxWidth+32):0)+jitter,top=start+row*(maxHeight+gap)+((i+seed)%2?2:-2);n.style.left=Math.max(x+8,Math.min(cx-rects[i].width/2,x+w-rects[i].width-8))+'px';const safeTop=Math.max(y+4,Math.min(top,y+h-maxHeight-12));n.style.top=safeTop+'px';n.style.setProperty('--reward-rise',Math.max(0,Math.min(36,safeTop-y-4))+'px');});firstLayout=false;};layoutCurrent();
  timer=setTimeout(()=>{nodes.forEach(n=>n.remove());nodes=[];layoutCurrent=null;playing=false;play();},reduced?1600:3000+lines.length*110);
 }
 return completion=>{if(!context.active||!completion||seen.has(completion.id))return;seen.add(completion.id);queue.push([`貨幣 +${completion.reward.currency}`,`經驗值 +${completion.reward.experience}`,...ABILITIES.filter(a=>completion.reward.abilities[a.id]>0).map(a=>`${a.name} +${completion.reward.abilities[a.id]}`)]);play();};
}
