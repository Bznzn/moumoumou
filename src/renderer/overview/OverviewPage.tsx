import{useEffect,useState}from'react';
import{Temporal}from'@js-temporal/polyfill';
import type{AppConfig,MonthIncome}from'../../shared/model';
import{versionFor,localDate}from'../../shared/calendar';
import{api,money,rate,hours}from'../api';
export function OverviewPage(){
  const[config,setConfig]=useState<AppConfig|null>(null),[month,setMonth]=useState(''),[income,setIncome]=useState<MonthIncome|null>(null),[selected,setSelected]=useState<string|null>(null),[error,setError]=useState('');
  useEffect(()=>{let active=true;void api().getConfig().then(c=>{if(active){setConfig(c);if(c)setMonth(localDate(Date.now(),c.workTimeZone).slice(0,7));}}).catch(e=>setError(String(e.message)));return()=>{active=false;};},[]);
  useEffect(()=>{if(!month)return;let active=true;const refresh=()=>{void api().getMonth(month).then(value=>{if(active)setIncome(value);}).catch(e=>{if(active)setError(e.message);});};refresh();const off=api().onSnapshot(value=>{if(value.month.month===month)setIncome(value.month);});const offConfig=api().onConfig(c=>{setConfig(c);refresh();});return()=>{active=false;off();offConfig();};},[month]);
  const today=config?localDate(Date.now(),config.workTimeZone):'';
  const shift=(n:number)=>setMonth(Temporal.PlainYearMonth.from(month).add({months:n}).toString());
  const percentage=income?.salaryCents?Math.min(100,income.earnedCents/income.salaryCents*100):0;
  return <main className="page overview-page"><header className="page-header"><div className="eyebrow">牛马冲冲冲 / 收入概览</div><div className="overview-heading"><h1>每一份努力，都有回报。</h1>{month&&<div className="month-navigation"><button className="icon-button" aria-label="上个月" onClick={()=>shift(-1)}>‹</button><input aria-label="查看月份" type="month" value={month} onChange={e=>{if(e.target.value)setMonth(e.target.value);}}/><button className="icon-button" aria-label="下个月" onClick={()=>shift(1)}>›</button></div>}</div></header>
    {error&&<p className="error" role="alert">{error}</p>}
    {income?.salaryCents==null?<div className="empty-state"><p>{income?'这个月份还没有月薪记录。':'正在读取收入…'}</p><button onClick={()=>void api().openWindow('settings')}>打开设置</button></div>:<>
      <section className="month-summary"><span className="muted">{income.isFuture?'本月计划收入':'本月已赚'}</span><div className="month-total">{income.plannedSeconds===0?'—':money(income.isFuture?income.salaryCents:income.earnedCents)}</div>{income.plannedSeconds===0&&<div className="notice"><p>没有有效计划工时，收入暂不可计算。</p><button onClick={()=>void api().openWindow('settings')}>调整排班</button></div>}<div className="progress-track" role="progressbar" aria-label="月薪累计进度" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percentage}><div style={{width:percentage+'%'}}/></div><div className="summary-line"><span>月薪 {money(income.salaryCents)}</span><span>{income.plannedSeconds===0?'等待有效排班':income.isFuture?'尚未开始累计':`已累计 ${percentage.toFixed(2)}%`}</span></div>
      </section>
      <section className="day-list"><h2>每日明细</h2>{income.days.filter(day=>income.isFuture||day.date<=today).reverse().map(day=>{
        const future=day.date>today,expanded=selected===day.date,schedule=config?versionFor(config.schedules,day.date.slice(0,7)):undefined;
        return <div className="day-item" key={day.date}><button className="day-row" aria-label={`${day.date}，${day.isWorkday?'收入明细':'休息日'}`} aria-expanded={expanded} onClick={()=>setSelected(expanded?null:day.date)}><span>{day.date}<small>{day.date===today?'今日':future?'计划':day.isWorkday?'已累计':'休息日'}</small></span><span>{day.isWorkday?(future?'预计 ':'')+money(future?day.plannedSeconds*income.rateCentsPerSecond:day.earnedCents):'休息'}</span></button>{expanded&&<div className="day-detail"><div><span>计划作息</span><span>{schedule?`${schedule.hours.start}–${schedule.hours.end}`:'—'}</span></div><div><span>午休</span><span>{schedule?.hours.lunch?`${schedule.hours.lunch.start}–${schedule.hours.lunch.end}`:'不扣除午休'}</span></div><div><span>{future?'计划工作时长':'已累计工作时长'}</span><span>{hours(future?day.plannedSeconds:day.elapsedSeconds)}</span></div><div><span>每秒收入</span><span>{rate(income.rateCentsPerSecond)}</span></div></div>}</div>;
      })}</section><p className="footnote">根据月薪与计划作息估算。月总额独立计算，不累加已舍入的每日显示值。</p>
    </>}
  </main>;
}
