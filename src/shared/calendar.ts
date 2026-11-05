import { Temporal } from '@js-temporal/polyfill';
import type { AppConfig, DateKey, MonthKey } from './model';

export function versionFor<T extends {from: MonthKey}>(versions: T[], month: MonthKey): T | undefined {
  return versions.filter(v => v.from <= month).sort((a,b) => a.from.localeCompare(b.from)).at(-1);
}
export function localDate(nowMs:number,zone:string):DateKey { return Temporal.Instant.fromEpochMilliseconds(nowMs).toZonedDateTimeISO(zone).toPlainDate().toString(); }
export function monthDates(month:MonthKey):DateKey[] {
  const first=Temporal.PlainDate.from(month+'-01');
  return Array.from({length:first.daysInMonth},(_,index)=>first.add({days:index}).toString());
}
export function isWorkday(date: DateKey, config: AppConfig): boolean {
  const schedule=versionFor(config.schedules,date.slice(0,7));
  if(!schedule) return false;
  if(Object.hasOwn(config.dateOverrides,date)) return config.dateOverrides[date];
  const day=Temporal.PlainDate.from(date);
  const weekday=day.dayOfWeek%7;
  if(schedule.rule.kind==='weekly') return schedule.rule.weekdays.includes(weekday);
  const delta=day.since(Temporal.PlainDate.from(schedule.rule.anchorMonday),{largestUnit:'day'}).days;
  const even=((Math.floor(delta/7)%2)+2)%2===0;
  const big=schedule.rule.anchorType==='big'?even:!even;
  return weekday>=1&&weekday<=5||weekday===6&&big;
}
export function plannedIntervals(date: DateKey, config: AppConfig): Array<{start: number;end:number}> {
  const schedule=versionFor(config.schedules,date.slice(0,7));
  if(!schedule||!isWorkday(date,config)) return [];
  const {hours}=schedule;
  const at=(time:string)=>Temporal.PlainDate.from(date).toZonedDateTime({timeZone:config.workTimeZone,plainTime:Temporal.PlainTime.from(time)}).epochMilliseconds;
  const ranges=hours.lunch?[[hours.start,hours.lunch.start],[hours.lunch.end,hours.end]]:[[hours.start,hours.end]];
  return ranges.map(([start,end])=>({start:at(start),end:at(end)})).filter(r=>r.end>r.start);
}
