import type { AppConfig,DateKey,MonthKey,ScheduleRule,WorkHours,Validation } from './model';
import {calculateSnapshot} from './income';
import {Temporal} from '@js-temporal/polyfill';
import {z} from 'zod';
import {calculateMonth} from './income';
import {localDate} from './calendar';

export const monthSchema=z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/);
const dateSchema=z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(value=>{try{return Temporal.PlainDate.from(value).toString()===value;}catch{return false;}},'无效日期');
const time=z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
const hours=z.object({start:time,end:time,lunch:z.object({start:time,end:time}).strict().nullable()}).strict().refine(h=>h.start<h.end&&(!h.lunch||(h.lunch.start>=h.start&&h.lunch.end<=h.end&&h.lunch.start<h.lunch.end&&!(h.lunch.start===h.start&&h.lunch.end===h.end))),'请检查上下班与午休时间');
const rule=z.discriminatedUnion('kind',[
  z.object({kind:z.literal('weekly'),weekdays:z.array(z.number().int().min(0).max(6)).max(7).refine(days=>new Set(days).size===days.length)}).strict(),
  z.object({kind:z.literal('alternating'),anchorMonday:dateSchema.refine(d=>{try{return Temporal.PlainDate.from(d).dayOfWeek===1;}catch{return false;}}),anchorType:z.enum(['big','small'])}).strict(),
]);
const uniqueMonths=(versions:{from:string}[])=>new Set(versions.map(v=>v.from)).size===versions.length;
const schema=z.object({
  schemaVersion:z.literal(1),
  workTimeZone:z.string().max(80).refine(zone=>{try{if(/^[+-]/.test(zone))return false;new Intl.DateTimeFormat('en',{timeZone:zone}).format();return true;}catch{return false;}},'无效工作时区'),
  salaries:z.array(z.object({from:monthSchema,salaryCents:z.number().int().positive().max(Number.MAX_SAFE_INTEGER)}).strict()).min(1).max(2400).refine(uniqueMonths,'生效月份重复'),
  schedules:z.array(z.object({from:monthSchema,rule,hours}).strict()).min(1).max(2400).refine(uniqueMonths,'生效月份重复'),
  dateOverrides:z.record(dateSchema,z.boolean()),
  appearance:z.object({hoverOpacity:z.number().min(.1).max(1),fullScreenOpacity:z.number().min(.1).max(1),fullScreenHoverOpacity:z.number().min(.1).max(1),milestoneYuan:z.union([z.literal(0),z.literal(10),z.literal(100)])}).strict(),
  launchAtLogin:z.boolean(),
  nativeInteraction:z.boolean().optional(),
  window:z.object({displayId:z.number().int().nullable(),x:z.number().finite(),y:z.number().finite(),hidden:z.boolean(),scale:z.number().min(.8).max(2).optional()}).strict(),
}).strict();
export function validateConfig(input:unknown):Validation {
  const result=schema.safeParse(input);
  return result.success?{ok:true,value:result.data}:{ok:false,issues:result.error.issues.map(issue=>({path:issue.path.join('.'),message:issue.message}))};
}
function checked(config:unknown):AppConfig {const result=validateConfig(config);if(!result.ok)throw Error(result.issues.map(i=>i.path+': '+i.message).join('；'));return result.value;}
export function applyMonthlyChange(config:AppConfig,change:{from:MonthKey;salaryCents?:number;schedule?:{rule:ScheduleRule;hours:WorkHours}}):AppConfig {
  monthSchema.parse(change.from);
  const next=structuredClone(config);
  if(change.salaryCents!==undefined) next.salaries=[...next.salaries.filter(v=>v.from!==change.from),{from:change.from,salaryCents:change.salaryCents}].sort((a,b)=>a.from.localeCompare(b.from));
  if(change.schedule)next.schedules=[...next.schedules.filter(v=>v.from!==change.from),{from:change.from,...structuredClone(change.schedule)}].sort((a,b)=>a.from.localeCompare(b.from));
  return checked(next);
}
export function setDateOverride(config:AppConfig,date:DateKey,value:boolean|null):AppConfig {
  dateSchema.parse(date);const next=structuredClone(config);
  if(value===null)delete next.dateOverrides[date];else next.dateOverrides[date]=value;
  return checked(next);
}
export function previewChange(before:AppConfig,after:AppConfig,nowMs:number) {
  const candidates=new Set([localDate(nowMs,before.workTimeZone).slice(0,7),...before.salaries.map(v=>v.from),...after.salaries.map(v=>v.from),...before.schedules.map(v=>v.from),...after.schedules.map(v=>v.from),...Object.keys(before.dateOverrides).map(d=>d.slice(0,7)),...Object.keys(after.dateOverrides).map(d=>d.slice(0,7))]);
  const affectedMonths=[...candidates].sort().filter(month=>JSON.stringify(calculateMonth(before,month,nowMs))!==JSON.stringify(calculateMonth(after,month,nowMs)));
  return {affectedMonths,before:calculateSnapshot(before,nowMs),after:calculateSnapshot(after,nowMs)};
}
export function defaultConfig(nowMs=Date.now(),workTimeZone=Intl.DateTimeFormat().resolvedOptions().timeZone):AppConfig {
  const date=Temporal.PlainDate.from(localDate(nowMs,workTimeZone));
  const from=date.toString().slice(0,7);
  return {schemaVersion:1,workTimeZone,salaries:[{from,salaryCents:1200000}],schedules:[{from,rule:{kind:'weekly',weekdays:[1,2,3,4,5]},hours:{start:'09:00',end:'18:00',lunch:{start:'12:00',end:'13:00'}}}],dateOverrides:{},appearance:{hoverOpacity:.28,fullScreenOpacity:.45,fullScreenHoverOpacity:.2,milestoneYuan:100},launchAtLogin:true,window:{displayId:null,x:100,y:100,hidden:false}};
}
