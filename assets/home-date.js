// Runs immediately beside the date markup, before module hydration. Uses device local time.
(function(){
 function render(root=document){const time=root.querySelector('.date-block time');if(!time)return;const now=new Date(),year=now.getFullYear(),month=String(now.getMonth()+1).padStart(2,'0'),day=String(now.getDate()).padStart(2,'0');time.dateTime=`${year}-${month}-${day}`;time.querySelector('.date-month').textContent=month;time.querySelector('.date-day').textContent=day;time.querySelector('.date-detail').textContent=`${year} 年・星期${'日一二三四五六'[now.getDay()]}`;}
 globalThis.LifeHomeDate={render};render();
})();
