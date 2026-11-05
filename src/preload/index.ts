import {contextBridge,ipcRenderer} from 'electron';
import {channels,type SalaryFloatApi}from'../shared/api';
function subscription<T>(channel:string,callback:(value:T)=>void){const handler=(_:unknown,value:T)=>callback(value);ipcRenderer.on(channel,handler);return()=>ipcRenderer.removeListener(channel,handler);}
const api:SalaryFloatApi={
  getConfig:()=>ipcRenderer.invoke(channels.config),getStorageStatus:()=>ipcRenderer.invoke(channels.storage),getPlatformStatus:()=>ipcRenderer.invoke(channels.platform),getSnapshot:()=>ipcRenderer.invoke(channels.snapshot),
  getMonth:month=>ipcRenderer.invoke(channels.month,month),previewConfig:value=>ipcRenderer.invoke(channels.preview,value),saveConfig:value=>ipcRenderer.invoke(channels.save,value),
  openWindow:kind=>ipcRenderer.invoke(channels.open,kind),reconnectNative:()=>ipcRenderer.invoke(channels.reconnect),openAccessibilitySettings:()=>ipcRenderer.invoke(channels.accessibility),
  adjustOverlay:adjustment=>ipcRenderer.invoke(channels.adjustOverlay,adjustment),
  onSnapshot:callback=>subscription(channels.snapshotEvent,callback),onConfig:callback=>subscription(channels.configEvent,callback),
  onResizeHint:callback=>subscription(channels.resizeHintEvent,callback),
};
contextBridge.exposeInMainWorld('salaryFloat',api);
