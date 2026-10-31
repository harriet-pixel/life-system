import {EMOTIONS,imageLimitText,resolveCharacterImage} from './character-images-model.mjs?v=stats-affinity-20261031';
import {createCharacterImageView} from './character-image-view.mjs?v=stats-affinity-20261031';
export function mountCharacterImages(root,context,{getCharacter,getSettings,store,notify,onState}){
 const section=root.querySelector('#character-images-section'),grid=root.querySelector('#character-image-grid'),selector=root.querySelector('#character-image-transition');
 let editor=null,opening=false,suspended=false,last=null,chatEmotion='neutral';const cards=[];
 const portrait=createCharacterImageView(root.querySelector('.chat-portrait-frame'));
 const header=createCharacterImageView(root.querySelector('[data-avatar-purpose=header-neutral]'),{avatar:true,thumbnail:true});
 const messages=new Map();
 function updateChat(){
  if(suspended||root.querySelector('#chat-panel').hidden)return;
  const c=getCharacter(),transition=getSettings()?.companionImages?.transition??'fade';
  if(innerWidth>=1024)void portrait.show(c,chatEmotion,transition);else portrait.clear();
  void header.show(c,'neutral',transition);
  const nodes=[...root.querySelectorAll('[data-avatar-purpose=message-emotion]')];
  for(const [node,view]of messages)if(!nodes.includes(node)){view.clear();messages.delete(node);}
  for(const node of nodes){if(!messages.has(node))messages.set(node,createCharacterImageView(node,{avatar:true,thumbnail:true}));void messages.get(node).show(c,node.dataset.emotionId??'neutral',transition);}
 }
 function updateCards(){
  if(suspended||(section.matches('details')&&!section.open)||root.querySelector('#character-panel').hidden){for(const card of cards)card.view.clear();return;}
  const c=getCharacter();
  for(const {emotion,view,status,button}of cards){const own=c?.imageSettings?.emotions?.[emotion.id];status.textContent=own?'已設定':resolveCharacterImage(c,emotion.id)?'使用一般立繪':'尚未設定';button.disabled=!c;void view.show(c,emotion.id,'direct');}
 }
 async function open(emotion,trigger){
  if(opening||editor?.open)return;opening=true;onState();
  try{
   if(document.querySelector('dialog[open]'))throw new Error('請先關閉目前視窗。');
   const module=await import('./character-images-editor.mjs?v=stats-affinity-20261031');
   if(!context.active)return;
   editor??=module.createCharacterImageEditor({root,store,getCharacter,notify,onState});await editor.show(emotion,trigger);
  }catch(error){notify(error.message);}finally{opening=false;onState();}
 }
 for(const emotion of EMOTIONS){
  const button=document.createElement('button');button.type='button';button.className='character-image-card';button.dataset.emotion=emotion.id;button.setAttribute('aria-haspopup','dialog');
  const title=document.createElement('strong');title.textContent=emotion.name;const preview=document.createElement('span');preview.className='character-image-thumbnail';const status=document.createElement('span');status.className='small-note';button.append(title,preview,status);grid.append(button);
  const view=createCharacterImageView(preview,{thumbnail:true});cards.push({emotion,view,status,button});button.onclick=()=>void open(emotion.id,button);
 }
 root.querySelector('#character-image-limits').textContent=imageLimitText;
 section.addEventListener('toggle',updateCards);
 selector.onchange=async()=>{
  const value=selector.value;selector.disabled=true;
  try{const state=store.get();await store.transact({type:'character.image-preference',label:'夥伴圖片切換方式',target:'settings',changes:{settings:{...state.settings,companionImages:{transition:value}}},expectedRevision:state.revision,reversible:false});notify('圖片切換方式已儲存。');}
  catch(error){notify(error.message);}finally{selector.disabled=false;selector.value=getSettings()?.companionImages?.transition??'fade';}
 };
 const observer=new MutationObserver(updateChat);observer.observe(root.querySelector('#chat-panel'),{attributes:true,attributeFilter:['hidden']});
 const observer2=new MutationObserver(updateCards);observer2.observe(root.querySelector('#character-panel'),{attributes:true,attributeFilter:['hidden']});
 context.onSuspend(()=>{suspended=true;portrait.clear();header.clear();for(const v of messages.values())v.clear();for(const c of cards)c.view.clear();});
 context.onResume(()=>{suspended=false;updateChat();updateCards();});context.listen(window,'resize',updateChat,{passive:true});
 return {
  update(){const c=getCharacter();last=c;selector.value=getSettings()?.companionImages?.transition??'fade';updateCards();updateChat();},
  hasDraft:()=>Boolean(editor?.dirty),busy:()=>opening||Boolean(editor?.busy),
  beforeSelection:()=>!editor?.open||editor.requestClose(),
  // Explicit test/future display API; never mutates chat data or active role.
  displayEmotion(id){chatEmotion=id;updateChat();},get character(){return last;}
 };
}
