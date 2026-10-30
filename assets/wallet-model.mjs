// Currency lives exclusively in stats. Ledger snapshots never refer to mutable item names.
export const emptyWallet=()=>({version:1,stateId:'initial',lastChange:null,items:{},records:{}});
const check=(ok,message='錢包資料無法安全核對，原資料已保留。')=>{if(!ok)throw new Error(message);};
const stamp=s=>typeof s==='string'&&Number.isFinite(Date.parse(s));
const id=s=>typeof s==='string'&&/^[a-zA-Z0-9:_-]{1,180}$/.test(s)&&!Object.hasOwn(Object.prototype,s)&&s!=='prototype';
const amount=n=>Number.isSafeInteger(n)&&n>0;
export function walletName(value){check(typeof value==='string'&&value.trim().length>0&&[...value.trim()].length<=100,'請輸入100字以內的項目名稱。');return value.trim();}
export function walletAmount(value){check(typeof value==='number'&&amount(value),'花費須為大於0的安全整數。');return value;}
export function walletNote(value=''){check(typeof value==='string'&&[...value].length<=1000,'備註最多1000字。');return value.trim();}
export function validateWallet(raw,{shallow=false}={}){
 check(raw&&raw.version===1&&id(raw.stateId)&&raw.items&&typeof raw.items==='object'&&!Array.isArray(raw.items)&&raw.records&&typeof raw.records==='object'&&!Array.isArray(raw.records)&&Object.keys(raw).every(k=>['version','stateId','lastChange','items','records'].includes(k))&&(raw.lastChange===null||raw.lastChange&&['items','records'].includes(raw.lastChange.collection)&&id(raw.lastChange.id)));
 if(shallow)return raw;
 const ids=new Set();for(const [key,item] of Object.entries(raw.items)){check(key===item.id&&id(item.id)&&!ids.has(item.id)&&Number.isSafeInteger(item.version)&&item.version>=1&&stamp(item.createdAt)&&stamp(item.updatedAt));ids.add(item.id);walletName(item.name);check(item.defaultCost===null||amount(item.defaultCost));check(Object.keys(item).every(k=>['id','version','name','defaultCost','createdAt','updatedAt'].includes(k)));}
 const refunds=new Set(),totals=new Map();ids.clear();for(const [key,r] of Object.entries(raw.records)){check(key===r.id&&id(r.id)&&!ids.has(r.id)&&id(r.debitId)&&r.debitId===r.id&&stamp(r.time)&&(r.sourceId===null||id(r.sourceId))&&['active','cancelled'].includes(r.status));ids.add(r.id);if(r.status==='cancelled'){check(!refunds.has(r.refundId));refunds.add(r.refundId);}else{const month=localMonth(r.time),total=(totals.get(month)??0n)+BigInt(r.cost);check(total<=BigInt(Number.MAX_SAFE_INTEGER),'有效月份花費超出安全範圍，整筆未儲存。');totals.set(month,total);}walletName(r.name);walletAmount(r.cost);walletNote(r.note);check(r.status==='active'?r.cancelledAt===null&&r.refundId===null:stamp(r.cancelledAt)&&id(r.refundId));check(Object.keys(r).every(k=>['id','debitId','time','sourceId','name','cost','note','status','cancelledAt','refundId'].includes(k)));}
 return structuredClone(raw);
}
export function validateWalletEvidence(doc){
 const w=validateWallet(doc.wallet??emptyWallet()),actions=new Map(doc.history.map(r=>[r.id,r])),affinityBySource=new Map();for(const t of doc.affinity?.transactions??[]){if(!t.sourceKey.startsWith('wallet:'))continue;const group=affinityBySource.get(t.sourceKey)??[];group.push(t);affinityBySource.set(t.sourceKey,group);}
 for(const r of Object.values(w.records)){const source=doc.affinity?.sources?.['wallet:'+r.id];check(source&&source.ceiling===1&&source.origin===r.debitId&&source.quantity===(r.status==='active'?1:0),'消費缺少有效好感度來源證據。');for(const t of affinityBySource.get('wallet:'+r.id)??[])check(t.kind==='grant'?t.requested===1&&t.actual>=0&&t.actual<=1:t.kind==='revoke'&&t.requested<=0&&t.requested>=-1&&t.actual<=0&&t.actual>=-1,'消費好感度交易數量不正確。');const debit=actions.get(r.debitId);check(debit?.type==='wallet.spent'&&!debit.undone&&debit.delta.currency===-r.cost&&debit.delta.experience===0&&debit.delta.level===0&&debit.delta.abilities.every(a=>a.value===0),'消費缺少有效扣款來源。');if(r.status==='cancelled'){const refund=actions.get(r.refundId);check(refund?.type==='wallet.cancelled'&&!refund.undone&&refund.delta.currency===r.cost&&refund.delta.experience===0&&refund.delta.level===0&&refund.delta.abilities.every(a=>a.value===0),'取消消費缺少有效退款來源。');}}
 return true;
}
export const localMonth=time=>{const d=new Date(time);return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;};
export function monthLedger(wallet,month){check(/^\d{4}-\d{2}$/.test(month),'請選擇有效月份。');const rows=Object.values(wallet.records).filter(r=>localMonth(r.time)===month).sort((a,b)=>Date.parse(b.time)-Date.parse(a.time)||b.id.localeCompare(a.id));const total=rows.reduce((sum,r)=>sum+(r.status==='active'?BigInt(r.cost):0n),0n);check(total<=BigInt(Number.MAX_SAFE_INTEGER),'月份合計超出安全範圍。');return {rows,total:Number(total)};}
