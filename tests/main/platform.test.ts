import{afterEach,describe,expect,it,vi}from'vitest';
import{EventEmitter}from'node:events';
const state=vi.hoisted(()=>({children:[]as any[],realPipe:false}));
vi.mock('node:fs',()=>({existsSync:()=>true}));
vi.mock('node:child_process',async()=>{
  const{EventEmitter}=await import('node:events');const{PassThrough,Writable}=await import('node:stream');
  const actual=await vi.importActual<typeof import('node:child_process')>('node:child_process');
  class Input extends Writable{
    writes:string[]=[];failNext=false;
    _write(chunk:Buffer,_encoding:string,done:(error?:Error|null)=>void){this.writes.push(chunk.toString());if(this.failNext){this.failNext=false;queueMicrotask(()=>done(Object.assign(new Error('write EPIPE'),{code:'EPIPE'})));}else done();}
  }
  return{spawn:(executable:string)=>{
    if(state.realPipe&&executable.endsWith('/SalaryGestureProbe')){
      const child=actual.spawn(process.execPath,['-e',`require('node:fs').closeSync(0);process.stdout.write('{"type":"ready"}\\n');setTimeout(()=>process.exit(0),2000);`],{stdio:'pipe'});state.children.push(child);return child;
    }
    const child=Object.assign(new EventEmitter(),{stdin:new Input(),stdout:new PassThrough(),stderr:new PassThrough(),killed:false,kill(){this.killed=true;return true;}});state.children.push(child);return child;
  }};
});
vi.mock('electron',()=>({default:{app:{isPackaged:false,getAppPath:()=>'/app'},screen:{getDisplayNearestPoint:()=>({workArea:{x:0,y:0,width:1710,height:1107}}),getCursorScreenPoint:()=>({x:0,y:0})}}}));
import{createPlatform}from'../../src/main/platform';
const adapters:ReturnType<typeof createPlatform>[]=[];
afterEach(()=>{for(const adapter of adapters)adapter.stop();adapters.length=0;state.children.length=0;state.realPipe=false;});
function panel(){return Object.assign(new EventEmitter(),{isDestroyed:()=>false,isVisible:()=>true,getBounds:()=>({x:100,y:100,width:300,height:182}),setIgnoreMouseEvents(){},webContents:{send:vi.fn()}});}
async function setup(){const adapter=createPlatform();adapters.push(adapter);const window=panel();const signals=vi.fn();await adapter.start(window as any,signals,true);const helper=state.children.at(-2);helper.stdout.write('{"type":"ready"}\n');return{adapter,window,helper,signals};}
const tick=()=>new Promise<void>(resolve=>setImmediate(resolve));
it('keeps native helpers stopped in compatibility mode, including after switching from native input',async()=>{
  const adapter=createPlatform();adapters.push(adapter);
  const window=panel();const signals=vi.fn();
  await adapter.start(window as any,signals,false);
  expect(state.children).toHaveLength(0);
  expect(adapter.getStatus().message).toContain('兼容显示');
  await adapter.start(window as any,signals,true);
  expect(state.children).toHaveLength(2);
  await adapter.start(window as any,signals,false);
  expect(state.children).toHaveLength(2);
  expect(state.children.every(child=>child.killed)).toBe(true);
});
describe('native input pipe lifecycle',()=>{
  it('survives a real child closing fd0 before the ready handshake write',async()=>{
    state.realPipe=true;const adapter=createPlatform();adapters.push(adapter);const window=panel();await adapter.start(window as any,vi.fn(),true);
    await vi.waitFor(()=>expect(adapter.getStatus().message).toContain('断开'));
    expect(adapter.getStatus().connected).toBe(false);expect(()=>window.emit('move')).not.toThrow();
    expect(state.children[0].killed).toBe(true);
  });
  it('handles a stream EPIPE without an uncaught exception and stops later synchronisation',async()=>{
    const{adapter,window,helper,signals}=await setup();expect(adapter.getStatus().connected).toBe(true);
    expect(()=>helper.stdin.emit('error',Object.assign(new Error('write EPIPE'),{code:'EPIPE'}))).not.toThrow();
    const count=helper.stdin.writes.length;window.emit('move');window.emit('resize');expect(helper.stdin.writes).toHaveLength(count);
    expect(adapter.getStatus().connected).toBe(false);expect(signals).toHaveBeenCalledWith({dragging:false});
  });
  it('stops writes on helper exit while stdin still reports writable',async()=>{
    const{adapter,window,helper}=await setup();const count=helper.stdin.writes.length;
    expect(helper.stdin.writable).toBe(true);helper.emit('exit',2,null);window.emit('show');window.emit('move');
    expect(helper.stdin.writes).toHaveLength(count);expect(adapter.getStatus().connected).toBe(false);
  });
  it('handles asynchronous write failure from a real Writable stream',async()=>{
    const{adapter,window,helper}=await setup();helper.stdin.failNext=true;window.emit('move');await tick();
    expect(adapter.getStatus().connected).toBe(false);expect(adapter.getStatus().message).toContain('断开');
  });
  it('absorbs late errors from a replaced helper without disconnecting the new connection',async()=>{
    const{adapter,window,helper}=await setup();await adapter.start(window as any,vi.fn(),true);
    const replacement=state.children.at(-2);replacement.stdout.write('{"type":"ready"}\n');
    expect(()=>helper.stdin.emit('error',new Error('old EPIPE'))).not.toThrow();expect(adapter.getStatus().connected).toBe(true);
  });
  it('ignores buffered gesture messages after the input connection failed',async()=>{
    const{helper,signals}=await setup();helper.stdin.emit('error',new Error('EPIPE'));signals.mockClear();
    helper.stdout.write('{"type":"dragging","value":true}\n');expect(signals).not.toHaveBeenCalled();
  });
});
