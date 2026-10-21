export const IMAGE_LIMIT = 500 * 1024;
export async function readImageFile(file) {
  if (!['image/jpeg','image/png','image/webp'].includes(file.type)) throw new Error('請選擇 JPEG、PNG 或 WebP 圖片。');
  if (file.size > IMAGE_LIMIT) throw new Error('圖片不可超過 500 KB，請縮小後重試。');
  const url = await new Promise((resolve,reject) => {
    const reader = new FileReader(); reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('圖片讀取失敗。')); reader.readAsDataURL(file);
  });
  const image = await decodeImage(url); return { url, image };
}
export async function decodeImage(url) {
  const image = new Image(); image.src = url;
  try { await image.decode(); } catch { throw new Error('圖片損壞或格式不受支援。'); }
  return image;
}
export function cropRectangle(width,height,zoom,x,y) {
  const side = Math.min(width,height) / Math.max(1,zoom);
  const left = (width-side)/2 * (1 + Math.max(-1,Math.min(1,x)));
  const top = (height-side)/2 * (1 + Math.max(-1,Math.min(1,y)));
  return { left, top, side };
}
export function createAvatarCropper({ canvas, preview, zoomInput, xInput, yInput, onChange = () => {} }) {
  let image = null, drag = null;
  function rectangle() { return cropRectangle(image.naturalWidth,image.naturalHeight,Number(zoomInput.value),Number(xInput.value)/100,Number(yInput.value)/100); }
  function paint(target) {
    const ctx = target.getContext('2d'); ctx.clearRect(0,0,target.width,target.height);
    if (!image) return;
    const {left,top,side} = rectangle(); ctx.drawImage(image,left,top,side,side,0,0,target.width,target.height);
  }
  function render() { paint(canvas); paint(preview); onChange(); }
  [zoomInput,xInput,yInput].forEach(input => input.addEventListener('input',render));
  canvas.addEventListener('pointerdown',event => {
    if (!image || event.button > 0) return;
    canvas.setPointerCapture(event.pointerId);
    drag = { x:event.clientX,y:event.clientY,startX:Number(xInput.value),startY:Number(yInput.value) };
  });
  canvas.addEventListener('pointermove',event => {
    if (!drag || !image) return;
    const {side} = rectangle(), displayed = canvas.getBoundingClientRect().width;
    const move = (amount,dimension) => dimension > side ? amount/displayed*side*200/(dimension-side) : 0;
    xInput.value = String(drag.startX - move(event.clientX-drag.x,image.naturalWidth));
    yInput.value = String(drag.startY - move(event.clientY-drag.y,image.naturalHeight)); render();
  });
  ['pointerup','pointercancel','lostpointercapture'].forEach(type => canvas.addEventListener(type,()=>{drag=null;}));
  canvas.addEventListener('keydown',event => {
    const moves = {ArrowLeft:[-5,0],ArrowRight:[5,0],ArrowUp:[0,-5],ArrowDown:[0,5]};
    if (!image || !moves[event.key]) return;
    event.preventDefault(); xInput.value = String(Number(xInput.value)+moves[event.key][0]); yInput.value = String(Number(yInput.value)+moves[event.key][1]);render();
  });
  return {
    setImage(value) { image=value; zoomInput.value='1';xInput.value='0';yInput.value='0';render(); },
    clear() { image=null;drag=null;render(); },
    export() {
      if (!image) throw new Error('請先選擇裁切來源。');
      const output=document.createElement('canvas');output.width=512;output.height=512;paint(output);
      let result=output.toDataURL('image/png');
      if ((result.length-result.indexOf(',')-1)*.75 > IMAGE_LIMIT) result=output.toDataURL('image/webp',.85);
      if ((result.length-result.indexOf(',')-1)*.75 > IMAGE_LIMIT) throw new Error('裁切結果超過 500 KB，請使用較小圖片或調整裁切範圍。');
      return result;
    },
  };
}
