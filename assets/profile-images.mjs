import {createImageCropper,readImageFile,decodeImage} from './avatar-crop.mjs?v=images-21';
import {imageURL} from './image-store.mjs?v=images-21';
const $=selector=>document.querySelector(selector);
export function createProfileImages({onError,onSelect,onBusy=()=>{}}) {
  let session=0,jobs=0,opened=false,base,photo,avatar,portraits=[],currentId=null,manualAvatar=false,newPhoto=false,slotTarget=null;
  let photoVersion=0,uploadVersion=0,avatarVersion=0,timer,scheduled=false,photoError='',avatarError='';
  const updateBusy=()=>{const busy=jobs>0||scheduled;onBusy(busy);$('#image-status').hidden=!busy;$('#image-status').textContent=busy?'圖片處理中，請稍候。':'';$('#crop-from-photo').disabled=!photo?.result||busy;};
  async function job(work){const token=session;jobs++;updateBusy();try{return await work(token);}finally{if(token===session){jobs--;updateBusy();}}}
  const active=token=>opened&&token===session;
  const fail=(field,error,index=field==='avatar'?1:0)=>{if(!opened)return;if(field==='avatar')avatarError=error.message;else if(field==='photo')photoError=error.message;onError(field,error.message,index);};
  const portraitEditor=createImageCropper({canvas:$('#portrait-canvas'),preview:$('#portrait-preview'),zoomInput:$('#portrait-zoom'),widthInput:$('#portrait-width'),heightInput:$('#portrait-height'),onChange:()=>{
    if(!opened||!photo)return;photo.changed=true;photo.dirty=true;photoError='';photoVersion++;clearTimeout(timer);scheduled=true;updateBusy();const token=session;timer=setTimeout(()=>flushPhoto().catch(error=>{if(active(token))fail('photo',error);}),150);
  }});
  const avatarEditor=createImageCropper({canvas:$('#crop-canvas'),preview:$('#crop-preview'),zoomInput:$('#crop-zoom'),square:true,onChange:()=>{if(opened&&avatar){manualAvatar=true;avatar.changed=true;avatar.dirty=true;avatarError='';avatarVersion++;}}});
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
    $('#draft-photo-empty').hidden=Boolean(photo?.result);$('#portrait-editor').hidden=!photo?.result;
    $('#draft-avatar-empty').hidden=Boolean(avatar?.result)||avatarEditor.ready;$('#avatar-crop').hidden=!avatarEditor.ready;
    paintImage($('#draft-photo'),photo?.result).catch(error=>fail('photo',error));paintImage($('#draft-avatar'),avatar?.result).catch(error=>fail('avatar',error));
    $('#crop-from-photo').disabled=!photo?.result||jobs>0||scheduled;
    $('#crop-source-help').textContent=photo?.result?'使用本次設定的立繪裁切結果。':'尚無可用立繪，請先上傳立繪。';updateLibrary();
  }
  async function setAvatar(source,{crop,automatic=false,top=false,result=null}={}){
    const token=session,version=avatarVersion;const image=await decodeImage(await imageURL(source));
    if(!active(token)||version!==avatarVersion||(automatic&&manualAvatar))return;
    avatar={source,result,crop,changed:true,dirty:true};avatarEditor.setImage(image,{crop,top});avatar.crop=avatarEditor.crop;renderDraft();
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
    photo={source,result:item.image,crop:item.crop??null,changed:selected,dirty:false};portraitEditor.setImage(image,{crop:item.crop});photo.crop=portraitEditor.crop;newPhoto=false;photoError='';renderDraft();
  }
  async function uploadPhoto(file,target){
    const version=++uploadVersion;
    if(!opened)return;
    if(!target&&portraits.length>=5){onError('photo','最多保存 5 個立繪，請先到「立繪選擇」刪除或更換既有項目。',0);return;}
    photoError='';
    try{await job(async token=>{
      const {url,image}=await readImageFile(file);if(!active(token)||version!==uploadVersion)return;
      portraitEditor.setImage(image);photo={source:url,result:url,crop:portraitEditor.crop,changed:true,dirty:false};newPhoto=true;photoVersion++;
      currentId=target??crypto.randomUUID();const item={id:currentId,source:url,image:url,crop:photo.crop};const index=portraits.findIndex(p=>p.id===currentId);if(index<0)portraits.push(item);else portraits[index]=item;
      if(!manualAvatar)await setAvatar(url,{automatic:true,top:true});
      if(!active(token)||version!==uploadVersion)return;
      $('#photo-input').value='';$('#photo-error').textContent='';renderDraft();onSelect(0);
    });}catch(error){if(version===uploadVersion)fail('photo',error);}
  }
  $('#choose-photo').addEventListener('click',()=>{slotTarget=null;$('#photo-input').click();});
  $('#collection-add').addEventListener('click',()=>{slotTarget=null;$('#photo-input').click();});
  $('#photo-input').addEventListener('change',event=>{const file=event.target.files[0],target=slotTarget;slotTarget=null;if(file)uploadPhoto(file,target);});
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
    if(button.dataset.action==='replace'){slotTarget=id;$('#photo-input').click();return;}
    try{await job(async()=>{await flushPhoto();if(!active(token))return;currentId=id;await loadPhoto(item,{selected:true});if(active(token))onSelect(0);});}catch(error){if(active(token))fail('photo',error);}
  });
  return{
    async open(state){
      session++;opened=true;slotTarget=null;jobs=0;scheduled=false;clearTimeout(timer);base=structuredClone(state);portraits=structuredClone(state.portraits??[]);currentId=state.currentPortraitId??null;manualAvatar=false;newPhoto=false;photoError='';avatarError='';photoVersion++;uploadVersion++;avatarVersion++;portraitEditor.clear();avatarEditor.clear();
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
        return{photo:photo?.result??null,avatar:avatar?.result??null,photoEdit:photo?.changed?{source:photo.source,crop:portraitEditor.crop}:base.photoEdit??null,avatarEdit:avatar?.changed?{source:avatar.source,crop:avatarEditor.crop}:base.avatarEdit??null,portraits:structuredClone(portraits),currentPortraitId:currentId};
      });
    },
  };
}
