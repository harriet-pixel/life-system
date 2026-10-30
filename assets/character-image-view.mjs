import {resolveCharacterImage} from './character-images-model.mjs?v=restore-images-20261031';
import {acquireImageURL} from './image-store.mjs?v=restore-images-20261031';
// A view owns at most two visible layers and one pending URL. No global cache.
export function createCharacterImageView(target,{avatar=false,thumbnail=false,avatarPixels=0}={}){
 const placeholder=document.createElement('span');placeholder.className='character-image-placeholder';
 // Clone the site's existing neutral icon, without creating another asset.
 const icon=target.querySelector('svg');if(icon)placeholder.append(icon.cloneNode(true));else placeholder.textContent='尚無圖片';
 target.replaceChildren(placeholder);target.classList.add('character-image-view');target.classList.toggle('character-avatar-view',avatar);
 let sequence=0,signature='',layers=[],pending=null,timer=null;
 const clean=layer=>{layer.image.remove();layer.lease.release();};
 function clear(){sequence++;signature='';pending?.release();pending=null;clearTimeout(timer);layers.forEach(clean);layers=[];placeholder.hidden=false;}
 async function show(character,emotion='neutral',transition='fade'){
  const item=resolveCharacterImage(character,emotion),neutral=resolveCharacterImage(character,'neutral');
  const key=JSON.stringify([character?.characterId,item,neutral,transition]);if(key===signature)return;signature=key;const token=++sequence;
  pending?.release();pending=null;clearTimeout(timer);while(layers.length>1)clean(layers.shift());for(const layer of layers)layer.image.style.opacity='1';
  if(!item){layers.forEach(clean);layers=[];placeholder.hidden=false;return;}
  for(const candidate of item===neutral?[item]:[item,neutral].filter(Boolean)){
   let lease;
   try{
    lease=avatar&&avatarPixels?await import('./daily-avatar.mjs?v=restore-images-20261031').then(m=>m.acquireAvatarURL(candidate,avatarPixels)):await acquireImageURL(thumbnail?candidate.thumbnail:candidate.image);
    if(token!==sequence){lease.release();return;}pending=lease;
    const image=new Image();image.alt='';image.decoding='async';image.src=lease.url;await image.decode();
    if(token!==sequence){lease.release();return;}pending=null;
    image.className='character-image-layer';
    if(avatar&&!lease.cropped){const {x,y,size}=candidate.crop;image.style.width=(100/size)+'%';image.style.height=(400/3/size)+'%';image.style.left=(-x/size*100)+'%';image.style.top=(-y/size*100)+'%';}
    const fade=transition==='fade'&&!matchMedia('(prefers-reduced-motion: reduce)').matches;
    image.style.opacity=fade&&layers.length?'0':'1';target.append(image);const layer={image,lease};layers.push(layer);placeholder.hidden=true;
    if(fade&&layers.length>1){image.style.transition='opacity 250ms ease';requestAnimationFrame(()=>{if(token===sequence)image.style.opacity='1';});timer=setTimeout(()=>{while(layers.length>1)clean(layers.shift());},270);}
    else{while(layers.length>1)clean(layers.shift());}return;
   }catch{lease?.release();if(token!==sequence)return;pending=null;}
  }
  if(token===sequence){layers.forEach(clean);layers=[];placeholder.hidden=false;}
 }
 return {show,clear};
}
