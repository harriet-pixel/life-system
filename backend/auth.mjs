import {createPublicKey, verify} from 'node:crypto';
import {fail, readJSON} from './errors.mjs';
// Verifies issuer-issued RS256 access tokens, not an unsigned user ID or CORS origin.
export function createJWTVerifier({issuer,audience,jwksURL,scope='life:ai',fetcher=fetch,now=Date.now}) {
  for (const url of [issuer,jwksURL]) { const parsed=new URL(url); if (parsed.protocol!=='https:' || parsed.username || parsed.password || parsed.hash || parsed.search) throw new Error('HTTPS issuer/JWKS configuration required'); }
  if (!audience || !scope) throw new Error('Audience and authorization scope required');
  let keys = [], expires = 0, loading;
  async function getKeys() {
    if (now() < expires) return keys;
    if (!loading) loading=(async()=>{const response=await fetcher(jwksURL,{redirect:'error',signal:AbortSignal.timeout(5000)});if(!response.ok)fail('auth_unavailable',503);const value=await readJSON(response,65536);if(!Array.isArray(value.keys)||value.keys.length>50)fail('auth_unavailable',503);keys=value.keys;expires=now()+300000;})().finally(()=>loading=null);
    await loading;return keys;
  }
  return async function authenticate(authorization) {
    if (typeof authorization!=='string' || authorization.length>16384 || !authorization.startsWith('Bearer ')) fail('unauthenticated',401);
    const token=authorization.slice(7), pieces=token.split('.');if(pieces.length!==3||pieces.some(p=>!p||!/^[\w-]+$/.test(p)))fail('unauthenticated',401);
    let header,payload;
    try {header=JSON.parse(Buffer.from(pieces[0],'base64url'));payload=JSON.parse(Buffer.from(pieces[1],'base64url'));}catch{fail('unauthenticated',401);}
    if(header.alg!=='RS256'||typeof header.kid!=='string'||header.jku||header.jwk||header.x5u||header.crit)fail('unauthenticated',401);
    const epoch=now()/1000;
    if(payload.iss!==issuer||!(payload.aud===audience||Array.isArray(payload.aud)&&payload.aud.includes(audience))||typeof payload.sub!=='string'||!payload.sub||payload.sub.length>256||!Number.isFinite(payload.exp)||payload.exp<=epoch||payload.nbf!==undefined&&(!Number.isFinite(payload.nbf)||payload.nbf>epoch)||!Number.isFinite(payload.iat)||payload.iat>epoch+30||payload.exp-payload.iat>3600)fail('unauthenticated',401);
    const jwk=(await getKeys()).find(k=>k.kid===header.kid&&k.kty==='RSA'&&(!k.alg||k.alg==='RS256')&&(!k.use||k.use==='sig')&&(!k.key_ops||k.key_ops.includes('verify')));
    try {if(!jwk)fail('unauthenticated',401);const key=createPublicKey({key:jwk,format:'jwk'});if(key.asymmetricKeyDetails.modulusLength<2048||!verify('RSA-SHA256',Buffer.from(pieces[0]+'.'+pieces[1]),key,Buffer.from(pieces[2],'base64url')))fail('unauthenticated',401);}catch{fail('unauthenticated',401);}
    if(typeof payload.scope!=='string'||!payload.scope.split(' ').includes(scope))fail('forbidden',403);
    return issuer+'|'+payload.sub;
  };
}
