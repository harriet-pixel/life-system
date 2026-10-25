import {validateZoom} from './validation.mjs?v=drive-poll-25';
export const RAW_IMAGE_LIMIT = 20 * 1024 * 1024;
export const IMAGE_LIMIT = 1024 * 1024;
export const AVATAR_LIMIT = 200 * 1024;
export async function decodeImage(url) {
  const image=new Image();image.src=url;
  try{await image.decode();}catch{throw new Error('圖片損壞或格式不受支援。');}return image;
}
const asDataURL=blob=>new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(new Error('圖片讀取失敗。'));reader.readAsDataURL(blob);});
export async function encodeCanvas(source,{limit=IMAGE_LIMIT,maxEdge=1600}={}) {
  let canvas=document.createElement('canvas');
  const scale=Math.min(1,maxEdge/Math.max(source.width,source.height));
  canvas.width=Math.max(1,Math.round(source.width*scale));canvas.height=Math.max(1,Math.round(source.height*scale));canvas.getContext('2d').drawImage(source,0,0,canvas.width,canvas.height);
  for(let step=0;step<6;step++){
    // Both formats retain alpha. No opaque JPEG or background fill is used.
    const png=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));
    if(png?.size<=limit)return asDataURL(png);
    for(const quality of [.9,.8,.65,.5]){
      const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/webp',quality));
      if(blob?.size<=limit)return asDataURL(blob);
    }
    if(Math.min(canvas.width,canvas.height)<64)break;
    const smaller=document.createElement('canvas');smaller.width=Math.max(1,Math.round(canvas.width*.8));smaller.height=Math.max(1,Math.round(canvas.height*.8));smaller.getContext('2d').drawImage(canvas,0,0,smaller.width,smaller.height);canvas=smaller;
  }
  throw new Error(`處理後圖片仍超過 ${Math.round(limit/1024)} KB；請調整裁切範圍或換一張圖片，草稿與原圖均已保留。`);
}
export async function readImageFile(file, options = {}) {
  const {maxEdge=1600,limit=IMAGE_LIMIT}=options;
  if(!['image/jpeg','image/png','image/webp'].includes(file.type))throw new Error('請選擇 JPEG、PNG 或 WebP 圖片。');
  if(file.size>RAW_IMAGE_LIMIT)throw new Error('原始圖片上限為 20 MB，請選擇較小的圖片。');
  const objectURL=URL.createObjectURL(file);
  try{
    const source=await decodeImage(objectURL);
    if(source.naturalWidth*source.naturalHeight>40000000)throw new Error('圖片超過 4,000 萬像素，請先縮小尺寸。');
    const canvas=document.createElement('canvas');const scale=Math.min(1,maxEdge/Math.max(source.naturalWidth,source.naturalHeight));
    canvas.width=Math.max(1,Math.round(source.naturalWidth*scale));canvas.height=Math.max(1,Math.round(source.naturalHeight*scale));canvas.getContext('2d').drawImage(source,0,0,canvas.width,canvas.height);
    const url=await encodeCanvas(canvas,{maxEdge,limit});return{url,image:await decodeImage(url)};
  }finally{URL.revokeObjectURL(objectURL);}
}
export function constrainCrop(rect,width,height,square=false) {
  let w=Math.max(1,Math.min(width,rect.width)),h=Math.max(1,Math.min(height,rect.height));
  if(square)w=h=Math.min(w,h);
  return{left:Math.max(0,Math.min(width-w,rect.left)),top:Math.max(0,Math.min(height-h,rect.top)),width:w,height:h};
}
export function createImageCropper({canvas,zoomInput,square=false,aspectRatio=null,onChange=()=>{}}) {
  let image=null,rect=null,drag=null,lastZoom=1;
  function geometry(){const scale=Math.min(canvas.width/image.naturalWidth,canvas.height/image.naturalHeight);return{scale,x:(canvas.width-image.naturalWidth*scale)/2,y:(canvas.height-image.naturalHeight*scale)/2};}
  function output(maxEdge=square?512:1600){
    if(!image)throw new Error('請先選擇裁切來源。');const out=document.createElement('canvas'),scale=Math.min(1,maxEdge/Math.max(rect.width,rect.height));out.width=Math.max(1,Math.round(rect.width*scale));out.height=Math.max(1,Math.round(rect.height*scale));out.getContext('2d').drawImage(image,rect.left,rect.top,rect.width,rect.height,0,0,out.width,out.height);return out;
  }
  function paint(){
    const ctx=canvas.getContext('2d');ctx.clearRect(0,0,canvas.width,canvas.height);
    if(!image)return;
    if(square||aspectRatio)ctx.drawImage(image,rect.left,rect.top,rect.width,rect.height,0,0,canvas.width,canvas.height);
    else{
      const g=geometry();ctx.drawImage(image,g.x,g.y,image.naturalWidth*g.scale,image.naturalHeight*g.scale);
      const x=g.x+rect.left*g.scale,y=g.y+rect.top*g.scale,w=rect.width*g.scale,h=rect.height*g.scale;
      ctx.fillStyle='#0004';ctx.fillRect(0,0,canvas.width,y);ctx.fillRect(0,y,x,h);ctx.fillRect(x+w,y,canvas.width-x-w,h);ctx.fillRect(0,y+h,canvas.width,canvas.height-y-h);
      ctx.strokeStyle='#104a7a';ctx.lineWidth=2;ctx.strokeRect(x,y,w,h);ctx.fillStyle='white';
      for(const [cx,cy]of[[x,y],[x+w,y],[x,y+h],[x+w,y+h]]){ctx.fillRect(cx-5,cy-5,10,10);ctx.strokeRect(cx-5,cy-5,10,10);}
    }
  }
  function change(next){if(!image)return;rect=constrainCrop(next,image.naturalWidth,image.naturalHeight,square);paint();onChange({...rect});}
  zoomInput.addEventListener('input',()=>{if(!image)return;let zoom;try{zoom=validateZoom(zoomInput.value,Number(zoomInput.max));zoomInput.setCustomValidity('');}catch(error){zoomInput.setCustomValidity(error.message);zoomInput.reportValidity();return;}const factor=lastZoom/zoom;lastZoom=zoom;const width=rect.width*factor,height=rect.height*factor;change({left:rect.left+(rect.width-width)/2,top:rect.top+(rect.height-height)/2,width,height});});
  canvas.addEventListener('pointerdown',event=>{
    if(!image||event.button>0)return;canvas.setPointerCapture(event.pointerId);const bounds=canvas.getBoundingClientRect();const x=(event.clientX-bounds.left)*canvas.width/bounds.width,y=(event.clientY-bounds.top)*canvas.height/bounds.height;
    let corner=null;
    if(!square&&!aspectRatio){const g=geometry();for(const [name,cx,cy]of[['tl',rect.left,rect.top],['tr',rect.left+rect.width,rect.top],['bl',rect.left,rect.top+rect.height],['br',rect.left+rect.width,rect.top+rect.height]])if(Math.hypot(x-g.x-cx*g.scale,y-g.y-cy*g.scale)<20)corner=name;}
    drag={x:event.clientX,y:event.clientY,rect:{...rect},corner};
  });
  canvas.addEventListener('pointermove',event=>{
    if(!drag||!image)return;const bounds=canvas.getBoundingClientRect();const scale=(square||aspectRatio)?bounds.width/drag.rect.width:geometry().scale*bounds.width/canvas.width;
    const dx=(event.clientX-drag.x)/scale,dy=(event.clientY-drag.y)/scale;
    if(drag.corner){const r=drag.rect;let left=r.left,top=r.top,right=r.left+r.width,bottom=r.top+r.height;
      if(drag.corner.includes('l'))left=Math.max(0,Math.min(right-1,r.left+dx));else right=Math.min(image.naturalWidth,Math.max(left+1,r.left+r.width+dx));
      if(drag.corner.includes('t'))top=Math.max(0,Math.min(bottom-1,r.top+dy));else bottom=Math.min(image.naturalHeight,Math.max(top+1,r.top+r.height+dy));
      change({left,top,width:right-left,height:bottom-top});
    }else change({...drag.rect,left:drag.rect.left+dx*((square||aspectRatio)?-1:1),top:drag.rect.top+dy*((square||aspectRatio)?-1:1)});
  });
  for(const type of['pointerup','pointercancel','lostpointercapture'])canvas.addEventListener(type,()=>drag=null);
  canvas.addEventListener('keydown',event=>{const directions={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]};if(!image||!directions[event.key])return;event.preventDefault();const[dx,dy]=directions[event.key];change(event.shiftKey&&!square&&!aspectRatio?{...rect,width:rect.width+dx*image.naturalWidth*.02,height:rect.height+dy*image.naturalHeight*.02}:{...rect,left:rect.left+dx*image.naturalWidth*.02,top:rect.top+dy*image.naturalHeight*.02});});
  return{
    setImage(value,{crop,top=false}={}){
      image=value;const w=image.naturalWidth,h=image.naturalHeight,side=Math.min(w,h);
      rect=constrainCrop(crop??(square?{left:(w-side)/2,top:top?0:(h-side)/2,width:side,height:side}:{left:0,top:0,width:w,height:h}),w,h,square);
      if(aspectRatio){const width=Math.min(rect.width,rect.height*aspectRatio),height=width/aspectRatio;rect={left:rect.left+(rect.width-width)/2,top:rect.top+(rect.height-height)/2,width,height};}
      lastZoom=(square?side:aspectRatio?Math.min(w,h*aspectRatio):rect.width)/rect.width;
      zoomInput.max=String(Math.max(4,lastZoom));zoomInput.value=String(lastZoom);paint();
    },
    clear(){image=null;rect=null;drag=null;paint();},get crop(){return rect?{...rect}:null;},get ready(){return Boolean(image);},
    async export(){return encodeCanvas(output(),{limit:square?AVATAR_LIMIT:IMAGE_LIMIT,maxEdge:square?512:1600});},
  };
}
