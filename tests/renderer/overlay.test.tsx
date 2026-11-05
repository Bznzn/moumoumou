// @vitest-environment jsdom
import{describe,expect,it}from'vitest';
import{render,screen,act}from'@testing-library/react';
import{OverlayPage}from'../../src/renderer/overlay/OverlayPage';
import{shouldCelebrate}from'../../src/renderer/overlay/celebrate';
import{calculateSnapshot}from'../../src/shared/income';
import{fixture,now}from'../fixtures';
import{host}from'./host';
describe('salary overlay',()=>{
  it('shows a pointer-transparent direction hint and removes it on exit',async()=>{
    const h=host();render(<OverlayPage/>);await screen.findByLabelText('今日已赚 ¥326.09');
    act(()=>h.emitHint({x:280,y:90,direction:'ew',edges:['right']}));
    expect(screen.getByLabelText('左右拉伸提示').textContent).toBe('↔');
    expect(screen.getByLabelText('左右拉伸提示').style.pointerEvents).toBe('none');
    act(()=>h.emitHint(null));expect(screen.queryByLabelText('左右拉伸提示')).toBeNull();
  });
  it('shows real calculated money and freezes lunch state',async()=>{
    const h=host();render(<OverlayPage/>);await screen.findByLabelText('今日已赚 ¥326.09');
    act(()=>h.emit(calculateSnapshot(fixture(),Date.parse('2026-11-04T12:30+08:00'))));
    expect(screen.getByText('午休中')).toBeTruthy();expect(screen.getByLabelText('今日已赚 ¥195.65')).toBeTruthy();
  });
  it('celebrates real-time threshold only, not resume or settings changes',()=>{
    const a=calculateSnapshot(fixture(),now),b=structuredClone(a);a.today.earnedCents=9999;b.today.earnedCents=10000;b.today.elapsedSeconds++;
    expect(shouldCelebrate(a,b,100,'tick')).toBe(true);expect(shouldCelebrate(a,b,100,'refresh')).toBe(false);expect(shouldCelebrate(a,b,0,'tick')).toBe(false);
    b.today.elapsedSeconds+=3600;expect(shouldCelebrate(a,b,100,'tick')).toBe(false);
  });
});
