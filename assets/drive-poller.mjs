// A visible tab holds a separate leader lock; every actual request also uses the sync lock.
export function createDrivePoller({eligible,check,locks=navigator.locks,visible=()=>!document.hidden,interval=5000,setTimer=setTimeout,clearTimer=clearTimeout}){
 let timer,release,waiting=false,stopped=false,leader=false,checking=false;
 const clear=()=>{clearTimer(timer);timer=null;};
 async function tick(){clear();if(!leader||!visible()||!eligible()){release?.();return;}if(checking)return;checking=true;let delay=interval;try{const result=await check();delay=Math.max(interval,result?.retryIn??0);}finally{checking=false;if(leader&&visible()&&eligible())timer=setTimer(tick,Math.min(2147483647,delay));else release?.();}}
 async function elect(){if(!locks?.request||stopped||waiting||leader||!visible()||!eligible())return;waiting=true;try{await locks.request('life-system.drive-poll-leader.v1',{ifAvailable:true},async held=>{waiting=false;if(!held)return;leader=true;await new Promise(resolve=>{release=resolve;void tick();});leader=false;release=null;});}finally{waiting=false;if(!stopped&&visible()&&eligible()&&!leader)timer=setTimer(elect,interval);}}
 return {wake(){stopped=false;clear();if(!visible()||!eligible()){release?.();return;}if(leader){if(!checking)void tick();}else void elect();},pause(){clear();release?.();},stop(){stopped=true;clear();release?.();},get leader(){return leader;}};
}
