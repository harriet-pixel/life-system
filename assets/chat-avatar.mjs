import {acquireAvatarURL} from './daily-avatar.mjs?v=task-yesterday-20261103';
// Transient, reference-counted square crops from original images, never stored assets.
const crops=new Map();
export function chatAvatarPixels(width,density=1){const size=Number.isFinite(width)&&width>0?width:44,ratio=Number.isFinite(density)&&density>0?density:1;return Math.min(1024,Math.max(64,Math.ceil(size*ratio/64)*64));}
export async function acquireChatAvatar(item,pixels){
 const key=JSON.stringify([item.image,item.crop,pixels]);let entry=crops.get(key);
 if(!entry){entry={refs:0,promise:acquireAvatarURL(item,pixels)};crops.set(key,entry);}entry.refs++;
 let lease;try{lease=await entry.promise;}catch(error){entry.refs--;if(crops.get(key)===entry&&entry.refs===0)crops.delete(key);throw error;}
 let released=false;return {url:lease.url,cropped:lease.cropped,release(){if(released)return;released=true;if(--entry.refs===0){if(crops.get(key)===entry)crops.delete(key);lease.release();}}};
}
