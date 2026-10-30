// Bounded recovery evidence: one item/receipt plus a document identity, never the ledger.
const ordered=v=>Array.isArray(v)?v.map(ordered):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,ordered(v[k])])):v;
const equal=(a,b)=>JSON.stringify(ordered(a))===JSON.stringify(ordered(b));
export function walletSnapshots(before,after){
 const {collection,id}=after.lastChange??{};if(!['items','records'].includes(collection)||!id)throw new Error('錢包缺少單筆交易來源。');
 const snapshot=w=>({snapshotVersion:1,stateId:w.stateId,lastChange:w.lastChange,collection,id,value:structuredClone(w[collection][id]??null)});
 return {before:snapshot(before),after:snapshot(after)};
}
export function walletMatches(wallet,snapshot){return Boolean(wallet&&snapshot?.snapshotVersion===1&&wallet.stateId===snapshot.stateId&&equal(wallet.lastChange,snapshot.lastChange)&&equal(wallet[snapshot.collection]?.[snapshot.id]??null,snapshot.value));}
export function applyWalletSnapshot(wallet,snapshot){if(snapshot.value===null)delete wallet[snapshot.collection][snapshot.id];else wallet[snapshot.collection][snapshot.id]=structuredClone(snapshot.value);wallet.stateId=snapshot.stateId;wallet.lastChange=structuredClone(snapshot.lastChange);}
export function validateWalletSnapshot(s){if(!s||s.snapshotVersion!==1||typeof s.stateId!=='string'||!['items','records'].includes(s.collection)||typeof s.id!=='string'||(s.value!==null&&s.value?.id!==s.id)||!Object.hasOwn(s,'lastChange')||Object.keys(s).some(k=>!['snapshotVersion','stateId','lastChange','collection','id','value'].includes(k)))throw new Error('錢包復原來源不正確。');return s;}
