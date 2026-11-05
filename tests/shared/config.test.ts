import { describe, expect, it } from 'vitest';
import { validateConfig, applyMonthlyChange, setDateOverride, previewChange } from '../../src/shared/config';
import { calculateMonth } from '../../src/shared/income';
import { fixture,now } from '../fixtures';
describe('config validation and monthly changes', () => {
  it('accepts valid settings, including an empty work week', () => {const c=fixture();expect(validateConfig(c).ok).toBe(true);c.schedules[0].rule={kind:'weekly',weekdays:[]};expect(validateConfig(c).ok).toBe(true);});
  it('accepts persistent panel scale without breaking existing configuration',()=>{const c=fixture()as any;c.window.scale=1.5;expect(validateConfig(c).ok).toBe(true);c.window.scale=4;expect(validateConfig(c).ok).toBe(false);});
  it.each([
    ['invalid timezone',(c:any)=>c.workTimeZone='Not/AZone'],
    ['invalid date',(c:any)=>c.dateOverrides['2026-02-30']=true],
    ['unsafe amount',(c:any)=>c.salaries[0].salaryCents=Number.MAX_SAFE_INTEGER+1],
    ['noninteger cents',(c:any)=>c.salaries[0].salaryCents=12.3],
    ['zero amount',(c:any)=>c.salaries[0].salaryCents=0],
    ['NaN',(c:any)=>c.salaries[0].salaryCents=NaN],
    ['overnight hours',(c:any)=>{c.schedules[0].hours.start='22:00';c.schedules[0].hours.end='06:00';}],
    ['outside lunch',(c:any)=>c.schedules[0].hours.lunch.end='20:00'],
    ['duplicate month',(c:any)=>c.salaries.push({...c.salaries[0]})],
    ['bad opacity',(c:any)=>c.appearance.hoverOpacity=1.3],
    ['bad reference Monday',(c:any)=>c.schedules[0].rule.anchorMonday='2026-11-03'],
    ['unrecognised schema',(c:any)=>c.schemaVersion=2],
  ])('rejects %s', (_,mutate)=>{const c=fixture();mutate(c);expect(validateConfig(c).ok).toBe(false);});
  it('starts next month without rewriting earlier income', () => {
    const original=fixture();const c=applyMonthlyChange(original,{from:'2026-12',salaryCents:1500000});
    expect(calculateMonth(c,'2026-11',now)).toEqual(calculateMonth(original,'2026-11',now));
    expect(calculateMonth(c,'2026-12',now).salaryCents).toBe(1500000);expect(original.salaries).toHaveLength(1);
  });
  it('recalculates this month only and replaces an existing same-month version',()=>{
    const original=fixture();const first=applyMonthlyChange(original,{from:'2026-11',salaryCents:1500000});
    const next=applyMonthlyChange(first,{from:'2026-11',salaryCents:1600000});
    expect(next.salaries).toHaveLength(2);expect(calculateMonth(next,'2026-11',now).salaryCents).toBe(1600000);
    expect(calculateMonth(next,'2026-10',now).salaryCents).toBe(1200000);
  });
  it('preserves date overrides and later rotation when changing schedule',()=>{
    const original=setDateOverride(fixture(),'2026-11-07',false);
    const next=applyMonthlyChange(original,{from:'2026-12',schedule:{rule:{kind:'weekly',weekdays:[1,2,3,4,5]},hours:original.schedules[0].hours}});
    expect(next.dateOverrides['2026-11-07']).toBe(false);expect(next.schedules[0].rule).toEqual(original.schedules[0].rule);
    expect(setDateOverride(next,'2026-11-07',null).dateOverrides).not.toHaveProperty('2026-11-07');
  });
  it('reports changed denominator for the whole affected month',()=>{
    const c=fixture();const next=setDateOverride(c,'2026-11-07',false);const impact=previewChange(c,next,now);
    expect(impact.affectedMonths).toEqual(['2026-11']);expect(impact.after.month.plannedSeconds).toBe(633600);
    expect(impact.after.today.earnedCents).toBeGreaterThan(impact.before.today.earnedCents);
  });
});
