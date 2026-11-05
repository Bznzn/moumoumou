import type{AppConfig,IncomeSnapshot}from'../shared/model';
import{calculateSnapshot}from'../shared/income';
export function startupWindows(config:AppConfig|null){return{settings:config===null,overlay:config!==null};}
export function clockSnapshot(config:AppConfig|null,clock:()=>number):IncomeSnapshot|null{return config?calculateSnapshot(config,clock()):null;}
export function prepareApplicationRole(app:{isPackaged:boolean;setActivationPolicy(policy:'accessory'):void},testMode:boolean):void{
  // The installed application already declares LSUIElement. Re-transforming it
  // during window creation unnecessarily disturbs macOS focus/window tracking.
  if(!app.isPackaged&&!testMode)app.setActivationPolicy('accessory');
}
