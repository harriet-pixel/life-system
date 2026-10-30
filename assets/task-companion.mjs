import {dataStore} from './data.mjs?v=backup-chat-20261031';
import {createMobileTaskResponse} from './task-mobile-response.mjs?v=backup-chat-20261031';
import {createSharedCompanionView} from './companion-events.mjs?v=backup-chat-20261031';
export function mountTaskCompanion(root,context,options={}){
 const floating=createMobileTaskResponse(root,context,options);
 const sync=()=>{root.querySelector('#portrait-placeholder').firstElementChild.textContent=matchMedia('(min-width:1024px)').matches?'立繪佔位':'頭像佔位';};context.listen(matchMedia('(min-width:1024px)'),'change',sync);sync();
 let dailyVisual=null,visualRequest=0;
 let actorIdentity=null,actorSignature='';
 function showDaily(reply){const request=++visualRequest;void import('./daily-visuals.mjs?v=backup-chat-20261031').then(m=>{if(!context.active||request!==visualRequest)return;dailyVisual??=m.mountDailyVisuals(root,context,dataStore);dailyVisual.show(reply);}).catch(()=>{});}
 context.onSuspend(()=>visualRequest++);
 function showActor(c){if(c)showDaily({characterId:c.characterId,characterCreatedAt:c.createdAt,emotion:'neutral',daily:true});else visualRequest++;}
 context.subscribe(dataStore,({activeCharacter:c})=>{const id=c?c.characterId+':'+c.createdAt:null,signature=JSON.stringify(c);if(signature===actorSignature)return;actorSignature=signature;const previous=actorIdentity;actorIdentity=id;if(previous&&previous!==id)root.querySelector('#companion-dialogue').textContent=c?'已切換出場夥伴：'+c.settings.name:'請先設定出場夥伴。';showActor(c);},{changesOnly:true,keys:['activeCharacter'],distinct:true});
 context.onResume(()=>showActor(dataStore.getFields(['activeCharacter']).activeCharacter));
 const controller=createSharedCompanionView({getContext:()=>({character:null,affinity:null}),render:(reply,actions,meta)=>{root.querySelector('#companion-dialogue').textContent=reply.dialogue;if(reply.daily){showDaily(reply);floating.reply(actions,meta?.replayed);return;}root.querySelector('.companion-portrait').dataset.emotion=reply.emotion;const label=({neutral:'平靜',pleased:'欣喜',calm:'放鬆'})[reply.emotion];root.querySelector('#portrait-emotion').textContent=label;root.querySelector('.companion-portrait').setAttribute('aria-label',`夥伴佔位：${label}，尚未提供正式情緒素材`);floating.reply(actions,meta?.replayed);},onStateChange:state=>{root.querySelector('#companion-status').textContent=['ready','fallback'].includes(state)?'夥伴回應已更新。':['queued','generating'].includes(state)?'正在準備夥伴回應。':'保留上一則對話。';floating.state(state);}},context);

}
