import {emptyWallet,validateWallet,validateWalletEvidence,walletName,walletAmount,walletNote} from './wallet-model.mjs?v=restore-images-20261031';
export function createWalletService(store,{now=()=>new Date(),id=()=>crypto.randomUUID()}={}){
 const snapshot=()=>store.getFields?store.getFields(['revision','wallet','stats','history','affinity']):store.get();
 async function save(base,wallet,stats,type,transactionId,label){wallet.stateId=transactionId;return store.transact({id:transactionId,expectedRevision:base.revision,type,label,target:'wallet',changes:{wallet:validateWallet(wallet),...(stats?{stats}:{})}});}
 return {
  async spend(input,submissionId){
   if(typeof submissionId!=='string'||!/^[a-zA-Z0-9_-]{1,100}$/.test(submissionId))throw new Error('消費確認識別碼無效。');
   const base=snapshot();if(base.history.some(r=>r.id===submissionId))return false;
   const wallet=validateWallet(base.wallet??emptyWallet()),name=walletName(input.name),cost=walletAmount(input.cost),note=walletNote(input.note),sourceId=input.sourceId??null;
   if(sourceId&&!Object.hasOwn(wallet.items,sourceId))throw new Error('常用項目已刪除，請改用單次消費；輸入已保留。');
   if(base.stats.currency<cost)throw new Error('系統貨幣餘額不足，請調整花費；輸入已保留。');
   wallet.lastChange={collection:'records',id:submissionId};wallet.records[submissionId]={id:submissionId,debitId:submissionId,time:now().toISOString(),name,cost,note,sourceId,status:'active',cancelledAt:null,refundId:null};
   return save(base,wallet,{...base.stats,currency:base.stats.currency-cost},'wallet.spent',submissionId,'兌換「'+name+'」');
  },
  async editRecord(recordId,name,expected){const base=snapshot(),wallet=validateWallet(base.wallet??emptyWallet()),record=wallet.records[recordId];if(!record||JSON.stringify(record)!==expected)throw new Error('此筆紀錄已變更，請重新開啟編輯；草稿已保留。');record.name=walletName(name);wallet.lastChange={collection:'records',id:recordId};return save(base,wallet,null,'wallet.edited',id(),'編輯消費項目名稱');},
  async cancel(recordId,submissionId=id()){
   const base=snapshot(),wallet=validateWallet(base.wallet??emptyWallet()),r=wallet.records[recordId];
   if(!r||r.status!=='active')throw new Error('此筆已取消或不存在，未重複退款。');validateWalletEvidence({...base,wallet});
   const sum=BigInt(base.stats.currency)+BigInt(r.cost);if(sum>BigInt(Number.MAX_SAFE_INTEGER))throw new Error('退款後貨幣超出安全範圍，原資料已保留。');
   wallet.lastChange={collection:'records',id:recordId};r.status='cancelled';r.cancelledAt=now().toISOString();r.refundId=submissionId;
   return save(base,wallet,{...base.stats,currency:Number(sum)},'wallet.cancelled',submissionId,'取消兌換「'+r.name+'」');
  },
  async item(values,itemId=null,expectedVersion=null){
   const base=snapshot(),wallet=validateWallet(base.wallet??emptyWallet()),name=walletName(values.name),defaultCost=values.defaultCost===null?null:walletAmount(values.defaultCost),time=now().toISOString();let item=wallet.items[itemId];
   if(itemId&&(!item||item.version!==expectedVersion))throw new Error('常用項目已變更，草稿已保留，請重新確認。');
   if(item)Object.assign(item,{name,defaultCost,version:item.version+1,updatedAt:time});else{item={id:id(),name,defaultCost,version:1,createdAt:time,updatedAt:time};wallet.items[item.id]=item;}wallet.lastChange={collection:'items',id:item.id};
   return save(base,wallet,null,'wallet.item',id(),itemId?'修改常用兌換項目':'新增常用兌換項目');
  },
  async removeItem(itemId,expectedVersion){const base=snapshot(),wallet=validateWallet(base.wallet??emptyWallet()),item=wallet.items[itemId];if(!item||item.version!==expectedVersion)throw new Error('常用項目已變更，請重新確認。');delete wallet.items[itemId];wallet.lastChange={collection:'items',id:itemId};return save(base,wallet,null,'wallet.item',id(),'刪除常用兌換項目');}
 };
}
