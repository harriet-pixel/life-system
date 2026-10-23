// Text limits count Unicode code points (Array.from): emoji are never split.
// Existing values are readable/exportable; only changed fields use new limits.
export const TEXT_LIMITS=Object.freeze({name:30,motto:100,bio:2000,boundaries:2000});
export const FIELD_NAMES=Object.freeze({name:'稱呼',motto:'一句話',bio:'個人簡介',boundaries:'禁忌'});
export const textLength=value=>Array.from(value).length;
const fail=(message,field)=>{throw Object.assign(new Error(message),{field});};
export function validateProfileFields(value,previous,{reading=false}={}){
 if(!value||typeof value!=='object')fail('個人資料格式不正確。','profile');
 for(const key of ['name','age','gender','bio','boundaries','motto'])if(value[key]!==undefined&&typeof value[key]!=='string')fail('個人資料欄位必須為文字。',key);
 const result=Object.fromEntries(['name','age','gender','bio','boundaries','motto'].map(k=>[k,String(value[k]??'')]));
 for(const [key,max] of Object.entries(TEXT_LIMITS))if(!reading&&result[key]!==previous?.[key]&&textLength(result[key])>max)fail(`${FIELD_NAMES[key]}最多 ${max} 字（依 Unicode 字元計算），請調整後再儲存。`,key);
 if(result.age!==previous?.age||reading){if(result.age!==''&&(!/^\d+$/.test(result.age)||!Number.isSafeInteger(Number(result.age))))fail('年齡請填寫有效的非負安全整數，或留白。','age');}
 if(!reading&&result.gender!==previous?.gender&&!['','男','女'].includes(result.gender))fail('請使用既有性別選項，或留白。','gender');
 return result;
}
export function validateNewPassword(value,{required=false}={}){
 if(typeof value!=='string')fail('備份密碼格式不正確。','password');
 if(!value&&!required)return value;
 if(value.length<8||value.length>64||!/^[\x20-\x7e]+$/.test(value))fail('備份密碼須為 8–64 碼英文、數字或符號（可含空格）；留白則不加密。','password');
 return value;
}
export function validateRestorePassword(value){if(typeof value!=='string'||value.length>1024)fail('還原密碼上限為 1,024 個 UTF-16 碼元；不改寫密碼。','password');return value;}
export {validHex} from './settings-model.mjs?v=task-pool-5';
export function integerValue(value,field){const text=String(value??'').trim();if(!/^\d+$/.test(text)||!Number.isSafeInteger(Number(text)))fail('請填寫非負安全整數，不可留白、填負數或小數。',field);return Number(text);}
export function validateHistoryPage(value,total){const n=integerValue(value,'history');if(n<1||n>total)fail(`請輸入 1 至 ${total} 的整數頁碼。`,'history');return n;}
export function bindProfileValidation(form,getPrevious){
 for(const [key,max] of Object.entries(TEXT_LIMITS)){
  const input=form.elements[key];input.removeAttribute('maxlength');
  const hint=document.createElement('span');hint.className='small-note';hint.id=key+'-limit';hint.textContent=` （${textLength(input.value)}／${max}）`;const caption=document.createElement('span');caption.className='field-caption';const label=input.closest('label');const name=label.firstChild;if(name?.nodeType===3)caption.append(name);caption.append(hint);input.before(caption);
  const error=document.createElement('span');error.className='field-error';error.id=key+'-error';error.setAttribute('aria-live','polite');input.after(error);input.setAttribute('aria-describedby',[input.getAttribute('aria-describedby'),hint.id,error.id].filter(Boolean).join(' '));
  const check=()=>{hint.textContent=` （${textLength(input.value)}／${max}）`;const over=input.value!==getPrevious()?.[key]&&textLength(input.value)>max;error.textContent=over?`${FIELD_NAMES[key]}最多 ${max} 字，請調整後再儲存。`:'';if(over)input.setAttribute('aria-invalid','true');else input.removeAttribute('aria-invalid');};
  input.addEventListener('input',event=>{if(!event.isComposing)check();});input.addEventListener('compositionend',check);input.addEventListener('profile-populate',check);
 }
}

export function validateZoom(value,max=4){const n=Number(value);if(!Number.isFinite(n)||n<1||n>max)fail('縮放須介於 1 與目前允許的上限。','zoom');return n;}
export function validateActivities(value){if(!value||typeof value!=='object'||Array.isArray(value)||!Object.values(value).every(v=>typeof v==='boolean'))fail('待辦與打卡狀態格式不正確。','activities');return value;}
