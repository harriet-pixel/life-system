export const DRIVE_AUTH_KEY='life-system.drive-auth.v1';
export function createDriveAuthSession(storage,clientId,{now=Date.now}={}){
 const clear=()=>storage.removeItem(DRIVE_AUTH_KEY);
 return {clear,read(){try{const raw=storage.getItem(DRIVE_AUTH_KEY);if(!raw)return null;if(raw.length>16384)throw 0;const v=JSON.parse(raw);if(v.version!==1||v.clientId!==clientId||Object.keys(v).some(k=>!['version','clientId','token','issuedAt','expiresAt'].includes(k))||typeof v.token!=='string'||!v.token||v.token.length>8192||!Number.isSafeInteger(v.issuedAt)||!Number.isSafeInteger(v.expiresAt)||v.issuedAt>now()||v.expiresAt<=now()||v.expiresAt<=v.issuedAt||v.expiresAt-v.issuedAt>3600000)throw 0;return v;}catch{clear();return null;}},write(token,seconds){const issuedAt=now(),expiresAt=issuedAt+(Math.min(3600,Number(seconds))-60)*1000;if(typeof token!=='string'||!token||token.length>8192||!Number.isSafeInteger(expiresAt)||expiresAt<=issuedAt)throw new Error('Google 授權期限無效，請重新連接。');storage.setItem(DRIVE_AUTH_KEY,JSON.stringify({version:1,clientId,token,issuedAt,expiresAt}));}};
}
// Durable intent only. Access tokens retain their original short session TTL.
export const DRIVE_LINK_KEY='life-system.drive-link.v1';
export function createDriveLink(storage,clientId){const value=()=>{try{const v=JSON.parse(storage.getItem(DRIVE_LINK_KEY));return v?.version===1&&v.clientId===clientId?v:null;}catch{return null;}};return {read:()=>value()?.linked===true,isDisconnected:()=>value()?.linked===false,remember(){storage.setItem(DRIVE_LINK_KEY,JSON.stringify({version:1,clientId,linked:true}));},clear(){storage.setItem(DRIVE_LINK_KEY,JSON.stringify({version:1,clientId,linked:false}));}};}
// Remember only an unexpired Google grant. Moving an old tab's cache preserves
// issuedAt/expiresAt exactly; reopening never renews the OAuth lifetime.
export function createRememberedDriveAuth(storage,legacyStorage,clientId,options={}){
 const remembered=createDriveAuthSession(storage,clientId,options),legacy=createDriveAuthSession(legacyStorage,clientId,options);
 return {
  read(){const value=remembered.read();if(value){legacy.clear();return value;}const prior=legacy.read();if(!prior)return null;storage.setItem(DRIVE_AUTH_KEY,JSON.stringify(prior));legacy.clear();return remembered.read();},
  write(token,seconds){remembered.write(token,seconds);legacy.clear();},
  clear(){remembered.clear();legacy.clear();}
 };
}
