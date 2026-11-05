import electron from'electron';
export function createTray(actions:{show():void;hide():void;settings():void;overview():void;quit():void;configured():boolean}){
  const tray=new electron.Tray(electron.nativeImage.createEmpty());tray.setTitle('¥');tray.setToolTip('牛马冲冲冲 · 每一秒，都有所值');
  let visible=true;
  function update(){tray.setContextMenu(electron.Menu.buildFromTemplate([
    {label:visible?'隐藏悬浮窗':'显示悬浮窗',enabled:actions.configured(),click:()=>{if(visible)actions.hide();else actions.show();visible=!visible;update();}},
    {label:'收入概览…',enabled:actions.configured(),click:actions.overview},{label:'设置…',click:actions.settings},
    {type:'separator'},{label:'退出牛马冲冲冲',click:actions.quit},
  ]));}
  update();return{update,destroy:()=>tray.destroy()};
}
