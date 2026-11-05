import{useLayoutEffect,useRef}from'react';
import{money}from'../api';
function Digit({value,animate}:{value:string;animate:boolean}){
  const node=useRef<HTMLSpanElement>(null),previous=useRef(value);
  useLayoutEffect(()=>{
    const el=node.current,old=previous.current;previous.current=value;
    if(!el||old===value||!animate||typeof el.animate!=='function'||!/^\d$/.test(value))return;
    const current=el.firstElementChild as HTMLElement;current.textContent=old;
    const incoming=current.cloneNode()as HTMLElement;incoming.textContent=value;incoming.className='digit-face incoming';el.append(incoming);
    const options={duration:280,easing:'cubic-bezier(.22,.75,.22,1)',fill:'forwards' as const};
    const out=current.animate([{transform:'translateY(0)'},{transform:'translateY(-100%)'}],options);
    const into=incoming.animate([{transform:'translateY(100%)'},{transform:'translateY(0)'}],options);
    const done=()=>{out.cancel();into.cancel();incoming.remove();current.textContent=value;};out.onfinish=done;return done;
  },[value,animate]);
  return <span className={/^\d$/.test(value)?'digit-slot':'digit-separator'} ref={node}><span className="digit-face">{value}</span></span>;
}
export function RollingAmount({cents,reduced}:{cents:number;reduced:boolean}){
  const text=money(cents),[whole,fraction]=text.slice(1).split('.');const length=text.length;
  const digitCount=whole.replace(/\D/g,'').length,separatorCount=whole.length-digitCount;
  const fontSize=Math.min(48,Math.floor(226/(digitCount*.6+separatorCount*.24+1)));
  return <div className={'overlay-amount'+(length>13?' tiny':length>10?' compact':'')} style={{fontSize}} aria-label={'今日已赚 '+text}><span className="currency" aria-hidden="true">¥</span><span className="integer-digits" aria-hidden="true">{[...whole].map((c,i)=><Digit key={whole.length-i} value={c} animate={!reduced}/>)}</span><span className="fraction-digits" aria-hidden="true">.<Digit value={fraction[0]} animate={!reduced}/><Digit value={fraction[1]} animate={!reduced}/></span></div>;
}
