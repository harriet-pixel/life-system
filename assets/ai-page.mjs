import {getSharedAIConnection} from './ai-runtime.mjs?v=habits-20261026';
import {mountAITestPanel} from './ai-test-panel.mjs?v=habits-20261026';
export function mountAIPage(root,context){
const connection=getSharedAIConnection(),panel=document.createElement('details');panel.className='ai-developer-test settings-section';panel.hidden=true;
const title=document.createElement('summary');title.textContent='開發用 AI 跨頁測試';panel.append(title);
const note=document.createElement('p');note.className='small-note';note.textContent='瀏覽器直連測試模式；金鑰僅在本分頁暫存，個人後端登入或瀏覽器直連備用模式；首頁夥伴仍使用 mock。';panel.append(note);
const link=document.createElement('a');link.href=new URL('../settings.html#ai',import.meta.url);link.textContent='前往設定 → AI 連線';panel.append(link);
const clear=document.createElement('button');clear.type='button';clear.textContent='中斷連線並清除金鑰';clear.addEventListener('click',()=>connection.disconnect());panel.append(clear);
const content=document.createElement('div');content.className='ai-test-content';panel.append(content);root.querySelector('#main').append(panel);mountAITestPanel(content,connection,{context});
let shown=false;context.subscribe(connection,state=>{panel.hidden=state.mode!=='browser'&&!state.backendReady;if(!shown&&!panel.hidden){panel.open=true;shown=true;}});

}
