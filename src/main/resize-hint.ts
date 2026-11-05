import type{ResizeHint}from'../shared/api';
export function resizeHint(b:{x:number;y:number;width:number;height:number},p:{x:number;y:number}):ResizeHint|null{
  const scale=b.width/300,x=(p.x-b.x)/scale,y=(p.y-b.y)/scale;
  if(!Number.isFinite(scale)||scale<=0||x<0||x>=300||y<0||y>=b.height/scale)return null;
  const edges:ResizeHint['edges']=[];
  const horizontal=x<=12?'left':300-x<=12?'right':null;
  const vertical=y<=12?'top':b.height/scale-y<=12?'bottom':null;
  if(horizontal)edges.push(horizontal);if(vertical)edges.push(vertical);if(!edges.length)return null;
  const direction=horizontal&&vertical?((horizontal==='left')===(vertical==='top')?'nwse':'nesw'):horizontal?'ew':'ns';
  return{x:Math.max(20,Math.min(280,x+(horizontal?(horizontal==='right'?-18:18):0))),y:Math.max(20,Math.min(162,y+(vertical?(vertical==='bottom'?-18:18):0))),direction,edges};
}
