// Deferred until the existing shell is ready. No polling, network or AI.
import {dataStore} from './data.mjs?v=wallet-20261031';
let running=false,lastCheck=0;
async function check(){if(running||document.hidden||Date.now()-lastCheck<1000)return;running=true;lastCheck=Date.now();try{await dataStore.settleAffinities();}catch(error){console.warn('好感度結算未完成；原資料保留。',error.message);}finally{running=false;}}
window.addEventListener('focus',()=>void check());document.addEventListener('visibilitychange',()=>{if(!document.hidden)void check();});void check();
