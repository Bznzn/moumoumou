import type{AppConfig,ScheduleRule,WorkHours}from'../../shared/model';
import{applyMonthlyChange,validateConfig}from'../../shared/config';
import{versionFor}from'../../shared/calendar';
export function salaryText(cents:number):string{const value=BigInt(cents);return `${value/100n}.${(value%100n).toString().padStart(2,'0')}`;}
function parseSalary(text:string):number{
  if(!/^\d+(\.\d{1,2})?$/.test(text))throw Error('请输入大于零、最多两位小数的月薪');
  const[whole,fraction='']=text.split('.');if(whole.replace(/^0+/,'').length>14)throw Error('月薪超出支持范围');
  const cents=BigInt(whole)*100n+BigInt(fraction.padEnd(2,'0'));
  if(cents<1n||cents>BigInt(Number.MAX_SAFE_INTEGER))throw Error('月薪超出支持范围');return Number(cents);
}
function canonical(rule:ScheduleRule,hours:WorkHours){return JSON.stringify({rule:rule.kind==='weekly'?{kind:rule.kind,weekdays:[...rule.weekdays].sort()}:rule,hours});}
export function buildCandidate(draft:AppConfig,effective:string,salary:string,rule:ScheduleRule,hours:WorkHours):AppConfig{
  const cents=parseSalary(salary),oldSalary=versionFor(draft.salaries,effective),oldSchedule=versionFor(draft.schedules,effective);
  const change:{from:string;salaryCents?:number;schedule?:{rule:ScheduleRule;hours:WorkHours}}={from:effective};
  if(cents!==oldSalary?.salaryCents)change.salaryCents=cents;
  if(!oldSchedule||canonical(rule,hours)!==canonical(oldSchedule.rule,oldSchedule.hours))change.schedule={rule,hours};
  const candidate=applyMonthlyChange(draft,change),result=validateConfig(candidate);
  if(!result.ok)throw Error('请检查上下班时间、午休范围和排班设置');return result.value;
}
