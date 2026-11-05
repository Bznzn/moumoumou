import {afterEach,vi}from'vitest';
import{cleanup}from'@testing-library/react';
import{fixture,now}from'../fixtures';
import{calculateMonth,calculateSnapshot}from'../../src/shared/income';
import type{SalaryFloatApi,ResizeHint}from'../../src/shared/api';
import type{AppConfig,IncomeSnapshot}from'../../src/shared/model';
export function host(config:AppConfig|null=fixture()){
  vi.spyOn(Date,'now').mockReturnValue(now);
  const listeners=new Set<(snapshot:IncomeSnapshot)=>void>();
  const hints=new Set<(hint:ResizeHint|null)=>void>();
  const api:SalaryFloatApi={
    getConfig:vi.fn(async()=>config),getStorageStatus:vi.fn(async()=>({recovered:false,error:null})),getPlatformStatus:vi.fn(async()=>({connected:true,message:'已连接',helperPath:'/test/helper.app'})),
    getSnapshot:vi.fn(async()=>config?calculateSnapshot(config,now):null),getMonth:vi.fn(async month=>config?calculateMonth(config,month,now):null),
    previewConfig:vi.fn(async candidate=>({validation:{ok:true as const,value:candidate as AppConfig},impact:null})),saveConfig:vi.fn(async candidate=>({ok:true as const,value:candidate as AppConfig})),
    openWindow:vi.fn(async()=>{}),reconnectNative:vi.fn(async()=>{}),openAccessibilitySettings:vi.fn(async()=>{}),
    adjustOverlay:vi.fn(async()=>1),
    onSnapshot:listener=>{listeners.add(listener);return()=>{listeners.delete(listener);};},onConfig:()=>()=>{},onResizeHint:listener=>{hints.add(listener);return()=>{hints.delete(listener);};},
  };
  window.salaryFloat=api;
  return{api,emit:(snapshot:IncomeSnapshot)=>listeners.forEach(listener=>listener(snapshot)),emitHint:(hint:ResizeHint|null)=>hints.forEach(listener=>listener(hint))};
}
afterEach(()=>{cleanup();vi.restoreAllMocks();});
