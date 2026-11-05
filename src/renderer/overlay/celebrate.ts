import type{IncomeSnapshot}from'../../shared/model';
export function shouldCelebrate(previous:IncomeSnapshot|null,next:IncomeSnapshot,threshold:0|10|100,reason:'tick'|'refresh'):boolean{
  if(!previous||threshold===0||reason!=='tick'||previous.state!=='working'||next.state!=='working'||previous.date!==next.date||previous.month.rateCentsPerSecond!==next.month.rateCentsPerSecond||previous.month.plannedSeconds!==next.month.plannedSeconds)return false;
  const seconds=next.today.elapsedSeconds-previous.today.elapsedSeconds;
  if(seconds<=0||seconds>2)return false;
  return Math.floor(next.today.earnedCents/(threshold*100))>Math.floor(previous.today.earnedCents/(threshold*100));
}
