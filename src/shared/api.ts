import type {AppConfig,IncomeSnapshot,MonthIncome,MonthKey,Validation} from './model';
import type {previewChange} from './config';
export interface PlatformStatus{connected:boolean;message:string;helperPath:string;authorizationPath?:string}
export interface ResizeHint{x:number;y:number;direction:'ew'|'ns'|'nwse'|'nesw';edges:('left'|'right'|'top'|'bottom')[]}
export const overlayAdjustments=['left','right','up','down','smaller','larger'] as const;
export type OverlayAdjustment=(typeof overlayAdjustments)[number];
export interface SalaryFloatApi {
  getConfig():Promise<AppConfig|null>;
  getStorageStatus():Promise<{recovered:boolean;error:string|null}>;
  getPlatformStatus():Promise<PlatformStatus>;
  getSnapshot():Promise<IncomeSnapshot|null>;
  getMonth(month:MonthKey):Promise<MonthIncome|null>;
  previewConfig(candidate:unknown):Promise<{validation:Validation;impact:ReturnType<typeof previewChange>|null}>;
  saveConfig(candidate:unknown):Promise<Validation>;
  openWindow(kind:'settings'|'overview'):Promise<void>;
  adjustOverlay(adjustment:OverlayAdjustment):Promise<number>;
  reconnectNative():Promise<void>;
  openAccessibilitySettings():Promise<void>;
  onSnapshot(listener:(snapshot:IncomeSnapshot)=>void):()=>void;
  onConfig(listener:(config:AppConfig)=>void):()=>void;
  onResizeHint(listener:(hint:ResizeHint|null)=>void):()=>void;
}
export const channels={config:'sf:config',storage:'sf:storage',platform:'sf:platform',snapshot:'sf:snapshot',month:'sf:month',preview:'sf:preview',save:'sf:save',open:'sf:open',adjustOverlay:'sf:adjust-overlay',reconnect:'sf:reconnect',accessibility:'sf:accessibility',snapshotEvent:'sf:snapshot-event',configEvent:'sf:config-event',resizeHintEvent:'sf:resize-hint'} as const;
declare global{interface Window{salaryFloat:SalaryFloatApi}}
