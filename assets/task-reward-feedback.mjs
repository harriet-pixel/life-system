import {ABILITIES} from './abilities.mjs?v=task-fixed-10';
// Only committed local completions enter this document-local, serial visual queue.
export function createRewardFeedback(root,context){
 const queue=[],seen=new Set();let nodes=[],timer,playing=false,layoutCurrent;
 const clear=()=>{clearTimeout(timer);queue.length=0;nodes.forEach(n=>n.remove());nodes=[];playing=false;layoutCurrent=null;};
 context.onSuspend(clear);document.addEventListener('life-system:route-ready',clear);
 const resize=()=>layoutCurrent?.();window.addEventListener('resize',resize);document.fonts.addEventListener('loadingdone',resize);window.visualViewport?.addEventListener('resize',resize);window.visualViewport?.addEventListener('scroll',resize);
 function play(){if(playing||!queue.length)return;playing=true;const lines=queue.shift(),reduced=matchMedia('(prefers-reduced-motion:reduce)').matches;
  nodes=lines.map((line,i)=>{const n=document.createElement('span'),label=document.createElement('span'),amount=document.createElement('strong');n.className='task-reward-text'+(reduced?' is-static':'');n.dataset.rewardKind=line.kind;n.rewardLine=line;n.setAttribute('aria-hidden','true');label.className='task-reward-label';label.textContent=line.name+' ';amount.className='task-reward-amount';amount.textContent='+'+line.value;n.append(label,amount);n.style.animationDelay=i*100+'ms';
   if(!reduced){for(let j=0;j<3;j++){const spark=document.createElement('i');spark.className='task-reward-spark';spark.style.setProperty('--spark-angle',j*120+25+'deg');spark.style.animationDelay=i*100+'ms';n.append(spark);}}
   root.append(n);return n;});
  layoutCurrent=()=>{const current=getComputedStyle(document.querySelector('#current-page-name')??document.body);nodes.forEach(n=>n.style.fontFamily=current.fontFamily);const v=window.visualViewport,w=v?.width??innerWidth,h=v?.height??innerHeight,x=v?.offsetLeft??0,y=v?.offsetTop??0;
   const sizes=nodes.map(n=>({width:n.offsetWidth,height:n.offsetHeight})),maxW=Math.max(...sizes.map(r=>r.width)),maxH=Math.max(...sizes.map(r=>r.height)),cellW=Math.max(100,Math.ceil(maxW*1.12)),cellH=Math.ceil(maxH*1.12)+24,gap=24,columns=cellW*2+gap<=w-24?2:1,maxRows=Math.max(1,Math.floor((h-24+gap)/(cellH+gap))),capacity=columns*maxRows;
   // Extremely short/zoomed viewports show finite phases instead of clipping rewards.
   if(nodes.length>capacity){const removed=nodes.splice(capacity);queue.unshift(removed.map(n=>n.rewardLine));removed.forEach(n=>n.remove());}
   const rows=Math.ceil(nodes.length/columns),blockHeight=rows*cellH+(rows-1)*gap,start=y+(h-blockHeight)/2;
   nodes.forEach((n,i)=>{const row=Math.floor(i/columns),count=Math.min(columns,nodes.length-row*columns),col=i%columns,cx=x+w/2+(col-(count-1)/2)*(cellW+gap);n.style.left=Math.max(x+12,Math.min(cx-sizes[i].width/2,x+w-sizes[i].width-12))+'px';n.style.top=Math.max(y+24,Math.min(start+row*(cellH+gap)+12+(col?4:0),y+h-sizes[i].height-12))+'px';});};layoutCurrent();
  timer=setTimeout(()=>{nodes.forEach(n=>n.remove());nodes=[];playing=false;layoutCurrent=null;play();},reduced?1400:1530+(nodes.length-1)*100);
 }
 return completion=>{if(!context.active||!completion||seen.has(completion.id))return;seen.add(completion.id);queue.push([{name:'貨幣',kind:'currency',value:completion.reward.currency},{name:'經驗值',kind:'experience',value:completion.reward.experience},...ABILITIES.filter(a=>completion.reward.abilities[a.id]>0).map(a=>({name:a.name,kind:a.id,value:completion.reward.abilities[a.id]}))]);play();};
}
