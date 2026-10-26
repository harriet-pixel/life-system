// Display totals use the rewards actually earned, including older point versions.
export function todayBonusTotals(habits,date){
 const groups=new Map();
 for(const record of habits.bonusRecords){
  if(record.date!==date||record.cancelledAt)continue;
  let group=groups.get(record.itemId);
  if(!group){group={itemId:record.itemId,name:record.name,points:0,count:0};groups.set(record.itemId,group);}
  group.points+=record.reward.points;group.count++;
 }
 for(const group of groups.values())group.name=habits.bonusItems.find(item=>item.id===group.itemId)?.versions.at(-1)?.name??group.name;
 return [...groups.values()];
}
