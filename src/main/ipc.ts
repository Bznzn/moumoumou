import electron from 'electron';
import type{BrowserWindow}from'electron';
import {z} from 'zod';
import {monthSchema}from'../shared/config';
import {channels,overlayAdjustments,type SalaryFloatApi}from'../shared/api';
const overlayAdjustment=z.enum(overlayAdjustments);
export function assertSender(sender:{id:number;url:string;isMainFrame:boolean},allowed:{id:number;url:string}[]):void{
  if(!sender.isMainFrame||!sender.url.startsWith('file:')||!allowed.some(window=>window.id===sender.id&&window.url===sender.url))throw Error('不可信的窗口请求');
}
export function parseMonth(value:unknown):string{return monthSchema.parse(value);}
export function parseWindowKind(value:unknown):'settings'|'overview'{return z.enum(['settings','overview']).parse(value);}
export function installIpc(api:Omit<SalaryFloatApi,'onSnapshot'|'onConfig'|'onResizeHint'>,windows:()=>BrowserWindow[]){
  const handlers:Record<string,(value?:unknown)=>unknown>={
    [channels.config]:()=>api.getConfig(),[channels.storage]:()=>api.getStorageStatus(),[channels.platform]:()=>api.getPlatformStatus(),[channels.snapshot]:()=>api.getSnapshot(),
    [channels.month]:value=>api.getMonth(parseMonth(value)),[channels.preview]:value=>api.previewConfig(value),[channels.save]:value=>api.saveConfig(value),
    [channels.open]:value=>api.openWindow(parseWindowKind(value)),[channels.reconnect]:()=>api.reconnectNative(),[channels.accessibility]:()=>api.openAccessibilitySettings(),
    [channels.adjustOverlay]:value=>api.adjustOverlay(overlayAdjustment.parse(value)),
  };
  for(const[channel,handler]of Object.entries(handlers))electron.ipcMain.handle(channel,(event,value:unknown)=>{
    assertSender({id:event.sender.id,url:event.senderFrame?.url??'',isMainFrame:event.senderFrame===event.sender.mainFrame},windows().map(w=>({id:w.webContents.id,url:w.webContents.getURL()})));
    return handler(value);
  });
  return()=>{for(const channel of Object.keys(handlers))electron.ipcMain.removeHandler(channel);};
}
