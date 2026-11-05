import type{ResizeHint}from'../../shared/api';
export function ResizeDirectionHint({hint}:{hint:ResizeHint|null}){
  if(!hint)return null;
  const symbols={ew:'↔',ns:'↕',nwse:'⤡',nesw:'⤢'};
  const labels={ew:'左右拉伸提示',ns:'上下拉伸提示',nwse:'斜向拉伸提示',nesw:'斜向拉伸提示'};
  return <><div className="resize-edge-highlight" aria-hidden="true">{hint.edges.map(edge=><i key={edge} className={edge}/>)}</div><span className="resize-direction-hint" aria-label={labels[hint.direction]} style={{left:hint.x,top:hint.y,pointerEvents:'none'}}>{symbols[hint.direction]}</span></>;
}
