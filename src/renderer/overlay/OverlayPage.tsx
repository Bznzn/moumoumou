import{useEffect,useRef,useState}from'react';
import type{AppConfig,IncomeSnapshot}from'../../shared/model';
import{versionFor}from'../../shared/calendar';
import{api,rate}from'../api';
import{RollingAmount}from'./RollingAmount';
import{shouldCelebrate}from'./celebrate';
import type{ResizeHint}from'../../shared/api';
import{ResizeDirectionHint}from'./ResizeDirectionHint';
export function OverlayPage(){
  const[snapshot,setSnapshot]=useState<IncomeSnapshot|null>(null),[config,setConfig]=useState<AppConfig|null>(null),[glow,setGlow]=useState(false);
  const previous=useRef<IncomeSnapshot|null>(null),configRef=useRef<AppConfig|null>(null),timer=useRef<ReturnType<typeof setTimeout>|undefined>(undefined);
  const[reduced,setReduced]=useState(()=>window.matchMedia?.('(prefers-reduced-motion: reduce)').matches??false);
  const[scale,setScale]=useState(()=>Math.max(.8,Math.min(2,window.innerWidth/300)));
  const[hint,setHint]=useState<ResizeHint|null>(null);
  useEffect(()=>api().onResizeHint(setHint),[]);
  useEffect(()=>{const resize=()=>setScale(Math.max(.8,Math.min(2,window.innerWidth/300)));window.addEventListener('resize',resize);return()=>window.removeEventListener('resize',resize);},[]);
  useEffect(()=>{const query=window.matchMedia?.('(prefers-reduced-motion: reduce)');const change=()=>setReduced(query?.matches??false);query?.addEventListener('change',change);return()=>query?.removeEventListener('change',change);},[]);
  useEffect(()=>{let active=true;void Promise.all([api().getConfig(),api().getSnapshot()]).then(([c,s])=>{if(active){setConfig(c);configRef.current=c;setSnapshot(s);previous.current=s;}});
    const offConfig=api().onConfig(c=>{configRef.current=c;setConfig(c);previous.current=null;});
    const off=api().onSnapshot(next=>{if(!active)return;if(!reduced&&shouldCelebrate(previous.current,next,configRef.current?.appearance.milestoneYuan??100,'tick')){setGlow(false);requestAnimationFrame(()=>setGlow(true));clearTimeout(timer.current);timer.current=setTimeout(()=>setGlow(false),1200);}previous.current=next;setSnapshot(next);});
    return()=>{active=false;off();offConfig();clearTimeout(timer.current);};
  },[reduced]);
  const labels={unconfigured:'等待设置',before:'还未上班',working:'赚钱中',lunch:'午休中',finished:'今日收工',rest:'今日休息','no-plan':'暂无工作安排'};
  const time=(ms:number)=>new Intl.DateTimeFormat('zh-CN',{timeZone:config?.workTimeZone,hour:'2-digit',minute:'2-digit',hour12:false}).format(ms);
  const state=snapshot?.state??'unconfigured';const schedule=config&&snapshot?versionFor(config.schedules,snapshot.month.month):undefined;
  let next='设置月薪与作息';if(snapshot){if(state==='working')next=(schedule?.hours.end??'')+' 下班';else if(state==='lunch'&&snapshot.nextWorkAt)next=time(snapshot.nextWorkAt)+' 继续';else if(snapshot.nextWorkAt)next=new Intl.DateTimeFormat('zh-CN',{timeZone:config?.workTimeZone,month:'numeric',day:'numeric'}).format(snapshot.nextWorkAt)+' '+time(snapshot.nextWorkAt)+' 上班';else next='暂无工作安排';}
  return <div className="overlay-canvas" style={{transform:`scale(${scale})`}}><main className={'salary-overlay'+(glow?' celebrate':'')}><div className="overlay-top"><span>今日已赚</span><span className="overlay-status"><i/>{labels[state]}</span></div><RollingAmount cents={snapshot?.today.earnedCents??0} reduced={reduced}/><div className="overlay-bottom"><span>{state==='working'&&snapshot?'+ '+rate(snapshot.month.rateCentsPerSecond)+' / 秒':state==='finished'?'今日累计已完成':state==='lunch'?'收入暂停增长':'按计划作息累计'}</span><span>{next}</span></div><ResizeDirectionHint hint={hint}/></main></div>;
}
