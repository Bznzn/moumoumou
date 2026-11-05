import {describe,expect,it} from 'vitest';
import {restorePlacement} from '../../src/main/windows';
const displays=[{id:1,workArea:{x:0,y:32,width:1710,height:1000}},{id:2,workArea:{x:1710,y:-413,width:2560,height:1440}}];
const pos=(x:number,y:number,id:number|null=2)=>({x,y,displayId:id,hidden:false});
describe('recover visible panel placement',()=>{
  it('preserves negative display origin placement',()=>{expect(restorePlacement(pos(1800,-300),displays)).toEqual({x:1800,y:-300});});
  it('clamps to a remaining display after unplug',()=>{expect(restorePlacement(pos(3000,-300),[displays[0]])).toEqual({x:1410,y:32});});
  it('clamps panel size to changed work area',()=>{expect(restorePlacement(pos(1600,1000,1),[displays[0]])).toEqual({x:1410,y:850});});
  it('uses restored scale when clamping a stretched panel',()=>{expect(restorePlacement({...pos(1600,1000,1),scale:1.5}as any,[displays[0]])).toEqual({x:1260,y:759});});
});
