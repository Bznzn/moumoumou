import {describe,expect,it,vi} from 'vitest';
import {startupWindows,clockSnapshot,prepareApplicationRole} from '../../src/main/lifecycle';
import {fixture,now} from '../fixtures';
describe('startup and wake policy',()=>{
  it('preserves the packaged LSUIElement role and only configures unpackaged development',()=>{
    const setActivationPolicy=vi.fn();prepareApplicationRole({isPackaged:true,setActivationPolicy},false);expect(setActivationPolicy).not.toHaveBeenCalled();
    prepareApplicationRole({isPackaged:false,setActivationPolicy},true);expect(setActivationPolicy).not.toHaveBeenCalled();
    prepareApplicationRole({isPackaged:false,setActivationPolicy},false);expect(setActivationPolicy).toHaveBeenCalledExactlyOnceWith('accessory');
  });
  it('shows setup only without saved config',()=>{expect(startupWindows(null)).toEqual({settings:true,overlay:false});expect(startupWindows(fixture())).toEqual({settings:false,overlay:true});});
  it('recomputes after resume rather than counting paused timer ticks',()=>{const c=fixture();const before=clockSnapshot(c,()=>Date.parse('2026-11-04T10:00+08:00'));const after=clockSnapshot(c,()=>now);expect(before?.today.elapsedSeconds).toBe(3600);expect(after?.today.elapsedSeconds).toBe(18000);expect(clockSnapshot(null,()=>now)).toBeNull();});
});
