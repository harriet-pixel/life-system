// Draft-only presentation. Saving and validation remain with the original form.
const mounted=new WeakMap();
export function mountColorField(input){
 if(mounted.has(input))return mounted.get(input);
 const label=input?.closest('label');if(!label)return()=>{};
 label.classList.add('color-field-row');
 if(!label.querySelector('.color-field-caption')){
  const caption=document.createElement('span');caption.className='color-field-caption';
  for(const node of [...label.childNodes])if(node.nodeType===Node.TEXT_NODE&&node.textContent.trim())caption.append(node);
  label.prepend(caption);
 }
 let preview=label.querySelector('[data-color-preview]');
 // Native color inputs already provide a live swatch; HEX inputs use this preview.
 if(!preview&&input.type!=='color'){
  preview=document.createElement('span');preview.dataset.colorPreview='';preview.className='color-preview';preview.setAttribute('role','img');label.append(preview);
 }
 const update=()=>{if(!preview)return;const value=input.value.trim(),valid=/^#[0-9a-f]{6}$/i.test(value);preview.style.backgroundColor=valid?value:'transparent';preview.setAttribute('aria-label',valid?'色彩預覽 '+value:value?'色碼尚未有效':'預設文字色');preview.title=preview.getAttribute('aria-label');};
 input.addEventListener('input',update);input.addEventListener('change',update);update();mounted.set(input,update);return update;
}
