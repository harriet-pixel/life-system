import {dataStore} from './data.mjs?v=persona-20261029';
import {createMobileTaskResponse} from './task-mobile-response.mjs?v=persona-20261029';
import {createSharedCompanionView} from './companion-events.mjs?v=persona-20261029';
export function mountTaskCompanion(root,context,options={}){
 const floating=createMobileTaskResponse(root,context,options);
 const sync=()=>{root.querySelector('#portrait-placeholder').firstElementChild.textContent=matchMedia('(min-width:1024px)').matches?'立繪佔位':'頭像佔位';};context.listen(matchMedia('(min-width:1024px)'),'change',sync);sync();
 let dailyVisual=null;
 const controller=createSharedCompanionView({getContext:()=>({character:null,affinity:null}),render:(reply,actions,meta)=>{root.querySelector('#companion-dialogue').textContent=reply.dialogue;if(reply.daily){void import('./daily-visuals.mjs?v=storage-rescue-20261028').then(m=>{dailyVisual??=m.mountDailyVisuals(root,context,dataStore);if(context.active)dailyVisual.show(reply);}).catch(()=>{});floating.reply(actions,meta?.replayed);return;}root.querySelector('.companion-portrait').dataset.emotion=reply.emotion;const label=({neutral:'平靜',pleased:'欣喜',calm:'放鬆'})[reply.emotion];root.querySelector('#portrait-emotion').textContent=label;root.querySelector('.companion-portrait').setAttribute('aria-label',`夥伴佔位：${label}，尚未提供正式情緒素材`);floating.reply(actions,meta?.replayed);},onStateChange:state=>{root.querySelector('#companion-status').textContent=['ready','fallback'].includes(state)?'夥伴回應已更新。':['queued','generating'].includes(state)?'正在準備夥伴回應。':'保留上一則對話。';floating.state(state);}},context);
 context.setHooks({onUndoSuccess:()=>controller.cancelPending(),onRedoSuccess:()=>controller.cancelPending()});
}
