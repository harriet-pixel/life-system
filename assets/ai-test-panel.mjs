const element=(tag,text)=>{const node=document.createElement(tag);if(text!==undefined)node.textContent=text;return node;};
export function mountAITestPanel(container,connection,{statusElement}={}){
 const label=element('label','短文字測試（最多 1,000 字元）'),input=element('textarea');input.rows=3;input.maxLength=1000;input.spellcheck=false;label.append(input);
 const budgetLabel=element('label','輸出上限'),budget=element('select');for(const value of [64,128,256])budget.append(new Option(value+' tokens',String(value)));budget.value='128';budgetLabel.append(budget);
 const note=element('p','送出會產生 API 費用；只傳送你在此輸入的文字，不附帶個人資料、歷史或圖片。');note.className='small-note';
 const actions=element('div');actions.className='settings-actions';const send=element('button','送出測試'),cancel=element('button','取消請求');send.type=cancel.type='button';actions.append(send,cancel);
 const status=statusElement??element('p');status.setAttribute('role','status');const output=element('pre');output.className='ai-test-output';output.setAttribute('aria-label','AI 測試回應');
 container.append(label,budgetLabel,note,actions);if(!statusElement)container.append(status);container.append(output);
 let sequence=0;
 connection.subscribe(state=>{send.disabled=state.busy||!(state.connected&&state.model||state.restorableModel);cancel.disabled=!state.busy;status.textContent=state.message;if(!state.hasKey){sequence++;output.textContent='';}if(state.status==='loading')output.textContent='';});
 send.addEventListener('click',async()=>{
  const text=input.value;if(!text.trim()||text.length>1000){status.textContent='請輸入 1–1,000 字元的測試文字。';return;}
  const version=++sequence;output.textContent='';const result=await connection.generate({text,maxOutputTokens:Number(budget.value)});
  if(version===sequence&&result)output.textContent=result.text;
 });
 cancel.addEventListener('click',()=>{sequence++;connection.cancel();});
}
