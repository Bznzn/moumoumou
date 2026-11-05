import {describe,it,expect} from 'vitest';
import {assertSender,parseMonth,parseWindowKind} from '../../src/main/ipc';
describe('limited IPC boundary',()=>{
  const allowed=[{id:3,url:'file:///app/dist/index.html?page=settings'}];
  it('accepts only registered main frame and exact local document',()=>{expect(()=>assertSender({id:3,url:allowed[0].url,isMainFrame:true},allowed)).not.toThrow();});
  it.each([{id:4,url:allowed[0].url,isMainFrame:true},{id:3,url:'https://example.com',isMainFrame:true},{id:3,url:'file:///app/dist/index.html.evil',isMainFrame:true},{id:3,url:allowed[0].url,isMainFrame:false}])('rejects untrusted sender %#',sender=>expect(()=>assertSender(sender,allowed)).toThrow());
  it('rejects arbitrary window destinations and invalid month requests',()=>{expect(parseMonth('2026-11')).toBe('2026-11');expect(()=>parseMonth('../../secret')).toThrow();expect(()=>parseMonth('2026-13')).toThrow();expect(()=>parseWindowKind('https://evil')).toThrow();expect(parseWindowKind('overview')).toBe('overview');});
});
