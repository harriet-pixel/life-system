import {EMOTIONS,defaultAvatarCrop,validateAvatarCrop,imageSignature,imageLimitText} from './character-images-model.mjs?v=daily-polish-20261029';
import {holdDraft} from './coordination.mjs?v=daily-polish-20261029';
import {registerImageReferenceSource} from './image-references.mjs?v=companion-panel-20261029';
import {acquireImageURL,storeImageBlob} from './image-store.mjs?v=daily-polish-20261029';
import {saveCharacterImage} from './character-images-service.mjs?v=companion-panel-20261029';
export function createCharacterImageEditor({root,store,getCharacter,notify,onState}){
 const dialog=document.createElement('dialog');dialog.id='character-image-dialog';dialog.setAttribute('aria-labelledby','character-image-title');
 // Static local markup only; all user values use textContent/property assignment.
 dialog.innerHTML=`<header><h2 id="character-image-title"></h2><button type="button" id="ci-close" aria-label="關閉圖片管理">✕</button></header><div class="ci-body"><p id="ci-limits" class="small-note"></p><label>上傳或替換立繪<input id="ci-file" type="file" accept="image/png,image/jpeg,image/webp"></label><p id="ci-status" class="small-note" role="status"></p><section id="ci-portrait-editor" hidden><h3>調整 3:4 立繪</h3><p class="small-note">拖曳或方向鍵移動；縮放調整範圍。確認後預覽實際結果。</p><canvas id="ci-portrait-canvas" width="300" height="400" tabindex="0" aria-label="3:4 立繪裁切"></canvas><label>立繪縮放<input id="ci-portrait-zoom" type="range" min="1" max="4" step=".01" value="1"></label><button type="button" id="ci-apply-portrait">確認立繪裁切</button><button type="button" id="ci-cancel-portrait">取消這次替換</button></section><section id="ci-avatar-editor" hidden><h3>立繪與獨立頭像裁切</h3><p class="small-note">拖曳正方形或右下角調整大小；方向鍵移動，Shift＋方向鍵調整大小。也可使用下方細部控制。</p><div class="ci-preview-layout"><div id="ci-avatar-source"><img id="ci-portrait-result" alt="實際立繪裁切結果"><div id="ci-square" tabindex="0" role="group" aria-label="正方形頭像裁切框"><span id="ci-resize" aria-hidden="true"></span></div></div><div><span id="ci-avatar-preview" role="img" aria-label="圓形頭像即時預覽"><img alt=""></span></div></div><label>水平位置<input id="ci-x" type="range" min="0" max="1" step=".001"></label><label>垂直位置<input id="ci-y" type="range" min="0" max="1.3333333333333333" step=".001"></label><label>裁切大小<input id="ci-size" type="range" min=".05" max="1" step=".001"></label></section><p id="ci-empty">尚未設定此情緒立繪。儲存圖片前請先上傳。</p><p id="ci-error" role="alert"></p></div><footer><button type="button" id="ci-delete">刪除此情緒圖片</button><button type="button" id="ci-cancel">取消</button><button type="button" id="ci-save">儲存圖片設定</button></footer>`;
 root.append(dialog);const $=s=>dialog.querySelector(s);$('#ci-limits').textContent=imageLimitText;
 let character=null,emotion=null,expected='',trigger=null,release=null,unregister=null,refs=[],lease=null,session=0,jobs=0,changed=false,saving=false;
 let image=null,replacement=null,crop=defaultAvatarCrop(),cropBefore=null,processor=null,portraitEditor=null,uploadSource=null,deleted=false,backdrop=null,drag=null;
 function status(){const pending=jobs>0||saving;for(const node of dialog.querySelectorAll('button,input'))node.disabled=pending;$('#ci-delete').disabled=pending||!character?.imageSettings?.emotions?.[emotion]||deleted;$('#ci-save').disabled=pending||!changed||!$('#ci-portrait-editor').hidden;$('#ci-status').textContent=pending?'圖片處理中，請稍候。':changed?'尚未儲存；取消會還原原圖與裁切設定。':'';onState();}
 const fail=error=>{$('#ci-error').textContent=error.message;};
 async function job(work){const token=session;jobs++;status();try{return await work(token);}catch(error){if(token===session)fail(error);}finally{if(token===session){jobs--;status();}}}
 const active=token=>dialog.open&&token===session;
 function paintCrop(){
  const box=$('#ci-square'),source=$('#ci-avatar-source'),preview=$('#ci-avatar-preview img');
  box.style.left=crop.x*100+'%';box.style.top=crop.y*75+'%';box.style.width=crop.size*100+'%';box.style.height=crop.size*75+'%';
  preview.src=$('#ci-portrait-result').src;preview.style.width=100/crop.size+'%';preview.style.height=400/3/crop.size+'%';preview.style.left=-crop.x/crop.size*100+'%';preview.style.top=-crop.y/crop.size*100+'%';
  for(const k of ['x','y','size'])$('#ci-'+k).value=String(crop[k]);source.dataset.crop=JSON.stringify(crop);
 }
 function changeCrop(next){crop={x:Math.max(0,Math.min(1-next.size,next.x)),y:Math.max(0,Math.min(4/3-next.size,next.y)),size:Math.max(.05,Math.min(1,next.size))};crop.x=Math.min(1-crop.size,crop.x);crop.y=Math.min(4/3-crop.size,crop.y);changed=true;paintCrop();status();}
 for(const k of ['x','y','size'])$('#ci-'+k).oninput=()=>changeCrop({...crop,[k]:Number($('#ci-'+k).value)});
 $('#ci-square').onkeydown=event=>{const steps={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]};if(!steps[event.key])return;event.preventDefault();const [x,y]=steps[event.key];changeCrop(event.shiftKey?{...crop,size:Math.max(.05,Math.min(1,crop.size+(x||y)*.01))}:{...crop,x:crop.x+x*.005,y:crop.y+y*.005});};
 $('#ci-square').onpointerdown=event=>{if(event.button>0||jobs||saving)return;event.preventDefault();event.currentTarget.setPointerCapture(event.pointerId);drag={x:event.clientX,y:event.clientY,crop:{...crop},resize:event.target.id==='ci-resize'};event.currentTarget.focus({preventScroll:true});};
 $('#ci-square').onpointermove=event=>{if(!drag)return;const width=$('#ci-avatar-source').getBoundingClientRect().width,dx=(event.clientX-drag.x)/width,dy=(event.clientY-drag.y)/width;changeCrop(drag.resize?{...drag.crop,size:Math.max(.05,Math.min(1,drag.crop.size+Math.max(dx,dy)))}:{...drag.crop,x:drag.crop.x+dx,y:drag.crop.y+dy});};
 for(const type of ['pointerup','pointercancel','lostpointercapture'])$('#ci-square').addEventListener(type,()=>drag=null);
 async function loadResult(url,token){const value=new Image();value.src=url;await value.decode();if(!active(token))return false;image=value;$('#ci-portrait-result').src=url;$('#ci-avatar-editor').hidden=false;$('#ci-empty').hidden=true;paintCrop();return true;}
 async function processing(){processor??=await import('./character-image-process.mjs?v=daily-polish-20261029');portraitEditor??=processor.createImageCropper({canvas:$('#ci-portrait-canvas'),zoomInput:$('#ci-portrait-zoom'),aspectRatio:3/4,onChange:()=>{changed=true;status();}});return processor;}
 $('#ci-file').onchange=()=>{const file=$('#ci-file').files[0];if(!file)return;const priorChanged=changed;changed=true;$('#ci-error').textContent='';void job(async token=>{const p=await processing(),source=await p.readCharacterImage(file);if(!active(token))return;cropBefore={crop:{...crop},changed:priorChanged};uploadSource=source;portraitEditor.setImage(source);$('#ci-portrait-editor').hidden=false;$('#ci-avatar-editor').hidden=true;$('#ci-empty').hidden=true;});$('#ci-file').value='';};
 $('#ci-apply-portrait').onclick=()=>void job(async token=>{const url=await processor.croppedPortrait(uploadSource,portraitEditor.crop);if(!active(token))return;crop=defaultAvatarCrop();if(!await loadResult(url,token))return;replacement=url;deleted=false;changed=true;$('#ci-portrait-editor').hidden=true;uploadSource=null;portraitEditor.clear();$('#ci-portrait-canvas').width=300;$('#ci-portrait-canvas').height=400;});
 $('#ci-cancel-portrait').onclick=()=>{uploadSource=null;portraitEditor.clear();$('#ci-portrait-editor').hidden=true;$('#ci-avatar-editor').hidden=!image;$('#ci-empty').hidden=Boolean(image);crop=cropBefore?.crop??crop;changed=cropBefore?.changed??false;if(image)paintCrop();status();};
 function finish(){session++;lease?.release();lease=null;release?.();release=null;unregister?.();unregister=null;refs=[];jobs=0;changed=false;saving=false;replacement=null;image=null;uploadSource=null;portraitEditor?.clear();$('#ci-portrait-result').removeAttribute('src');$('#ci-avatar-preview img').removeAttribute('src');$('#ci-portrait-canvas').width=0;$('#ci-portrait-canvas').height=0;character=null;onState();if(trigger?.isConnected)trigger.focus({preventScroll:true});}
 function requestClose(){if(saving)return false;if(changed&&!confirm('捨棄尚未儲存的圖片或頭像裁切？原圖片將保留。'))return false;dialog.close();return true;}
 $('#ci-close').onclick=$('#ci-cancel').onclick=requestClose;
 dialog.addEventListener('cancel',event=>{event.preventDefault();requestClose();});dialog.addEventListener('close',finish);
 const outside=event=>{const r=dialog.getBoundingClientRect();return event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom;};
 dialog.onpointerdown=event=>{backdrop=event.target===dialog&&outside(event)?{x:event.clientX,y:event.clientY}:null;};
 dialog.onpointerup=event=>{if(backdrop&&event.target===dialog&&outside(event)&&Math.hypot(event.clientX-backdrop.x,event.clientY-backdrop.y)<8)requestClose();backdrop=null;};
 $('#ci-delete').onclick=()=>{if(!confirm('刪除此情緒的正式圖片？其他情緒與人格不受影響；儲存後生效。'))return;if(emotion==='neutral'&&EMOTIONS.some(e=>e.id!=='neutral'&&!character.imageSettings?.emotions?.[e.id])){fail(new Error('其他情緒依賴一般立繪備援，請改用替換一般立繪。'));return;}deleted=true;changed=true;$('#ci-avatar-editor').hidden=true;$('#ci-empty').hidden=false;$('#ci-empty').textContent='儲存後移除此情緒圖片；缺圖將使用一般立繪。';status();};
 $('#ci-save').onclick=()=>{if(!changed||jobs||saving)return;saving=true;status();void job(async token=>{
   let id=null,thumbnail=null;if(!deleted){validateAvatarCrop(crop);if(replacement){const blob=await(await fetch(replacement)).blob();id=await storeImageBlob(blob);refs.push(id);const p=await processing();thumbnail=await storeImageBlob(await p.thumbnailBlob(image));refs.push(thumbnail);}else{const item=character.imageSettings?.emotions?.[emotion];if(!item)throw new Error('請先上傳圖片。');id=item.image;thumbnail=item.thumbnail;}}
   if(!active(token))return;await saveCharacterImage(store,{characterId:character.characterId,emotionId:emotion,expectedImages:expected,image:id,thumbnail,crop});
   if(active(token)){changed=false;saving=false;dialog.close();notify('情緒立繪與頭像裁切已儲存。');}
  }).finally(()=>{saving=false;status();});};
 return {
  get open(){return dialog.open;},get dirty(){return changed;},get busy(){return jobs>0||saving;},requestClose,
  async show(id,source){
   const current=getCharacter();if(!current)return;release=await holdDraft('companion');character=structuredClone(current);emotion=id;expected=imageSignature(character);trigger=source;session++;jobs=0;changed=false;deleted=false;replacement=null;image=null;crop=defaultAvatarCrop();
   refs=Object.values(character.imageSettings?.emotions??{}).flatMap(i=>[i.image,i.thumbnail]);unregister=registerImageReferenceSource('角色情緒圖片草稿',()=>refs);
   $('#ci-error').textContent='';$('#ci-title')?.remove();$('#character-image-title').textContent=character.settings.name+' · '+EMOTIONS.find(e=>e.id===id).name;
   $('#ci-empty').textContent='尚未設定此情緒立繪。儲存圖片前請先上傳。';$('#ci-empty').hidden=false;$('#ci-avatar-editor').hidden=true;$('#ci-portrait-editor').hidden=true;$('#ci-portrait-canvas').width=300;$('#ci-portrait-canvas').height=400;
   dialog.showModal();status();const item=character.imageSettings?.emotions?.[id];if(item)await job(async token=>{const acquired=await acquireImageURL(item.image);if(!active(token)){acquired.release();return;}lease=acquired;crop={...item.crop};await loadResult(acquired.url,token);});
  }
 };
}
