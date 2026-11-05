import { describe, expect, it } from 'vitest';
import { calculateMonth, calculateSnapshot } from '../../src/shared/income';
import { fixture, now } from '../fixtures';
describe('income by schedule rather than running time', () => {
  it('calculates November from 23 complete planned days', () => {
    const result=calculateSnapshot(fixture(),now);
    expect(result.month.plannedSeconds).toBe(662400);
    expect(result.month.days.filter(d=>d.isWorkday)).toHaveLength(23);
    expect(result.today.earnedCents).toBeCloseTo(32608.695652,5);
    expect(result.month.earnedCents).toBeCloseTo(136956.521739,5);
    expect(result.state).toBe('working');
  });
  it.each([['08:59','before',0],['12:00','lunch',19565.217391],['12:59','lunch',19565.217391],['13:00','working',19565.217391],['18:00','finished',52173.913043],['23:59','finished',52173.913043]])('handles %s boundary', (time,state,earned) => {
    const result=calculateSnapshot(fixture(),Date.parse(`2026-11-04T${time}:00+08:00`));expect(result.state).toBe(state);expect(result.today.earnedCents).toBeCloseTo(earned as number,4);
  });
  it('shows rest day and searches actual next work day', () => {
    const result=calculateSnapshot(fixture(),Date.parse('2026-11-14T15:00+08:00'));
    expect(result.state).toBe('rest');expect(result.today.earnedCents).toBe(0);expect(result.nextWorkAt).toBe(Date.parse('2026-11-16T09:00+08:00'));
  });
  it('caps monthly earned at exact salary without summing rounded day values', () => {
    expect(calculateMonth(fixture(),'2026-11',Date.parse('2026-12-01T00:00+08:00')).earnedCents).toBe(1200000);
  });
  it('returns zero earned for future months and unknown history', () => {
    expect(calculateMonth(fixture(),'2026-12',now).earnedCents).toBe(0);
    expect(calculateMonth(fixture(),'2026-09',now).salaryCents).toBeNull();
  });
  it('has a finite no-plan state for an empty week', () => {
    const c=fixture();c.schedules[0].rule={kind:'weekly',weekdays:[]};const r=calculateSnapshot(c,now);
    expect(r.state).toBe('no-plan');expect(r.month.rateCentsPerSecond).toBe(0);expect(r.nextWorkAt).toBeNull();
  });
  it('recomputes wake and backward clock jumps without accumulated drift', () => {
    const morning=Date.parse('2026-11-04T10:00+08:00');
    const first=calculateSnapshot(fixture(),morning);calculateSnapshot(fixture(),now);
    expect(calculateSnapshot(fixture(),morning)).toEqual(first);
    expect(calculateSnapshot(fixture(),now+3600000).today.elapsedSeconds-first.today.elapsedSeconds).toBe(18000);
  });
  it('keeps saved work timezone independent of process timezone', () => {
    const prior=process.env.TZ;try { process.env.TZ='America/Los_Angeles';expect(calculateSnapshot(fixture(),now).date).toBe('2026-11-04');expect(calculateSnapshot(fixture(),now).today.earnedCents).toBeCloseTo(32608.695652,5); } finally { process.env.TZ=prior; }
  });
});
