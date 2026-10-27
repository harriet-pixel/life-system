(function(){
const DEFAULT_APPEARANCE = Object.freeze({color:'#104a7a',font:'serif'});
const DEFAULT_SETTINGS = Object.freeze({appearance:DEFAULT_APPEARANCE,ai:Object.freeze({provider:'gemini',model:''}),});
const FONT_NAMES = Object.freeze({device:'裝置預設字體',serif:'明體',sans:'黑體',rounded:'圓體'});
const validHex=value=>typeof value==='string'&&/^#[0-9a-f]{6}$/i.test(value);
function normalizeSettings(value={}) {
  const appearance={...DEFAULT_APPEARANCE,...value.appearance};
  if(!validHex(appearance.color)||!Object.hasOwn(FONT_NAMES,appearance.font)) throw new Error('外觀設定格式不正確。');
  const {history,ai,...other}=value;
  const preference=ai??DEFAULT_SETTINGS.ai;
  if(value.companionImages!==undefined&&(!value.companionImages||typeof value.companionImages!=='object'||Object.keys(value.companionImages).length!==1||!['direct','fade'].includes(value.companionImages.transition)))throw new Error('夥伴圖片切換設定不正確。');
  if(!preference||typeof preference!=='object'||Array.isArray(preference)||Object.keys(preference).some(key=>!['provider','model'].includes(key))||!['gemini','deepseek','openai','claude'].includes(preference.provider)||typeof preference.model!=='string'||preference.model.length>207)throw new Error('AI 偏好格式不正確；不接受金鑰或連線狀態。');
  return {...other,ai:{provider:preference.provider,model:preference.model},appearance:{color:appearance.color.toLowerCase(),font:appearance.font}};
}
function luminance(hex) {
  const values=hex.slice(1).match(/../g).map(x=>parseInt(x,16)/255).map(x=>x<=.04045?x/12.92:((x+.055)/1.055)**2.4);
  return values[0]*.2126+values[1]*.7152+values[2]*.0722;
}
function themeTokens(color) {
  const l=luminance(color),on=(l+.05)/.05>=4.5?'#000000':'#ffffff';
  const tint='#'+color.slice(1).match(/../g).map(x=>Math.round(parseInt(x,16)*18/255+237).toString(16).padStart(2,'0')).join('');
  let control=color;
  while(Math.min(1.05,luminance(tint)+.05)/(luminance(control)+.05)<4.5) control='#'+control.slice(1).match(/../g).map(x=>Math.floor(parseInt(x,16)*.9).toString(16).padStart(2,'0')).join('');
  const blend=(hex,factor)=>'#'+hex.slice(1).match(/../g).map(x=>Math.round(parseInt(x,16)*factor).toString(16).padStart(2,'0')).join('');
  return {'--color-primary':control,'--color-accent':color,'--color-on-accent':on,'--color-on-primary':'#ffffff','--color-primary-hover':blend(control,.8),'--color-primary-active':blend(control,.65),'--color-focus':control,'--color-tint':tint};
}

const fontFamilies={device:'system-ui, -apple-system, "Segoe UI", sans-serif',serif:'"Noto Serif TC Variable", "Noto Serif TC", serif',sans:'"Noto Sans TC Variable", system-ui, sans-serif',rounded:'Huninn, "Noto Sans TC Variable", system-ui, sans-serif'};
function applyAppearance(appearance,root=document.documentElement) {
 for(const [key,value] of Object.entries(themeTokens(appearance.color)))root.style.setProperty(key,value);
 for(const key of ['--font-body','--font-serif','--font-latin'])root.style.setProperty(key,fontFamilies[appearance.font]);
 root.dataset.font=appearance.font;
 if(appearance.font!=='device') {
  const names={serif:'noto-serif-tc',sans:'noto-sans-tc',rounded:'huninn'};
  const href=new URL('fonts/'+names[appearance.font]+'/font.css',document.querySelector('script[data-appearance-core]').src).href;
  if(!document.querySelector('link[data-selected-font="'+appearance.font+'"]')){const link=document.createElement('link');link.rel='stylesheet';link.href=href;link.dataset.selectedFont=appearance.font;document.head.append(link);}
 }
}
globalThis.LifeAppearance={DEFAULT_APPEARANCE,DEFAULT_SETTINGS,FONT_NAMES,normalizeSettings,validHex,luminance,themeTokens,applyAppearance};
if(typeof document!=='undefined')try{const saved=JSON.parse(localStorage.getItem('life-system.data.v1')||'{}');applyAppearance(normalizeSettings(saved.settings).appearance);}catch{applyAppearance(DEFAULT_APPEARANCE);}
})();
