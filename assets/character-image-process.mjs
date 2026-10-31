import {IMAGE_LIMITS} from './character-images-model.mjs?v=stats-affinity-20261031';
import {encodeCanvas,decodeImage,createImageCropper} from './avatar-crop.mjs?v=stats-affinity-20261031';
export {createImageCropper,decodeImage};
const fail=()=>{throw new Error('請選擇內容完整的 PNG、JPEG 或 WebP；不接受 SVG、GIF 或動畫圖片。');};
// Read dimensions BEFORE decoding to reject decompression bombs. Animated formats
// are rejected; content signatures, never extensions, select the decoder MIME.
export function imageHeader(bytes){
 const v=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);let width,height,mime;
 const text=(a,b)=>String.fromCharCode(...bytes.slice(a,b));
 if(bytes.length>=24&&text(1,4)==='PNG'&&bytes[0]===137&&text(12,16)==='IHDR'){
  mime='image/png';width=v.getUint32(16);height=v.getUint32(20);
  for(let i=8;i+12<=bytes.length;){const length=v.getUint32(i);if(i+12+length>bytes.length)fail();if(text(i+4,i+8)==='acTL')fail();i+=length+12;}
 }else if(bytes[0]===255&&bytes[1]===216&&bytes[2]===255){
  mime='image/jpeg';let i=2;
  while(i+4<bytes.length){if(bytes[i++]!==255)fail();while(bytes[i]===255)i++;if(i+3>bytes.length)fail();const marker=bytes[i++];if(marker===217||marker===218)break;if(marker===1||marker>=208&&marker<=215)continue;const n=v.getUint16(i);if(n<2||i+n>bytes.length)fail();if([192,193,194,195,197,198,199,201,202,203,205,206,207].includes(marker)){if(n<8)fail();height=v.getUint16(i+3);width=v.getUint16(i+5);break;}i+=n;}
 }else if(bytes.length>=30&&text(0,4)==='RIFF'&&text(8,12)==='WEBP'){
  mime='image/webp';const type=text(12,16);
  if(type==='VP8X'){if(bytes[20]&2)fail();width=1+bytes[24]+bytes[25]*256+bytes[26]*65536;height=1+bytes[27]+bytes[28]*256+bytes[29]*65536;}
  else if(type==='VP8 '&&bytes[23]===157&&bytes[24]===1&&bytes[25]===42){width=v.getUint16(26,true)&16383;height=v.getUint16(28,true)&16383;}
  else if(type==='VP8L'&&bytes[20]===47){const n=v.getUint32(21,true);width=(n&16383)+1;height=((n>>>14)&16383)+1;}
 }
 if(!width||!height||!mime)fail();
 if(width*height>IMAGE_LIMITS.pixels||Math.max(width,height)>IMAGE_LIMITS.rawEdge)throw new Error('圖片超過 2,400 萬像素或單邊 12000px，請先縮小。');
 return {width,height,mime};
}
export async function readCharacterImage(file){
 if(!file||file.size>IMAGE_LIMITS.rawBytes||file.size===0)throw new Error('原始圖片上限為 12 MiB，請選擇較小的圖片。');
 const bytes=new Uint8Array(await file.arrayBuffer()),header=imageHeader(bytes),blob=new Blob([bytes],{type:header.mime});
 let bitmap;const url=URL.createObjectURL(blob);
 try{
  if(globalThis.createImageBitmap){bitmap=await createImageBitmap(blob);}
  const source=bitmap??await decodeImage(url),canvas=document.createElement('canvas'),width=bitmap?.width??source.naturalWidth,height=bitmap?.height??source.naturalHeight,outputScale=Math.min(1,IMAGE_LIMITS.workingEdge/Math.max(width,height));
  canvas.width=Math.max(1,Math.round(width*outputScale));canvas.height=Math.max(1,Math.round(height*outputScale));
  canvas.getContext('2d').drawImage(source,0,0,canvas.width,canvas.height);
  const result=await encodeCanvas(canvas,{maxEdge:IMAGE_LIMITS.workingEdge,limit:2*IMAGE_LIMITS.bytes});canvas.width=canvas.height=0;
  return decodeImage(result);
 }catch(error){if(/超過|上限|仍超過/.test(error.message))throw error;throw new Error('圖片無法解碼；原圖及設定已保留。');}
 finally{bitmap?.close();URL.revokeObjectURL(url);}
}
export async function croppedPortrait(image,rect){
 const unit=Math.max(1,Math.floor(Math.min(IMAGE_LIMITS.maxEdge/4,rect.width/3,rect.height/4))),canvas=document.createElement('canvas');canvas.width=unit*3;canvas.height=unit*4;
 canvas.getContext('2d').drawImage(image,rect.left,rect.top,rect.width,rect.height,0,0,canvas.width,canvas.height);
 try{return await encodeCanvas(canvas,{limit:IMAGE_LIMITS.bytes,maxEdge:IMAGE_LIMITS.maxEdge,ratioUnit:[3,4]});}finally{canvas.width=canvas.height=0;}
}
export async function thumbnailBlob(image){const canvas=document.createElement('canvas');canvas.width=IMAGE_LIMITS.thumbnailEdge*3/4;canvas.height=IMAGE_LIMITS.thumbnailEdge;canvas.getContext('2d').drawImage(image,0,0,canvas.width,canvas.height);try{const url=await encodeCanvas(canvas,{maxEdge:IMAGE_LIMITS.thumbnailEdge,limit:IMAGE_LIMITS.thumbnailBytes});return (await fetch(url)).blob();}finally{canvas.width=canvas.height=0;}}
