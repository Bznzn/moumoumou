import electron from'electron';
import path from'node:path';
import os from'node:os';
import type{AppConfig,Validation}from'../shared/model';
import{calculateMonth,calculateSnapshot}from'../shared/income';
import{validateConfig,previewChange}from'../shared/config';
import{localDate}from'../shared/calendar';
import{channels}from'../shared/api';
import{createConfigStore}from'./storage';
import{createPlatform}from'./platform';
import{createWindows}from'./windows';
import{installIpc}from'./ipc';
import{createTray}from'./tray';
import{startupWindows,clockSnapshot,prepareApplicationRole}from'./lifecycle';

const{app,powerMonitor,shell}=electron;
app.setName('牛马冲冲冲');
// Retain the original data location so changing the display name preserves settings.
app.setPath('userData',path.join(app.getPath('appData'),'秒薪'));
app.on('window-all-closed',()=>{/* Menu-bar app stays alive when auxiliary windows close. */});
let testMode=false;
if(process.env.SALARY_FLOAT_USER_DATA){
  const candidate=path.resolve(process.env.SALARY_FLOAT_USER_DATA);
  if(!candidate.startsWith(path.resolve(os.tmpdir())+path.sep)&&!candidate.startsWith('/private/tmp/'))throw Error('测试数据必须位于临时目录');
  app.setPath('userData',candidate);
  testMode=process.env.SALARY_FLOAT_TEST_MODE==='1';
}
if(!app.requestSingleInstanceLock())app.quit();
else void app.whenReady().then(async()=>{
  prepareApplicationRole(app,testMode);
  const store=createConfigStore(app.getPath('userData'));
  const loaded=await store.load();let config=loaded.config;
  const platform=createPlatform();
  let writes:Promise<void>=Promise.resolve();
  function commit(update:(current:AppConfig|null)=>AppConfig):Promise<void>{
    const job=writes.catch(()=>{}).then(async()=>{const next=update(config);await store.save(next);config=next;});writes=job;return job;
  }
  const windows=createWindows({getConfig:()=>config,platform,testMode,onPlacement:value=>{if(config)void commit(current=>({...current!,window:{displayId:value.displayId,x:value.x,y:value.y,hidden:value.hidden,scale:value.scale??1}})).catch(console.error);}});
  const tray=createTray({show:windows.showOverlay,hide:windows.hideOverlay,settings:windows.openSettings,overview:windows.openOverview,quit:()=>app.quit(),configured:()=>config!==null});
  const publish=()=>{const snapshot=clockSnapshot(config,Date.now);if(snapshot)for(const w of windows.list())w.webContents.send(channels.snapshotEvent,snapshot);};
  function historyProtected(candidate:AppConfig):Validation{
    if(!config)return{ok:true,value:candidate};
    const currentMonth=localDate(Date.now(),config.workTimeZone).slice(0,7);
    const previous=(versions:{from:string}[])=>JSON.stringify(versions.filter(v=>v.from<currentMonth).sort((a,b)=>a.from.localeCompare(b.from)));
    if(candidate.workTimeZone!==config.workTimeZone||previous(candidate.salaries)!==previous(config.salaries)||previous(candidate.schedules)!==previous(config.schedules))return{ok:false,issues:[{path:'history',message:'工作时区和更早月份的常规记录不可改写；请从本月或下月生效'}]};
    return{ok:true,value:candidate};
  }
  const removeIpc=installIpc({
    getConfig:async()=>config?structuredClone(config):null,
    getStorageStatus:async()=>({recovered:loaded.recovered,error:loaded.error}),getPlatformStatus:async()=>platform.getStatus(),
    getSnapshot:async()=>clockSnapshot(config,Date.now),getMonth:async month=>config?calculateMonth(config,month,Date.now()):null,
    previewConfig:async candidate=>{const basic=validateConfig(candidate);const validation=basic.ok?historyProtected(basic.value):basic;return{validation,impact:validation.ok&&config?previewChange(config,validation.value,Date.now()):null};},
    saveConfig:async candidate=>{
      const basic=validateConfig(candidate);if(!basic.ok)return basic;const validation=historyProtected(basic.value);if(!validation.ok)return validation;
      const first=config===null;
      await commit(current=>({...validation.value,window:current?.window??validation.value.window}));
      if(app.isPackaged&&!testMode)app.setLoginItemSettings({openAtLogin:config!.launchAtLogin});
      if(first)windows.showOverlay();else windows.refresh();
      tray.update();for(const w of windows.list())w.webContents.send(channels.configEvent,config);publish();
      return{ok:true,value:structuredClone(config!)};
    },
    openWindow:async kind=>{if(kind==='settings')windows.openSettings();else windows.openOverview();},
    adjustOverlay:async adjustment=>windows.adjustOverlay(adjustment),
    reconnectNative:async()=>windows.reconnect(),
    openAccessibilitySettings:async()=>{await shell.openExternal('x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility');},
  },windows.list);
  const initial=startupWindows(config);if(initial.settings)windows.openSettings();if(initial.overlay)windows.showOverlay();
  if(config&&app.isPackaged&&!testMode)app.setLoginItemSettings({openAtLogin:config.launchAtLogin});
  app.on('activate',()=>{if(config)windows.showOverlay();else windows.openSettings();});
  app.on('second-instance',()=>windows.openSettings());
  const timer=setInterval(publish,250);powerMonitor.on('resume',publish);
  let closing=false;
  app.on('before-quit',event=>{
    if(closing)return;event.preventDefault();closing=true;clearInterval(timer);powerMonitor.removeListener('resume',publish);
    windows.flushPlacement();
    void writes.catch(console.error).finally(()=>{removeIpc();windows.destroy();tray.destroy();app.quit();});
  });
});
