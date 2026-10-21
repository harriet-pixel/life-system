import {createImageCropper,readImageFile,decodeImage} from './avatar-crop.mjs?v=crop-22';
import {imageURL} from './image-store.mjs?v=images-21';
const $=selector=>document.querySelector(selector);
export function createProfileImages({onError,onSelect,onBusy=()=>{}}) {
  let session=0,jobs=0,opened=false,base,photo,avatar,portraits=[],currentId=null,manualAvatar=false,newPhoto=false,slotTarget=null;
  let editingPhoto=false,editingAvatar=false,collectionMode=false,pendingCollection=null;
  let photoVersion=0,uploadVersion=0,avatarVersion=0,timer,scheduled=false,photoError='',avatarError='';
  const updateBusy=()=>{const busy=jobs>0||scheduled;onBusy(busy);$('#image-status').hidden=!busy;$('#image-status').textContent=busy?'圖片處理中，請稍候。':'';$('#crop-from-photo').disabled=!photo?.result||busy;};
  async function job(work){const token=session;jobs++;updateBusy();try{return await work(token);}finally{if(token===session){jobs--;updateBusy();}}}
  const active=token=>opened&&token===session;
  const fail=(field,error,index=field==='avatar'?1:0)=>{if(!opened)return;if(field==='avatar')avatarError=error.message;else if(field==='photo')photoError=error.message;onError(field,error.message,index);};
  const portraitEditor=createImageCropper({canvas:$('#portrait-canvas'),zoomInput:$('#portrait-zoom'),aspectRatio:3/4});
  const avatarEditor=createImageCropper({canvas:$('#crop-canvas'),zoomInput:$('#crop-zoom'),square:true,onChange:()=>{if(opened&&editingAvatar){manualAvatar=true;avatarVersion++;}}});
  const collectionEditor=createImageCropper({canvas:$('#collection-canvas'),zoomInput:$('#collection-zoom'),aspectRatio:3/4});
  function setEditing(kind,value){if(kind==='photo')editingPhoto=value;else editingAvatar=value;renderDraft();}
  $('#start-portrait-crop').addEventListener('click',()=>setEditing('photo',true));
  $('#start-avatar-crop').addEventListener('click',()=>setEditing('avatar',true));
  $('#cancel-portrait-crop').addEventListener('click',()=>{job(async token=>{if(photo){const image=await decodeImage(await imageURL(photo.source));if(!active(token))return;portraitEditor.setImage(image,{crop:photo.crop});}setEditing('photo',false);}).catch(error=>fail('photo',error));});
  $('#cancel-avatar-crop').addEventListener('click',()=>{job(async token=>{if(avatar){const image=await decodeImage(await imageURL(avatar.source));if(!active(token))return;avatarEditor.setImage(image,{crop:avatar.crop});}setEditing('avatar',false);}).catch(error=>fail('avatar',error));});
  $('#confirm-portrait-crop').addEventListener('click',async()=>{if(!photo)return;const token=session;photoError='';$('#photo-error').textContent='';photo.changed=true;photo.dirty=true;photoVersion++;try{await flushPhoto();if(active(token))setEditing('photo',false);}catch(error){if(active(token))fail('photo',error);}});
  $('#confirm-avatar-crop').addEventListener('click',async()=>{if(!avatar)return;const token=session;avatarError='';$('#avatar-error').textContent='';try{await job(async token=>{const model=avatar,result=await avatarEditor.export();if(!active(token)||avatar!==model)return;Object.assign(avatar,{result,crop:avatarEditor.crop,changed:true,dirty:false});manualAvatar=true;avatarVersion++;setEditing('avatar',false);});}catch(error){if(active(token))fail('avatar',error);}});
  $('#cancel-collection').addEventListener('click',()=>{pendingCollection=null;collectionEditor.clear();$('#collection-editor').hidden=true;});
  $('#confirm-collection').addEventListener('click',async()=>{if(!pendingCollection)return;const token=session,model=pendingCollection;try{await job(async token=>{const result=await collectionEditor.export();if(!active(token)||pendingCollection!==model)return;if(!model.target&&portraits.length>=5)throw new Error('最多保存 5 個立繪，請先刪除或更換。');const item={id:model.target??crypto.randomUUID(),source:model.source,image:result,crop:collectionEditor.crop},index=portraits.findIndex(p=>p.id===item.id);if(index<0)portraits.push(item);else portraits[index]=item;pendingCollection=null;$('#portraits-error').textContent='';$('#collection-editor').hidden=true;collectionEditor.clear();updateLibrary();});}catch(error){if(active(token))fail('portraits',error,2);}});
  async function paintImage(target,reference){
    const token=session;target.dataset.reference=reference??'';
    if(!reference){target.hidden=true;target.removeAttribute('src');return;}
    try{const url=await imageURL(reference);if(active(token)&&target.dataset.reference===reference){target.src=url;target.hidden=false;}}
    catch(error){if(active(token)&&target.dataset.reference===reference&&target.isConnected)throw error;}
  }

  function updateLibrary(){
    $('#portrait-count').textContent=`已保存 ${portraits.length} / 5 個立繪`;
    $('#portraits-empty').hidden=portraits.length>0;$('#collection-add').disabled=portraits.length>=5;
    $('#portrait-limit-help').textContent=portraits.length>=5?'已達 5 個，請先刪除或更換既有項目。':'';
    $('#portrait-library').replaceChildren(...portraits.map((item,index)=>{
      const row=document.createElement('li');row.dataset.portraitId=item.id;const image=document.createElement('img');image.alt=`立繪 ${index+1} 縮圖`;paintImage(image,item.image).catch(error=>fail('portraits',error,2));
      const info=document.createElement('p');info.textContent=`立繪 ${index+1}${item.id===currentId?' · 目前使用':''}`;
      const actions=document.createElement('div');actions.className='portrait-actions';
      for(const[action,label]of[['select','選用'],['replace','更換'],['delete','刪除']]){const button=document.createElement('button');button.type='button';button.dataset.action=action;button.textContent=label;button.setAttribute('aria-label',`${label}立繪 ${index+1}`);actions.append(button);}
      row.append(image,info,actions);return row;
    }));
  }
  function renderDraft(){
    $('#draft-photo-empty').hidden=Boolean(photo?.result);$('#portrait-editor').hidden=!photo?.result||!editingPhoto;$('#start-portrait-crop').hidden=!photo?.result||editingPhoto;
    $('#draft-avatar-empty').hidden=Boolean(avatar?.result)||avatarEditor.ready;$('#avatar-crop').hidden=!avatarEditor.ready||!editingAvatar;$('#start-avatar-crop').hidden=!avatarEditor.ready||editingAvatar;
    paintImage($('#draft-photo'),photo?.result).catch(error=>fail('photo',error));paintImage($('#draft-avatar'),avatar?.result).catch(error=>fail('avatar',error));
    $('#crop-from-photo').disabled=!photo?.result||jobs>0||scheduled;
    $('#crop-source-help').textContent=photo?.result?'使用本次設定的立繪裁切結果。':'尚無可用立繪，請先上傳立繪。';updateLibrary();
  }
  async function setAvatar(source,{crop,automatic=false,top=false,result=null}={}){
    const token=session,version=avatarVersion;const image=await decodeImage(await imageURL(source));
    if(!active(token)||version!==avatarVersion||(automatic&&manualAvatar))return;
    avatarEditor.setImage(image,{crop,top});const output=result??await avatarEditor.export();if(!active(token)||version!==avatarVersion||(automatic&&manualAvatar))return;avatar={source,result:output,crop:avatarEditor.crop,changed:true,dirty:false};editingAvatar=false;renderDraft();
  }
  async function flushPhoto(){
    clearTimeout(timer);scheduled=false;
    if(!photo?.dirty){updateBusy();return;}
    const model=photo,version=photoVersion;
    return job(async token=>{
      const result=await portraitEditor.export();if(!active(token)||photo!==model||version!==photoVersion)return;
      photo.result=result;photo.crop=portraitEditor.crop;photo.dirty=false;
      const item=portraits.find(item=>item.id===currentId);if(item)Object.assign(item,{source:photo.source,crop:photo.crop,image:result});
      if(newPhoto&&!manualAvatar)await setAvatar(result,{automatic:true,top:true});if(active(token))renderDraft();
    });
  }
  async function loadPhoto(item,{selected=false}={}){
    const token=session,version=++uploadVersion;const source=item.source??item.image;
    const image=await decodeImage(await imageURL(source));if(!active(token)||version!==uploadVersion)return;
    editingPhoto=false;photo={source,result:item.image,crop:item.crop??null,changed:selected,dirty:false};portraitEditor.setImage(image,{crop:item.crop});photo.crop=portraitEditor.crop;newPhoto=false;photoError='';renderDraft();
  }
  async function uploadPhoto(file,target,asCollection=false){
    const version=++uploadVersion;
    if(!opened)return;
    if(!target&&portraits.length>=5){onError('photo','最多保存 5 個立繪，請先到「立繪選擇」刪除或更換既有項目。',0);return;}
    photoError='';
    try{await job(async token=>{
      const {url,image}=await readImageFile(file);if(!active(token)||version!==uploadVersion)return;
      if(asCollection){collectionEditor.setImage(image);pendingCollection={source:url,target};$('#collection-editor').hidden=false;$('#confirm-collection').textContent=target?'更換':'新增';$('#cancel-collection').textContent=target?'取消更換':'取消新增';$('#photo-input').value='';return;}
      portraitEditor.setImage(image);const result=await portraitEditor.export();if(!active(token)||version!==uploadVersion)return;editingPhoto=false;photo={source:url,result,crop:portraitEditor.crop,changed:true,dirty:false};newPhoto=true;photoVersion++;
      currentId=target??crypto.randomUUID();const item={id:currentId,source:url,image:result,crop:photo.crop};const index=portraits.findIndex(p=>p.id===currentId);if(index<0)portraits.push(item);else portraits[index]=item;
      if(!manualAvatar)await setAvatar(result,{automatic:true,top:true});
      if(!active(token)||version!==uploadVersion)return;
      $('#photo-input').value='';$('#photo-error').textContent='';renderDraft();onSelect(0);
    });}catch(error){if(version===uploadVersion)fail('photo',error);}
  }
  $('#choose-photo').addEventListener('click',()=>{slotTarget=null;collectionMode=false;$('#photo-input').click();});
  $('#collection-add').addEventListener('click',()=>{collectionMode=true;slotTarget=null;$('#photo-input').click();});
  $('#photo-input').addEventListener('change',event=>{const file=event.target.files[0],target=slotTarget;slotTarget=null;if(file)uploadPhoto(file,target,collectionMode);});
  $('#choose-avatar').addEventListener('click',()=>$('#avatar-input').click());
  $('#avatar-input').addEventListener('change',async event=>{
    const file=event.target.files[0];if(!file)return;manualAvatar=true;avatarError='';const version=++avatarVersion;
    try{await job(async token=>{const{url}=await readImageFile(file,{maxEdge:1024,limit:400*1024});if(!active(token)||version!==avatarVersion)return;await setAvatar(url);if(!active(token)||version!==avatarVersion)return;$('#avatar-input').value='';$('#avatar-error').textContent='';});}catch(error){if(version===avatarVersion)fail('avatar',error);}
  });
  $('#crop-from-photo').addEventListener('click',async()=>{
    if(!photo?.result)return;const token=session;manualAvatar=true;avatarVersion++;avatarError='';
    try{await job(async()=>{await flushPhoto();if(!active(token))return;await setAvatar(photo.result,{top:true});});}catch(error){if(active(token))fail('avatar',error);}
  });
  $('#portrait-library').addEventListener('click',async event=>{
    const token=session;const button=event.target.closest('button[data-action]');if(!button)return;const id=button.closest('[data-portrait-id]').dataset.portraitId,item=portraits.find(item=>item.id===id);if(!item)return;
    if(button.dataset.action==='delete'){portraits=portraits.filter(item=>item.id!==id);if(currentId===id)currentId=null;updateLibrary();return;}
    if(button.dataset.action==='replace'){collectionMode=true;slotTarget=id;$('#photo-input').click();return;}
    try{await job(async()=>{await flushPhoto();if(!active(token))return;currentId=id;await loadPhoto(item,{selected:true});if(active(token))onSelect(0);});}catch(error){if(active(token))fail('photo',error);}
  });
  return{
    async open(state){
      session++;opened=true;editingPhoto=false;editingAvatar=false;pendingCollection=null;collectionMode=false;$('#collection-editor').hidden=true;collectionEditor.clear();slotTarget=null;jobs=0;scheduled=false;clearTimeout(timer);base=structuredClone(state);portraits=structuredClone(state.portraits??[]);currentId=state.currentPortraitId??null;manualAvatar=false;newPhoto=false;photoError='';avatarError='';photoVersion++;uploadVersion++;avatarVersion++;portraitEditor.clear();avatarEditor.clear();
      photo=state.photo?{source:state.photoEdit?.source??state.photo,result:state.photo,crop:state.photoEdit?.crop??null,changed:false,dirty:false}:null;
      avatar=state.avatar?{source:state.avatarEdit?.source??state.avatar,result:state.avatar,crop:state.avatarEdit?.crop??null,changed:false,dirty:false}:null;
      $('#photo-input').value='';$('#avatar-input').value='';renderDraft();
      const opening=session,openingPhoto=photo,openingAvatar=avatar;
      try{await job(async token=>{
        if(openingPhoto){try{const image=await decodeImage(await imageURL(openingPhoto.source));if(active(token)&&photo===openingPhoto)portraitEditor.setImage(image,{crop:openingPhoto.crop});}catch(error){throw Object.assign(error,{field:'photo'});}}
        if(openingAvatar){try{const image=await decodeImage(await imageURL(openingAvatar.source));if(active(token)&&avatar===openingAvatar)avatarEditor.setImage(image,{crop:openingAvatar.crop});}catch(error){throw Object.assign(error,{field:'avatar'});}}
        if(active(token))renderDraft();
      });}catch(error){if(active(opening))fail(error.field??'photo',error);}
    },
    close(){opened=false;session++;jobs=0;scheduled=false;clearTimeout(timer);photoVersion++;uploadVersion++;avatarVersion++;portraitEditor.clear();avatarEditor.clear();photo=null;avatar=null;portraits=[];onBusy(false);},
    get busy(){return jobs>0||scheduled;},
    async collect(){
      const collectionSession=session;
      if(photoError)throw Object.assign(new Error(photoError),{field:'photo'});
      if(avatarError)throw Object.assign(new Error(avatarError),{field:'avatar'});
      try{await flushPhoto();}catch(error){throw Object.assign(error,{field:'photo'});}if(!active(collectionSession))throw new Error('設定已取消。');
      return job(async token=>{
        if(avatar?.dirty){const model=avatar;let result;try{result=await avatarEditor.export();}catch(error){throw Object.assign(error,{field:'avatar'});}if(!active(token)||avatar!==model)throw new Error('設定已取消。');avatar.result=result;avatar.crop=avatarEditor.crop;avatar.dirty=false;}
        return{photo:photo?.result??null,avatar:avatar?.result??null,photoEdit:photo?.changed?{source:photo.source,crop:photo.crop}:base.photoEdit??null,avatarEdit:avatar?.changed?{source:avatar.source,crop:avatar.crop}:base.avatarEdit??null,portraits:structuredClone(portraits),currentPortraitId:currentId};
      });
    },
  };
}
