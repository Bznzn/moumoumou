import { describe, expect, it } from 'vitest';
import { isWorkday, plannedIntervals } from '../../src/shared/calendar';
import { fixture } from '../fixtures';
describe('work calendar', () => {
  it.each([['2026-11-07',true],['2026-11-14',false],['2026-11-21',true],['2026-11-28',false],['2026-12-05',true],['2026-12-19',true],['2026-10-31',false],['2027-01-02',true],['2026-11-08',false]])('keeps two week phase at %s', (date, expected) => { expect(isWorkday(date as string,fixture())).toBe(expected); });
  it('allows date overrides without shifting rotation', () => {
    const c=fixture(); c.dateOverrides['2026-11-07']=false; c.dateOverrides['2026-11-08']=true;
    expect(isWorkday('2026-11-07',c)).toBe(false); expect(isWorkday('2026-11-08',c)).toBe(true); expect(isWorkday('2026-11-14',c)).toBe(false);
  });
  it('supports arbitrary weekly days and no lunch', () => {
    const c=fixture(); c.schedules[0].rule={kind:'weekly',weekdays:[0,2]}; c.schedules[0].hours.lunch=null;
    expect(isWorkday('2026-11-01',c)).toBe(true);
    const ranges=plannedIntervals('2026-11-03',c);
    expect(ranges).toHaveLength(1); expect(ranges[0].end-ranges[0].start).toBe(32400000);
  });
  it('splits out lunch at exact local boundaries', () => {
    expect(plannedIntervals('2026-11-04',fixture())).toEqual([{start:Date.parse('2026-11-04T01:00Z'),end:Date.parse('2026-11-04T04:00Z')},{start:Date.parse('2026-11-04T05:00Z'),end:Date.parse('2026-11-04T10:00Z')}]);
  });
  it('uses actual zoned duration across daylight saving transitions', () => {
    const c=fixture();c.workTimeZone='America/New_York'; c.schedules[0].rule={kind:'weekly',weekdays:[0]};c.schedules[0].hours={start:'00:00',end:'04:00',lunch:null};
    const range=plannedIntervals('2026-11-01',c)[0]; expect((range.end-range.start)/3600000).toBe(5);
  });
});
