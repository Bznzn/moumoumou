import type {AppConfig} from '../shared/model';
import type {OverlayAdjustment} from '../shared/api';
import type {PlatformAdapter} from './platform';
import type {BrowserWindow as Window} from 'electron';
import electron from 'electron';
import path from 'node:path';
import {resolveOverlay,type OverlaySignals} from './window-policy';
export interface DisplayArea{id:number;workArea:{x:number;y:number;width:number;height:number}}
export function restorePlacement(saved:AppConfig['window'],displays:DisplayArea[]):{x:number;y:number}{
  const display=displays.find(d=>d.id===saved.displayId)??displays[0];
  if(!display)return {x:0,y:0};
  const a=display.workArea;
  const scale=saved.scale??1;
  return {x:Math.round(Math.max(a.x,Math.min(saved.x,a.x+a.width-Math.round(300*scale)))),y:Math.round(Math.max(a.y,Math.min(saved.y,a.y+a.height-Math.round(182*scale))))};
}
export function createWindows(options:{getConfig:()=>AppConfig|null;platform:PlatformAdapter;testMode?:boolean;onPlacement?:(value:AppConfig['window'])=>void}) {
  const {BrowserWindow,screen,app,powerMonitor}=electron;
  let overlay:Window|null=null,settings:Window|null=null,overview:Window|null=null;
  let signals:OverlaySignals={hovered:false,dragging:false,otherAppFullscreen:false,userHidden:false};
  let fade:ReturnType<typeof setInterval>|undefined;
  let positionTimer:ReturnType<typeof setTimeout>|undefined;
  let nativeInteraction:boolean|undefined;
  function rememberPlacement(){
    clearTimeout(positionTimer);
    positionTimer=setTimeout(flushPlacement,400);
  }
  function flushPlacement(){
    if(!positionTimer)return;
    clearTimeout(positionTimer);positionTimer=undefined;
    if(!overlay||overlay.isDestroyed())return;
    const b=overlay.getBounds();options.onPlacement?.({...b,scale:b.width/300,displayId:screen.getDisplayMatching(b).id,hidden:signals.userHidden});
  }
  const renderer=path.join(app.getAppPath(),'dist/renderer/index.html');
  const preload=path.join(app.getAppPath(),'dist/preload/index.cjs');
  function safe(window:Window){
    window.webContents.setWindowOpenHandler(()=>({action:'deny'}));
    window.webContents.on('will-navigate',event=>event.preventDefault());
  }
  function apply(){
    const config=options.getConfig();if(!overlay||overlay.isDestroyed()||!config)return;
    const target=resolveOverlay(config,signals);
    if(!target.visible){overlay.hide();return;}
    if(!overlay.isVisible()&&!options.testMode)overlay.showInactive();
    if(fade)clearInterval(fade);
    const panel=overlay,start=panel.getOpacity(),began=Date.now();
    if(Math.abs(start-target.opacity)<.005)return;
    fade=setInterval(()=>{if(panel.isDestroyed()){clearInterval(fade);return;}const progress=Math.min(1,(Date.now()-began)/200);panel.setOpacity(start+(target.opacity-start)*progress);if(progress===1)clearInterval(fade);},16);
  }
  function receiveSignals(patch:Partial<OverlaySignals>){const changed=Object.entries(patch).some(([key,value])=>signals[key as keyof OverlaySignals]!==value);if(changed){signals={...signals,...patch};apply();}}
  async function connectPlatform(){
    if(options.testMode||!overlay||overlay.isDestroyed())return;
    nativeInteraction=options.getConfig()?.nativeInteraction===true;
    signals={...signals,hovered:false,dragging:false,otherAppFullscreen:false};
    apply();await options.platform.start(overlay,receiveSignals,nativeInteraction);
  }
  async function showOverlay(){
    const config=options.getConfig();if(!config)return;
    signals.userHidden=false;
    if(!overlay||overlay.isDestroyed()){
      const placement=restorePlacement(config.window,screen.getAllDisplays());
      const scale=config.window.scale??1;
      overlay=new BrowserWindow({width:Math.round(300*scale),height:Math.round(182*scale),...placement,show:false,frame:false,transparent:true,resizable:false,hasShadow:false,focusable:false,skipTaskbar:true,webPreferences:{preload,contextIsolation:true,nodeIntegration:false,sandbox:true}});
      safe(overlay);overlay.setAlwaysOnTop(true,'floating');overlay.setVisibleOnAllWorkspaces(true,{visibleOnFullScreen:true,skipTransformProcessType:true});overlay.setIgnoreMouseEvents(true);
      overlay.on('move',rememberPlacement);overlay.on('resize',rememberPlacement);
      await overlay.loadFile(renderer,{query:{page:'overlay'}});
      await connectPlatform();
    }
    apply();
  }
  function adjustOverlay(adjustment:OverlayAdjustment):number {
    if(!overlay||overlay.isDestroyed())throw Error('请先打开收入浮窗');
    const bounds=overlay.getBounds();
    const display=screen.getDisplayMatching(bounds);
    const offsets={left:[-32,0],right:[32,0],up:[0,-32],down:[0,32],smaller:[0,0],larger:[0,0]};
    const widthChanges={left:0,right:0,up:0,down:0,smaller:-30,larger:30};
    const [dx,dy]=offsets[adjustment];
    const width=Math.max(240,Math.min(600,bounds.width+widthChanges[adjustment]));
    const scale=width/300;
    const placement=restorePlacement({displayId:display.id,x:bounds.x+dx,y:bounds.y+dy,scale,hidden:signals.userHidden},[display]);
    overlay.setBounds({...placement,width,height:Math.round(182*scale)});
    rememberPlacement();
    return overlay.getBounds().width/300;
  }
  function open(kind:'settings'|'overview') {
    const current=kind==='settings'?settings:overview;
    if(current&&!current.isDestroyed()){current.show();current.focus();return;}
    const window=new BrowserWindow({width:kind==='settings'?640:560,height:760,minWidth:420,minHeight:520,title:kind==='settings'?'牛马冲冲冲 · 设置':'牛马冲冲冲 · 收入概览',backgroundColor:'#242427',show:false,webPreferences:{preload,contextIsolation:true,nodeIntegration:false,sandbox:true}});
    if(kind==='settings')settings=window;else overview=window;
    safe(window);if(!options.testMode)window.once('ready-to-show',()=>window.show());
    void window.loadFile(renderer,{query:{page:kind}});
  }
  const relocate=()=>{if(!overlay||overlay.isDestroyed())return;const c=options.getConfig();if(c){const b=overlay.getBounds();overlay.setPosition(...Object.values(restorePlacement({...c.window,x:b.x,y:b.y},screen.getAllDisplays())) as [number,number]);}};
  const resume=()=>{void connectPlatform();};
  screen.on('display-removed',relocate);screen.on('display-metrics-changed',relocate);powerMonitor.on('resume',resume);
  return {
    showOverlay:()=>{void showOverlay();},
    hideOverlay:()=>{signals.userHidden=true;apply();},
    openSettings:()=>open('settings'),openOverview:()=>open('overview'),
    adjustOverlay,
    refresh:()=>{
      if(!options.testMode&&overlay&&nativeInteraction!==(options.getConfig()?.nativeInteraction===true))void connectPlatform();
      else apply();
    },
    reconnect:resume,
    flushPlacement,
    list:()=>[overlay,settings,overview].filter((window):window is Window=>!!window&&!window.isDestroyed()),
    destroy:()=>{clearInterval(fade);clearTimeout(positionTimer);options.platform.stop();screen.removeListener('display-removed',relocate);screen.removeListener('display-metrics-changed',relocate);powerMonitor.removeListener('resume',resume);for(const w of [overlay,settings,overview])if(w&&!w.isDestroyed())w.destroy();},
  };
}
