import {describe,expect,it} from 'vitest';
import {resolveOverlay} from '../../src/main/window-policy';
import {fixture} from '../fixtures';
describe('overlay policy',()=>{
  it.each([[false,false,false,1],[true,false,false,.28],[false,false,true,.45],[true,false,true,.2],[true,true,true,1]])('derives opacity for hover %s drag %s full %s',(hovered,dragging,otherAppFullscreen,opacity)=>{
    expect(resolveOverlay(fixture(),{hovered:hovered as boolean,dragging:dragging as boolean,otherAppFullscreen:otherAppFullscreen as boolean,userHidden:false})).toEqual({opacity,visible:true});
  });
  it('keeps user hide above dragging or fullscreen',()=>{expect(resolveOverlay(fixture(),{hovered:true,dragging:true,otherAppFullscreen:true,userHidden:true}).visible).toBe(false);});
});
