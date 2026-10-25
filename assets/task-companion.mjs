import {createMobileTaskResponse} from './task-mobile-response.mjs?v=task-density-18';
import {createSharedCompanionView} from './companion-events.mjs?v=task-density-18';
export function mountTaskCompanion(root,context){
 const floating=createMobileTaskResponse(root,context);
 const sync=()=>{root.querySelector('#portrait-placeholder').firstElementChild.textContent=matchMedia('(min-width:1024px)').matches?'立繪佔位':'頭像佔位';};context.listen(matchMedia('(min-width:1024px)'),'change',sync);sync();
 const controller=createSharedCompanionView({getContext:()=>({character:null,affinity:null}),render:(reply,actions,meta)=>{root.querySelector('#companion-dialogue').textContent=reply.dialogue;root.querySelector('.companion-portrait').dataset.emotion=reply.emotion;const label=({neutral:'平靜',pleased:'欣喜',calm:'放鬆'})[reply.emotion];root.querySelector('#portrait-emotion').textContent=label;root.querySelector('.companion-portrait').setAttribute('aria-label',`夥伴佔位：${label}，尚未提供正式情緒素材`);floating.reply(actions,meta?.replayed);},onStateChange:state=>{root.querySelector('#companion-status').textContent=state==='ready'?'模擬回應已更新。':'保留上一則對話。';floating.state(state);}},context);
 context.setHooks({onUndoSuccess:()=>controller.cancelPending(),onRedoSuccess:()=>controller.cancelPending()});
}
