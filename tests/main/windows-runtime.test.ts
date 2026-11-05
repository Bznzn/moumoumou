import{afterEach,describe,expect,it,vi}from'vitest';
import{EventEmitter}from'node:events';
import{fixture}from'../fixtures';
const environment=vi.hoisted(()=>({screen:null as any,power:null as any,roleTransforms:0}));
vi.mock('electron',async()=>{
  const{EventEmitter}=await import('node:events');
  class Panel extends EventEmitter{
    visible=false;alpha=1;bounds={x:100,y:100,width:300,height:182};
    webContents={setWindowOpenHandler(){},on(){},send(){}};
    isDestroyed(){return false;}isVisible(){return this.visible;}showInactive(){this.visible=true;}hide(){this.visible=false;}show(){this.visible=true;}focus(){}
    setAlwaysOnTop(){}setVisibleOnAllWorkspaces(_visible:boolean,options?:{skipTransformProcessType?:boolean}){if(!options?.skipTransformProcessType)environment.roleTransforms++;}setIgnoreMouseEvents(){}getBounds(){return this.bounds;}setPosition(x:number,y:number){this.bounds.x=x;this.bounds.y=y;}
    getOpacity(){return this.alpha;}setOpacity(v:number){this.alpha=v;}async loadFile(){}destroy(){}
    setBounds(bounds:typeof this.bounds){this.bounds=bounds;}
  }
  const display={id:1,workArea:{x:0,y:0,width:1000,height:800}};
  const screen=Object.assign(new EventEmitter(),{getAllDisplays:()=>[display],getDisplayMatching:()=>display});
  const power=new EventEmitter();environment.screen=screen;environment.power=power;
  return{default:{BrowserWindow:Panel,screen,powerMonitor:power,app:{getAppPath:()=>'/test'}}};
});
import{createWindows}from'../../src/main/windows';
afterEach(()=>{environment.screen?.removeAllListeners();environment.power?.removeAllListeners();environment.roleTransforms=0;vi.useRealTimers();});
describe('native connection lifecycle',()=>{
  it('moves and scales the overlay within the work area and saves its bounds without a native connection',async()=>{
    const start=vi.fn(async()=>{});
    const onPlacement=vi.fn();
    const platform={start,stop(){},getStatus:()=>({connected:false,message:'',helperPath:''})};
    const windows=createWindows({getConfig:fixture,platform,testMode:true,onPlacement});
    try{
      windows.showOverlay();await Promise.resolve();await Promise.resolve();
      windows.adjustOverlay('right');
      expect(windows.adjustOverlay('larger')).toBe(1.1);
      expect(windows.list()[0].getBounds()).toEqual({x:132,y:100,width:330,height:200});
      for(let i=0;i<40;i++)windows.adjustOverlay('right');
      expect(windows.list()[0].getBounds().x).toBe(670);
      windows.flushPlacement();
      expect(onPlacement).toHaveBeenLastCalledWith(expect.objectContaining({x:670,scale:1.1}));
      expect(start).not.toHaveBeenCalled();
    }finally{windows.destroy();}
  });
  it('starts saved configurations in compatibility mode and applies an explicit mode change',async()=>{
    const config=fixture();
    const start=vi.fn(async()=>{});
    const platform={start,stop(){},getStatus:()=>({connected:false,message:'',helperPath:''})};
    const windows=createWindows({getConfig:()=>config,platform});
    try{
      windows.showOverlay();await Promise.resolve();await Promise.resolve();
      expect(start).toHaveBeenLastCalledWith(windows.list()[0],expect.any(Function),false);
      config.nativeInteraction=true;windows.refresh();
      expect(start).toHaveBeenLastCalledWith(windows.list()[0],expect.any(Function),true);
      config.nativeInteraction=false;windows.refresh();
      expect(start).toHaveBeenLastCalledWith(windows.list()[0],expect.any(Function),false);
    }finally{windows.destroy();}
  });
  it('joins fullscreen workspaces without transforming the menu-bar process role',async()=>{
    const platform={async start(){},stop(){},getStatus:()=>({connected:false,message:'',helperPath:''})};
    const windows=createWindows({getConfig:fixture,platform,testMode:true});
    try{windows.showOverlay();await Promise.resolve();await Promise.resolve();expect(environment.roleTransforms).toBe(0);}finally{windows.destroy();}
  });
  it('applies fullscreen, fullscreen-hover and saved appearance changes to window opacity',async()=>{
    vi.useFakeTimers();
    const config=fixture();config.appearance.fullScreenOpacity=.1;config.appearance.fullScreenHoverOpacity=.8;
    let receive:(signals:Partial<import('../../src/main/window-policy').OverlaySignals>)=>void=()=>{};
    const platform={async start(_panel:unknown,onSignals:typeof receive){receive=onSignals;},stop(){},getStatus:()=>({connected:true,message:'',helperPath:''})};
    const windows=createWindows({getConfig:()=>config,platform});windows.showOverlay();await Promise.resolve();await Promise.resolve();
    try{
      const panel=windows.list()[0];
      receive({otherAppFullscreen:true});await vi.advanceTimersByTimeAsync(240);expect(panel.getOpacity()).toBeCloseTo(.1);
      receive({hovered:true});await vi.advanceTimersByTimeAsync(240);expect(panel.getOpacity()).toBeCloseTo(.8);
      config.appearance.fullScreenHoverOpacity=.2;windows.refresh();await vi.advanceTimersByTimeAsync(240);expect(panel.getOpacity()).toBeCloseTo(.2);
      receive({hovered:false});await vi.advanceTimersByTimeAsync(240);expect(panel.getOpacity()).toBeCloseTo(.1);
      receive({otherAppFullscreen:false});await vi.advanceTimersByTimeAsync(240);expect(panel.getOpacity()).toBeCloseTo(1);
    }finally{windows.destroy();}
  });
  it('never starts native input hooks in isolated tests, including wake and reconnect',async()=>{
    const actions:string[]=[];const platform={async start(){actions.push('native-input-started');},stop(){},getStatus:()=>({connected:false,message:'',helperPath:''})};
    const windows=createWindows({getConfig:fixture,platform,testMode:true});windows.showOverlay();await Promise.resolve();await Promise.resolve();
    environment.power.emit('resume');windows.reconnect();await Promise.resolve();expect(actions).toEqual([]);windows.destroy();
  });
});
