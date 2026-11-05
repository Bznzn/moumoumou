import type {BrowserWindow} from 'electron';
import electron from 'electron';
import {spawn,type ChildProcessWithoutNullStreams} from 'node:child_process';
import {createInterface} from 'node:readline';
import path from 'node:path';
import {existsSync} from 'node:fs';
import type {OverlaySignals} from './window-policy';
import{channels,type ResizeHint}from'../shared/api';
import{resizeHint}from'./resize-hint';

export interface PlatformStatus{connected:boolean;message:string;helperPath:string;authorizationPath?:string}
export interface PlatformAdapter{
  start(panel:BrowserWindow,onSignals:(signals:Partial<OverlaySignals>)=>void,nativeInteraction:boolean):Promise<void>;
  stop():void;
  getStatus():PlatformStatus;
}
export function createPlatform():PlatformAdapter {
  let children:ChildProcessWithoutNullStreams[]=[];
  let cleanup:(()=>void)[]=[];
  let status:PlatformStatus={connected:false,message:'正在连接原生窗口服务',helperPath:''};
  let generation=0;
  function stop(){generation++;for(const fn of cleanup)fn();cleanup=[];for(const child of children){child.stdin.destroy();child.kill('SIGTERM');}children=[];status={...status,connected:false};}
  async function start(panel:BrowserWindow,onSignals:(signals:Partial<OverlaySignals>)=>void,nativeInteraction:boolean) {
    stop();const current=generation;
    const {app,screen}=electron;
    const base=app.isPackaged?path.join(process.resourcesPath,'native'):path.join(app.getAppPath(),'prototypes/window-interactions/build');
    const helperApp=path.join(base,'SalaryGestureProbe.app');
    status={connected:false,message:'正在连接原生窗口服务',helperPath:helperApp,authorizationPath:app.isPackaged?path.resolve(app.getPath('exe'),'../../..'):helperApp};
    let lastHint='';
    const publishHint=(hint:ResizeHint|null)=>{const key=JSON.stringify(hint);if(key===lastHint)return;lastHint=key;if(!panel.isDestroyed())panel.webContents.send(channels.resizeHintEvent,hint);};
    cleanup.push(()=>publishHint(null));
    const hoverPoll=setInterval(()=>{
      if(panel.isDestroyed()||!panel.isVisible()){publishHint(null);return;}
      const b=panel.getBounds(),p=screen.getCursorScreenPoint();
      onSignals({hovered:p.x>=b.x&&p.x<b.x+b.width&&p.y>=b.y&&p.y<b.y+b.height});
      publishHint(status.connected?resizeHint(b,p):null);
    },32);
    hoverPoll.unref();cleanup.push(()=>clearInterval(hoverPoll));
    if(!nativeInteraction){
      status={connected:false,message:'兼容显示已启用',helperPath:''};
      return;
    }
    let bridge:ChildProcessWithoutNullStreams|null=null;
    let inputOpen=false;
    const disconnect=(message='原生输入连接已断开，请从设置重新连接')=>{
      if(current!==generation)return;
      const wasOpen=inputOpen;inputOpen=false;
      if(wasOpen&&bridge){bridge.stdin.destroy();if(!bridge.killed)bridge.kill('SIGTERM');}
      status={...status,connected:false,message};publishHint(null);onSignals({dragging:false});
    };
    const sync=()=>{
      if(current!==generation||!inputOpen||!status.connected||!bridge||panel.isDestroyed())return;
      if(bridge.killed||bridge.exitCode!=null||bridge.stdin.destroyed||bridge.stdin.writableEnded||!bridge.stdin.writable){disconnect();return;}
      try{bridge.stdin.write(JSON.stringify({...panel.getBounds(),enabled:panel.isVisible()})+'\n',error=>{if(error)disconnect();});}catch{disconnect();}
    };
    const connect=(name:string,receive:(data:Record<string,unknown>,child:ChildProcessWithoutNullStreams)=>void)=>{
      const executable=path.join(base,name+'.app','Contents/MacOS',name);
      if(!existsSync(executable)){status={...status,message:'原生辅助程序缺失，请重新构建应用'};return null;}
      const child=spawn(executable,[],{stdio:'pipe'});children.push(child);
      const isInput=name==='SalaryGestureProbe';if(isInput)inputOpen=true;
      // Writable errors are separate from ChildProcess errors and may arrive
      // after exit or replacement. Keep a listener for the stream's lifetime.
      child.stdin.on('error',()=>{if(isInput)disconnect();});
      child.stdin.on('close',()=>{if(isInput&&inputOpen)disconnect();});
      child.on('exit',()=>{if(isInput&&inputOpen)disconnect('原生输入服务已退出，请从设置重新连接');});
      const reader=createInterface({input:child.stdout});
      reader.on('line',line=>{if(current!==generation||line.length>65536)return;try{receive(JSON.parse(line),child);}catch{ /* ignore invalid native protocol data */ }});
      child.stderr.on('data',()=>{});
      child.on('error',error=>{if(isInput)disconnect('原生输入服务启动失败：'+error.message);else if(current===generation)status={...status,message:'全屏检测服务启动失败：'+error.message};});
      cleanup.push(()=>reader.close());return child;
    };
    bridge=connect('SalaryGestureProbe',data=>{
      if(!inputOpen&&data.type!=='unavailable'&&data.type!=='disabled')return;
      if(data.type==='ready'){if(!inputOpen)return;status={...status,connected:true,message:'原生穿透与拖动服务已连接'};sync();}
      else if(data.type==='hover'&&typeof data.value==='boolean')onSignals({hovered:data.value});
      else if(data.type==='dragging'&&typeof data.value==='boolean')onSignals({dragging:data.value});
      else if(data.type==='move'&&typeof data.x==='number'&&typeof data.y==='number'&&Number.isFinite(data.x)&&Number.isFinite(data.y)){
        const area=screen.getDisplayNearestPoint({x:Math.round(data.x),y:Math.round(data.y)}).workArea;
        const b=panel.getBounds();panel.setPosition(Math.round(Math.max(area.x,Math.min(data.x,area.x+area.width-b.width))),Math.round(Math.max(area.y,Math.min(data.y,area.y+area.height-b.height))));sync();
      } else if(data.type==='resize'&&[data.x,data.y,data.width,data.height].every(value=>typeof value==='number'&&Number.isFinite(value))){
        const x=data.x as number,y=data.y as number;
        const area=screen.getDisplayNearestPoint({x:Math.round(x),y:Math.round(y)}).workArea;
        const width=Math.round(Math.max(240,Math.min(data.width as number,600,area.width,area.height*300/182)));
        const height=Math.round(width*182/300);
        panel.setBounds({x:Math.round(Math.max(area.x,Math.min(x,area.x+area.width-width))),y:Math.round(Math.max(area.y,Math.min(y,area.y+area.height-height))),width,height});sync();
      } else if(data.type==='unavailable'||data.type==='disabled'){disconnect(data.reason==='accessibility-permission-required'?'需要为授权应用路径所示的应用开启辅助功能权限，再点击重新连接；当前仅能穿透，不能拖动或拉伸':'原生输入服务已停用，请从设置重新连接');}
    });
    connect('SalaryPresentationProbe',data=>{if(data.type==='fullscreen'&&typeof data.value==='boolean')onSignals({otherAppFullscreen:data.value});});
    panel.on('show',sync);panel.on('hide',sync);panel.on('move',sync);panel.on('resize',sync);
    cleanup.push(()=>{panel.removeListener('show',sync);panel.removeListener('hide',sync);panel.removeListener('move',sync);panel.removeListener('resize',sync);});
  }
  return {start,stop,getStatus:()=>({...status})};
}
