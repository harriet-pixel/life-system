import {createImageCropper,readImageFile,decodeImage} from './avatar-crop.mjs?v=task-mobile-15';
import {imageURL} from './image-store.mjs';
export function createProfileImages({root=document,onError,onSelect,onBusy=()=>{}}) {
  const $=selector=>root.querySelector(selector);
  let session=0,jobs=0,opened=false,base,photo,avatar,portraits=[],currentId=null,manualAvatar=false,newPhoto=false,slotTarget=null;
  let editingPhoto=false,editingAvatar=false,collectionMode=false,pendingCollection=null,collectionSlot=null,photoWorkingBase=null,avatarWorkingBase=null;
  let photoVersion=0,uploadVersion=0,avatarVersion=0,photoError='',avatarError='';
  const updateBusy=()=>{const busy=jobs>0;onBusy(busy);$('#image-status').hidden=!busy;$('#image-status').textContent=busy?'圖片處理中，請稍候。':'';$('#crop-from-photo').disabled=!photo?.result||busy;$('#add-favorite').disabled=!photo?.result||editingPhoto||busy;};
  async function job(work){const token=session;jobs++;updateBusy();try{return await work(token);}finally{if(token===session){jobs--;updateBusy();}}}
  const active=token=>opened&&token===session;
  const fail=(field,error,index=field==='avatar'?1:0)=>{if(!opened)return;if(field==='avatar')avatarError=error.message;else if(field==='photo')photoError=error.message;onError(field,error.message,index);};
  const portraitEditor=createImageCropper({canvas:$('#portrait-canvas'),zoomInput:$('#portrait-zoom'),aspectRatio:3/4});
  const avatarEditor=createImageCropper({canvas:$('#crop-canvas'),zoomInput:$('#crop-zoom'),square:true,onChange:()=>{if(opened&&editingAvatar){manualAvatar=true;avatarVersion++;}}});
  const collectionEditor=createImageCropper({canvas:$('#collection-canvas'),zoomInput:$('#collection-zoom'),aspectRatio:3/4});
  function setEditing(kind,value){if(kind==='photo'){if(value&&!editingPhoto)photoWorkingBase=portraitEditor.crop;editingPhoto=value;}else{if(value&&!editingAvatar)avatarWorkingBase=avatarEditor.crop;editingAvatar=value;}renderDraft();}
  $('#start-portrait-crop').addEventListener('click',()=>setEditing('photo',true));
  $('#start-avatar-crop').addEventListener('click',()=>setEditing('avatar',true));
  $('#cancel-portrait-crop').addEventListener('click',()=>{job(async token=>{if(photo){const image=await decodeImage(await imageURL(photo.source));if(!active(token))return;portraitEditor.setImage(image,{crop:photo.crop});}setEditing('photo',false);}).catch(error=>fail('photo',error));});
  $('#cancel-avatar-crop').addEventListener('click',()=>{job(async token=>{if(avatar){const image=await decodeImage(await imageURL(avatar.source));if(!active(token))return;avatarEditor.setImage(image,{crop:avatar.crop});}setEditing('avatar',false);}).catch(error=>fail('avatar',error));});
  $('#confirm-portrait-crop').addEventListener('click',async()=>{if(!photo)return;const token=session;photoError='';$('#photo-error').textContent='';photo.changed=true;photo.dirty=true;photoVersion++;try{await flushPhoto();if(active(token))setEditing('photo',false);}catch(error){if(active(token))fail('photo',error);}});
  $('#confirm-avatar-crop').addEventListener('click',async()=>{if(!avatar)return;const token=session;avatarError='';$('#avatar-error').textContent='';try{await job(async token=>{const model=avatar,result=await avatarEditor.export();if(!active(token)||avatar!==model)return;Object.assign(avatar,{result,crop:avatarEditor.crop,changed:true});manualAvatar=true;avatarVersion++;setEditing('avatar',false);});}catch(error){if(active(token))fail('avatar',error);}});
  $('#cancel-collection').addEventListener('click',()=>{pendingCollection=null;collectionEditor.clear();$('#collection-editor').hidden=true;});
  $('#confirm-collection').addEventListener('click',async()=>{if(!pendingCollection)return;const token=session,model=pendingCollection;try{await job(async token=>{const result=await collectionEditor.export();if(!active(token)||pendingCollection!==model)return;const {imageFingerprint}=await import('./image-store.mjs');const fingerprint=await imageFingerprint(result);if(!active(token))return;const existingFingerprints=await Promise.all(portraits.filter(p=>p.id!==model.target).map(p=>imageFingerprint(p.image)));if(!active(token))return;if(existingFingerprints.includes(fingerprint))throw new Error('這張圖片已在最愛中。');if(!portraits.some(item=>item.id===model.target)&&portraits.length>=6)throw new Error('最多保存 6 個立繪，請先刪除或更換。');const slots=librarySlots(),existing=slots.findIndex(item=>item?.id===model.target),available=Number.isInteger(model.slot)&&!slots[model.slot]?model.slot:slots.indexOf(null);const item={id:model.target??crypto.randomUUID(),slot:existing>=0?existing:available,source:model.source,image:result,crop:collectionEditor.crop},index=portraits.findIndex(p=>p.id===item.id);if(index<0)portraits.push(item);else portraits[index]=item;pendingCollection=null;$('#portraits-error').textContent='';$('#collection-editor').hidden=true;collectionEditor.clear();updateLibrary();$('#portrait-library').children[item.slot]?.querySelector('button').focus();});}catch(error){if(active(token))fail('portraits',error,2);}});
  async function paintImage(target,reference){
    const token=session;target.dataset.reference=reference??'';
    if(!reference){target.hidden=true;target.removeAttribute('src');return;}
    try{const url=await imageURL(reference);if(active(token)&&target.dataset.reference===reference){target.src=url;target.hidden=false;}}
    catch(error){if(active(token)&&target.dataset.reference===reference&&target.isConnected)throw error;}
  }

  const actionDialog=$('#portrait-actions-dialog');
  let actionId=null,actionTrigger=null;
  function librarySlots(){
    const slots=Array(6).fill(null),unplaced=[];
    for(const item of portraits){if(Number.isInteger(item.slot)&&item.slot>=0&&item.slot<6&&!slots[item.slot])slots[item.slot]=item;else unplaced.push(item);}
    for(const item of unplaced){const index=slots.indexOf(null);if(index>=0)slots[index]=item;}
    return slots;
  }
  function updateLibrary(){
    $('#portrait-library').dataset.count=String(portraits.length);
    $('#portrait-library').replaceChildren(...Array.from({length:6},(_,index)=>{
      const item=librarySlots()[index],row=document.createElement('li');row.dataset.slot=String(index);
      const button=document.createElement('button');button.type='button';
      if(item){
        row.dataset.portraitId=item.id;button.className='portrait-thumbnail';button.dataset.openPortrait=item.id;
        button.setAttribute('aria-haspopup','dialog');button.setAttribute('aria-label',`立繪 ${index+1}${item.id===currentId?'，目前使用':''}，開啟操作`);
        const image=document.createElement('img');image.alt=`立繪 ${index+1}`;paintImage(image,item.image).catch(error=>fail('portraits',error,2));button.append(image);
      }else{button.dataset.action='add';button.textContent='選用';button.setAttribute('aria-label',`選用圖片至立繪位置 ${index+1}`);}
      row.append(button);return row;
    }));
  }
  actionDialog.addEventListener('close',()=>{if(actionTrigger?.isConnected&&$('#profile-dialog').open)actionTrigger.focus({preventScroll:true});actionTrigger=null;});
  $('#close-portrait-actions').addEventListener('click',()=>actionDialog.close());
  function renderDraft(){
    $('#draft-photo-empty').hidden=Boolean(photo?.result);$('#portrait-editor').hidden=!photo?.result||!editingPhoto;$('#start-portrait-crop').hidden=false;$('#start-portrait-crop').disabled=!photo?.result||editingPhoto;
    $('#choose-photo').textContent='更換';
    $('#add-favorite').disabled=!photo?.result||editingPhoto||jobs>0;
    $('#favorite-help').textContent=editingPhoto?'請先確認或取消立繪裁切，再添加到最愛。':!photo?.result?'請先選擇立繪，再添加到最愛。':'';
    $('#draft-avatar-empty').hidden=Boolean(avatar?.result)||avatarEditor.ready;$('#avatar-crop').hidden=!avatarEditor.ready||!editingAvatar;$('#start-avatar-crop').disabled=!avatarEditor.ready||editingAvatar;
    paintImage($('#draft-photo'),photo?.result).catch(error=>fail('photo',error));paintImage($('#draft-avatar'),avatar?.result).catch(error=>fail('avatar',error));
    $('#crop-from-photo').disabled=!photo?.result||jobs>0;
    $('#crop-source-help').textContent=photo?.result?'使用本次設定的立繪裁切結果。':'尚無可用立繪，請先上傳立繪。';updateLibrary();
  }
  async function setAvatar(source,{automatic=false,top=false}={}){
    const token=session,version=avatarVersion;const image=await decodeImage(await imageURL(source));
    if(!active(token)||version!==avatarVersion||(automatic&&manualAvatar))return;
    avatarEditor.setImage(image,{top});const output=await avatarEditor.export();if(!active(token)||version!==avatarVersion||(automatic&&manualAvatar))return;avatar={source,result:output,crop:avatarEditor.crop,changed:true};editingAvatar=false;renderDraft();
  }
  async function flushPhoto(){
    if(!photo?.dirty){updateBusy();return;}
    const model=photo,version=photoVersion;
    return job(async token=>{
      const result=await portraitEditor.export();if(!active(token)||photo!==model||version!==photoVersion)return;
      photo.result=result;photo.crop=portraitEditor.crop;photo.dirty=false;
      // Editing the active portrait never mutates a saved favourite.
      currentId=null;
      if(newPhoto&&!manualAvatar)await setAvatar(result,{automatic:true,top:true});if(active(token))renderDraft();
    });
  }
  async function loadPhoto(item,{selected=false}={}){
    const token=session,version=++uploadVersion;const source=item.source??item.image;
    const image=await decodeImage(await imageURL(source));if(!active(token)||version!==uploadVersion)return;
    editingPhoto=false;photo={source,result:item.image,crop:item.crop??null,changed:selected,dirty:false};portraitEditor.setImage(image,{crop:item.crop});photo.crop=portraitEditor.crop;newPhoto=false;photoError='';renderDraft();
  }
  async function uploadPhoto(file,target,asCollection=false,requestedSlot=null){
    const version=++uploadVersion;
    if(!opened)return;
    if(asCollection&&!target&&portraits.length>=6){onError('photo','最多保存 6 個立繪，請先到「我的最愛」刪除或更換既有項目。',0);return;}
    photoError='';
    try{await job(async token=>{
      const {url,image}=await readImageFile(file);if(!active(token)||version!==uploadVersion)return;
      if(asCollection){collectionEditor.setImage(image);pendingCollection={source:url,target,slot:requestedSlot};$('#collection-editor').hidden=false;$('#confirm-collection').textContent=target?'更換':'新增';$('#cancel-collection').textContent=target?'取消更換':'取消新增';$('#photo-input').value='';$('#collection-canvas').focus();return;}
      portraitEditor.setImage(image);const result=await portraitEditor.export();if(!active(token)||version!==uploadVersion)return;editingPhoto=false;photo={source:url,result,crop:portraitEditor.crop,changed:true,dirty:false};newPhoto=true;photoVersion++;
      currentId=null;
      if(!manualAvatar)await setAvatar(result,{automatic:true,top:true});
      if(!active(token)||version!==uploadVersion)return;
      $('#photo-input').value='';$('#photo-error').textContent='';renderDraft();onSelect(0);
    });}catch(error){if(version===uploadVersion)fail(asCollection?'portraits':'photo',error,asCollection?2:0);}
  }
  $('#add-favorite').addEventListener('click',()=>{if(!photo?.result||editingPhoto||jobs)return;job(async token=>{
    const {imageFingerprint}=await import('./image-store.mjs');const fingerprint=await imageFingerprint(photo.result);
    const fingerprints=await Promise.all(portraits.map(p=>imageFingerprint(p.image)));
    if(!active(token))return;
    if(fingerprints.includes(fingerprint)){$('#favorite-help').textContent='這張圖片已在最愛中。';return;}
    if(portraits.length>=6){$('#favorite-help').textContent='最愛已滿（6 張），請先手動刪除或更換。';return;}
    const slot=librarySlots().indexOf(null);portraits.push({id:crypto.randomUUID(),slot,source:photo.source,image:photo.result,crop:structuredClone(photo.crop)});updateLibrary();$('#favorite-help').textContent='已添加到最愛草稿，按「儲存」後保存；取消會還原。';
  }).catch(error=>fail('photo',error));});
  $('#choose-photo').addEventListener('click',()=>{slotTarget=null;collectionMode=false;$('#photo-input').click();});

  $('#photo-input').addEventListener('change',event=>{const file=event.target.files[0],target=slotTarget;slotTarget=null;if(file)uploadPhoto(file,target,collectionMode,collectionSlot);});
  $('#choose-avatar').addEventListener('click',()=>$('#avatar-input').click());
  $('#avatar-input').addEventListener('change',async event=>{
    const file=event.target.files[0];if(!file)return;manualAvatar=true;avatarError='';const version=++avatarVersion;
    try{await job(async token=>{const{url}=await readImageFile(file,{maxEdge:1024,limit:400*1024});if(!active(token)||version!==avatarVersion)return;await setAvatar(url);if(!active(token)||version!==avatarVersion)return;$('#avatar-input').value='';$('#avatar-error').textContent='';});}catch(error){if(version===avatarVersion)fail('avatar',error);}
  });
  $('#crop-from-photo').addEventListener('click',async()=>{
    if(!photo?.result)return;const token=session;manualAvatar=true;avatarVersion++;avatarError='';
    try{await job(async()=>{await flushPhoto();if(!active(token))return;await setAvatar(photo.result,{top:true});});}catch(error){if(active(token))fail('avatar',error);}
  });
  $('#portrait-library').addEventListener('click',event=>{
    const button=event.target.closest('button');if(!button||jobs>0)return;
    if(button.dataset.action==='add'){collectionMode=true;slotTarget=null;collectionSlot=Number(button.closest('[data-slot]').dataset.slot);$('#photo-input').click();return;}
    if(button.dataset.openPortrait){actionId=button.dataset.openPortrait;actionTrigger=button;actionDialog.showModal();}
  });
  actionDialog.addEventListener('click',async event=>{
    const button=event.target.closest('button[data-action]');if(!button)return;
    const token=session,id=actionId,item=portraits.find(item=>item.id===id);if(!item)return;
    actionDialog.close();
    if(button.dataset.action==='delete'){
      const index=librarySlots().findIndex(item=>item?.id===id);portraits=portraits.filter(item=>item.id!==id);if(currentId===id)currentId=null;updateLibrary();
      $('#portrait-library').children[index]?.querySelector('button').focus({preventScroll:true});return;
    }
    if(button.dataset.action==='replace'){collectionMode=true;slotTarget=id;$('#photo-input').click();return;}
    try{await job(async()=>{await flushPhoto();if(!active(token))return;currentId=id;await loadPhoto(item,{selected:true});if(active(token)){onSelect(0);$('#choose-photo').focus({preventScroll:true});}});}catch(error){if(active(token))fail('photo',error);}
  });
  return{
    async open(state){
      session++;opened=true;editingPhoto=false;editingAvatar=false;pendingCollection=null;collectionMode=false;$('#collection-editor').hidden=true;collectionEditor.clear();slotTarget=null;jobs=0;base=structuredClone(state);portraits=structuredClone(state.portraits??[]);currentId=state.currentPortraitId??null;manualAvatar=false;newPhoto=false;photoError='';avatarError='';photoVersion++;uploadVersion++;avatarVersion++;portraitEditor.clear();avatarEditor.clear();
      photo=state.photo?{source:state.photoEdit?.source??state.photo,result:state.photo,crop:state.photoEdit?.crop??null,changed:false,dirty:false}:null;
      avatar=state.avatar?{source:state.avatarEdit?.source??state.avatar,result:state.avatar,crop:state.avatarEdit?.crop??null,changed:false}:null;
      $('#photo-input').value='';$('#avatar-input').value='';renderDraft();
      const opening=session,openingPhoto=photo,openingAvatar=avatar;
      try{await job(async token=>{
        if(openingPhoto){try{const image=await decodeImage(await imageURL(openingPhoto.source));if(active(token)&&photo===openingPhoto)portraitEditor.setImage(image,{crop:openingPhoto.crop});}catch(error){throw Object.assign(error,{field:'photo'});}}
        if(openingAvatar){try{const image=await decodeImage(await imageURL(openingAvatar.source));if(active(token)&&avatar===openingAvatar)avatarEditor.setImage(image,{crop:openingAvatar.crop});}catch(error){throw Object.assign(error,{field:'avatar'});}}
        if(active(token))renderDraft();
      });}catch(error){if(active(opening))fail(error.field??'photo',error);}
    },
    close(){if(actionDialog.open)actionDialog.close();actionId=null;actionTrigger=null;opened=false;session++;jobs=0;photoVersion++;uploadVersion++;avatarVersion++;portraitEditor.clear();avatarEditor.clear();photo=null;avatar=null;portraits=[];onBusy(false);},
    get hasChanges(){
      if(!opened)return false;
      if(pendingCollection||$('#photo-input').files.length||$('#avatar-input').files.length)return true;
      const different=(a,b)=>JSON.stringify(a??null)!==JSON.stringify(b??null);
      if(editingPhoto&&different(portraitEditor.crop,photoWorkingBase))return true;
      if(editingAvatar&&different(avatarEditor.crop,avatarWorkingBase))return true;
      return different(photo?.result,base.photo)||different(avatar?.result,base.avatar)||different(portraits,base.portraits??[])||different(currentId,base.currentPortraitId)
        ||(photo?.changed&&different({source:photo.source,crop:photo.crop},base.photoEdit))
        ||(avatar?.changed&&different({source:avatar.source,crop:avatar.crop},base.avatarEdit));
    },
    async collect(){
      const collectionSession=session;
      if(photoError)throw Object.assign(new Error(photoError),{field:'photo'});
      if(avatarError)throw Object.assign(new Error(avatarError),{field:'avatar'});
      try{await flushPhoto();}catch(error){throw Object.assign(error,{field:'photo'});}if(!active(collectionSession))throw new Error('設定已取消。');
      return job(async()=>{
        return{photo:photo?.result??null,avatar:avatar?.result??null,photoEdit:photo?.changed?{source:photo.source,crop:photo.crop}:base.photoEdit??null,avatarEdit:avatar?.changed?{source:avatar.source,crop:avatar.crop}:base.avatarEdit??null,portraits:structuredClone(portraits),currentPortraitId:currentId};
      });
    },
  };
}
