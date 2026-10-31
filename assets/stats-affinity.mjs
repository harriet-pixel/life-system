// Display only: no affinity balances or award logic live in the summary.
export function appendStatsAffinity(target,actor){
 const group=document.createElement('span');group.className='stats-affinity';
 group.innerHTML='<span aria-hidden="true">｜</span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z"/></svg><span data-stats-affinity></span>';
 const valid=actor&&Number.isSafeInteger(actor.affinity)&&actor.affinity>=0;group.querySelector('[data-stats-affinity]').textContent=valid?String(actor.affinity):'—';
 const label=valid?'當前夥伴好感度：'+actor.affinity:'目前無出場夥伴';target.append(group);target.setAttribute('aria-label',(target.getAttribute('aria-label')??'')+'，'+label);target.title=target.getAttribute('aria-label');
}
