import { Temporal } from '@js-temporal/polyfill';
import type { AppConfig, MonthKey, MonthIncome, IncomeSnapshot, WorkState } from './model';
import { localDate, monthDates, plannedIntervals, versionFor, isWorkday } from './calendar';

export function calculateMonth(config: AppConfig, month: MonthKey, nowMs: number): MonthIncome {
  const salaryCents=versionFor(config.salaries,month)?.salaryCents??null;
  const days=monthDates(month).map(date=>{
    const ranges=plannedIntervals(date,config);
    const plannedSeconds=ranges.reduce((n,r)=>n+(r.end-r.start)/1000,0);
    const elapsedSeconds=ranges.reduce((n,r)=>n+Math.max(0,Math.min(nowMs,r.end)-r.start)/1000,0);
    return { date, plannedSeconds,elapsedSeconds,earnedCents:0,isWorkday:isWorkday(date,config) };
  });
  const plannedSeconds=days.reduce((n,d)=>n+d.plannedSeconds,0);
  const rateCentsPerSecond=plannedSeconds>0&&salaryCents!==null?salaryCents/plannedSeconds:0;
  days.forEach(day=>{day.earnedCents=day.elapsedSeconds*rateCentsPerSecond;});
  const elapsed=days.reduce((n,d)=>n+d.elapsedSeconds,0);
  const earnedCents=plannedSeconds>0&&elapsed>=plannedSeconds&&salaryCents!==null?salaryCents:elapsed*rateCentsPerSecond;
  return {month,salaryCents,plannedSeconds,rateCentsPerSecond,days,earnedCents,isFuture:month>localDate(nowMs,config.workTimeZone).slice(0,7)};
}
export function calculateSnapshot(config:AppConfig,nowMs:number):IncomeSnapshot {
  const date=localDate(nowMs,config.workTimeZone);
  const month=calculateMonth(config,date.slice(0,7),nowMs);
  const today=month.days.find(day=>day.date===date)!;
  const ranges=plannedIntervals(date,config);
  let state:WorkState;
  if(month.salaryCents===null||!versionFor(config.schedules,month.month)) state='unconfigured';
  else if(month.plannedSeconds===0) state='no-plan';
  else if(!today.isWorkday) state='rest';
  else if(!ranges.length) state='no-plan';
  else if(nowMs<ranges[0].start) state='before';
  else if(nowMs>=ranges.at(-1)!.end) state='finished';
  else if(ranges.some(r=>nowMs>=r.start&&nowMs<r.end)) state='working';
  else state='lunch';
  let nextWorkAt:number|null=null;
  const start=Temporal.PlainDate.from(date);
  for(let offset=0;offset<=366;offset++) {
    const day=start.add({days:offset}).toString();
    const next=plannedIntervals(day,config).find(r=>r.start>nowMs);
    if(next) {nextWorkAt=next.start;break;}
  }
  return {state,date,today,month,nextWorkAt};
}
