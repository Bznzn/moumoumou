import{useEffect,useMemo,useState,type FormEvent}from'react';
import{Temporal}from'@js-temporal/polyfill';
import type{AppConfig,ScheduleRule,WorkHours}from'../../shared/model';
import type{OverlayAdjustment,PlatformStatus}from'../../shared/api';
import{defaultConfig}from'../../shared/config';
import{calculateSnapshot}from'../../shared/income';
import{localDate,versionFor,isWorkday}from'../../shared/calendar';
import{Calendar}from'./Calendar';
import{api,money,rate}from'../api';
import{buildCandidate,salaryText}from'./model';

export function SettingsPage(){
  const[base,setBase]=useState<AppConfig|null>(null),[draft,setDraft]=useState<AppConfig|null>(null);
  const[effective,setEffective]=useState(''),[calendarMonth,setCalendarMonth]=useState('');
  const[salary,setSalary]=useState('12000'),[rule,setRule]=useState<ScheduleRule>({kind:'weekly',weekdays:[1,2,3,4,5]});
  const[workHours,setWorkHours]=useState<WorkHours>({start:'09:00',end:'18:00',lunch:{start:'12:00',end:'13:00'}});
  const[notice,setNotice]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false),[confirm,setConfirm]=useState<{config:AppConfig;months:string[]}|null>(null);
  const[salaryTouched,setSalaryTouched]=useState(false),[scheduleTouched,setScheduleTouched]=useState(false);
  const[platform,setPlatform]=useState<PlatformStatus|null>(null),[recovery,setRecovery]=useState('');
  const[adjustedScale,setAdjustedScale]=useState<number|null>(null);
  useEffect(()=>{let active=true;void Promise.all([api().getConfig(),api().getStorageStatus(),api().getPlatformStatus()]).then(([saved,storage,native])=>{
    if(!active)return;const c=saved??defaultConfig();const month=localDate(Date.now(),c.workTimeZone).slice(0,7);const selected=saved?Temporal.PlainYearMonth.from(month).add({months:1}).toString():month;
    setBase(saved);setDraft(structuredClone(c));setEffective(selected);setCalendarMonth(month);
    const schedule=versionFor(c.schedules,selected)!;setRule(structuredClone(schedule.rule));setWorkHours(structuredClone(schedule.hours));setSalary(salaryText(versionFor(c.salaries,selected)?.salaryCents??1200000));setPlatform(native);
    if(storage.error)setRecovery(storage.recovered?'已从备份恢复：'+storage.error:storage.error+'。原文件已保留，保存暂不可用。');
  }).catch(e=>{if(active)setError(String(e.message??e));});const timer=setInterval(()=>{void api().getPlatformStatus().then(p=>{if(active)setPlatform(p);}).catch(()=>{});},1500);return()=>{active=false;clearInterval(timer);};},[]);
  const currentMonth=draft?localDate(Date.now(),draft.workTimeZone).slice(0,7):'';
  const candidate=useMemo(()=>{
    if(!draft||!effective)return{config:null,error:''};
    try{return{config:buildCandidate(draft,effective,salary,rule,workHours),error:''};}catch(e){return{config:null,error:(e as Error).message.includes('月薪')?(e as Error).message:'请检查上下班时间、午休范围和排班设置'};}
  },[draft,effective,salary,rule,workHours]);
  useEffect(()=>setConfirm(null),[candidate.config]);
  const preview=candidate.config?calculateSnapshot(candidate.config,Date.now()):null;
  const effectivePreview=candidate.config?(()=>{const c=candidate.config!;const selected=versionFor(c.salaries,effective);if(!selected)return null;const date=Temporal.PlainDate.from(effective+'-15').toZonedDateTime({timeZone:c.workTimeZone,plainTime:'15:00'}).epochMilliseconds;return calculateSnapshot(c,date).month;})():null;
  function selectMonth(month:string){setEffective(month);setConfirm(null);if(!draft)return;const version=versionFor(draft.schedules,month)!;if(!scheduleTouched){setRule(structuredClone(version.rule));setWorkHours(structuredClone(version.hours));}if(!salaryTouched)setSalary(salaryText(versionFor(draft.salaries,month)?.salaryCents??1200000));}
  function selectRule(kind:string){setScheduleTouched(true);if(kind==='alternating'){const day=Temporal.PlainDate.from(localDate(Date.now(),draft!.workTimeZone));setRule({kind:'alternating',anchorMonday:day.subtract({days:day.dayOfWeek-1}).toString(),anchorType:'big'});}else setRule({kind:'weekly',weekdays:[1,2,3,4,5]});setConfirm(null);}
  function toggleDate(date:string){if(!draft)return;const c=candidate.config??draft;const next=!isWorkday(date,c);const clean=structuredClone(c);delete clean.dateOverrides[date];const reference=isWorkday(date,clean);setDraft({...draft,dateOverrides:{...draft.dateOverrides,...{[date]:next}}});if(next===reference)setDraft(previous=>{const value=structuredClone(previous!);delete value.dateOverrides[date];return value;});setConfirm(null);}
  async function adjustOverlay(adjustment:OverlayAdjustment){
    setError('');
    try{setAdjustedScale(await api().adjustOverlay(adjustment));}
    catch(error){setError((error as Error).message);}
  }
  async function persist(c:AppConfig){setBusy(true);setError('');try{const result=await api().saveConfig(c);if(!result.ok){setError(result.issues.map(i=>i.message).join('；'));return;}setBase(result.value);setDraft(structuredClone(result.value));setSalaryTouched(false);setScheduleTouched(false);setConfirm(null);setNotice('已保存。悬浮窗会按你的作息自动累计。');}catch(e){setError(String((e as Error).message));}finally{setBusy(false);}}
  async function save(event:FormEvent){event.preventDefault();if(!candidate.config)return;setBusy(true);setError('');setNotice('');try{const result=await api().previewConfig(candidate.config);if(!result.validation.ok){setError(result.validation.issues.map(i=>i.message).join('；'));return;}const months=new Set<string>();if(base){if(result.impact?.affectedMonths.includes(currentMonth))months.add(currentMonth);for(const date of new Set([...Object.keys(base.dateOverrides),...Object.keys(candidate.config.dateOverrides)]))if(base.dateOverrides[date]!==candidate.config.dateOverrides[date])months.add(date.slice(0,7));}if(months.size){setConfirm({config:candidate.config,months:[...months].sort()});return;}await persist(candidate.config);}catch(e){setError(String((e as Error).message));}finally{setBusy(false);}}
  if(!draft)return <main className="page"><h1>牛马冲冲冲设置</h1><p>{error||'正在读取本机设置…'}</p></main>;
  return <main className="page settings-page"><header className="page-header"><div className="eyebrow">牛马冲冲冲 / 偏好设置</div><h1>让每一秒，都有所值。</h1><p>按自己的月薪与作息，看见工作的回报。</p></header>
    {recovery&&<div className="notice warning" role="status">{recovery}</div>}
    <form onSubmit={save} onChangeCapture={event=>{const target=event.nativeEvent.target;if(!(target instanceof HTMLElement))return;const label=target.getAttribute('aria-label')??'';if(target instanceof HTMLInputElement&&target.type==='time'||['参考周日期','参考周类型','午休暂停累计'].includes(label))setScheduleTouched(true);if(label==='月薪（元）')setSalaryTouched(true);}} onClickCapture={event=>{if((event.target as HTMLElement).closest('.weekdays'))setScheduleTouched(true);}}>
      <section className="settings-section"><div className="section-heading"><h2>月薪与生效月份</h2><span className="muted">人民币 · 自行选择税前或实发</span></div><div className="field-grid"><label><span>月薪（元）</span><input aria-label="月薪（元）" className="salary-input" type="number" min="0.01" step="0.01" value={salary} onChange={e=>{setSalary(e.target.value);setConfirm(null);}} required/></label><label><span>生效月份</span><select aria-label="生效月份" value={effective} onChange={e=>selectMonth(e.target.value)}><option value={currentMonth}>{currentMonth} · 本月</option>{base&&<option value={Temporal.PlainYearMonth.from(currentMonth).add({months:1}).toString()}>{Temporal.PlainYearMonth.from(currentMonth).add({months:1}).toString()} · 下月</option>}</select></label></div></section>
      <section className="settings-section"><h2>工作安排</h2><label><span>排班方式</span><select aria-label="排班方式" value={rule.kind} onChange={e=>selectRule(e.target.value)}><option value="weekly">固定每周工作日</option><option value="alternating">大小周 · 两周循环</option></select></label>
        {rule.kind==='weekly'?<div className="weekdays" role="group" aria-label="每周工作日">{['日','一','二','三','四','五','六'].map((day,index)=><button key={day} type="button" aria-label={'星期'+day} aria-pressed={rule.weekdays.includes(index)} onClick={()=>setRule({...rule,weekdays:rule.weekdays.includes(index)?rule.weekdays.filter(d=>d!==index):[...rule.weekdays,index]})}>{day}</button>)}</div>:<div className="field-grid spaced"><label><span>参考周（周一）</span><input type="date" value={rule.anchorMonday} aria-label="参考周日期" onChange={e=>setRule({...rule,anchorMonday:e.target.value})}/></label><label><span>参考周类型</span><select aria-label="参考周类型" value={rule.anchorType} onChange={e=>setRule({...rule,anchorType:e.target.value as 'big'|'small'})}><option value="big">大周 · 周一至周六</option><option value="small">小周 · 周一至周五</option></select></label></div>}
        <div className="field-grid spaced"><label><span>上班时间</span><input aria-label="上班时间" type="time" required value={workHours.start} onChange={e=>setWorkHours({...workHours,start:e.target.value})}/></label><label><span>下班时间</span><input aria-label="下班时间" type="time" required value={workHours.end} onChange={e=>setWorkHours({...workHours,end:e.target.value})}/></label></div>
        <label className="switch-row"><input aria-label="午休暂停累计" type="checkbox" checked={!!workHours.lunch} onChange={e=>setWorkHours({...workHours,lunch:e.target.checked?{start:'12:00',end:'13:00'}:null})}/><span>午休暂停累计</span></label>
        {workHours.lunch&&<div className="field-grid"><label><span>午休开始</span><input aria-label="午休开始" type="time" required value={workHours.lunch.start} onChange={e=>setWorkHours({...workHours,lunch:{...workHours.lunch!,start:e.target.value}})}/></label><label><span>午休结束</span><input aria-label="午休结束" type="time" required value={workHours.lunch.end} onChange={e=>setWorkHours({...workHours,lunch:{...workHours.lunch!,end:e.target.value}})}/></label></div>}
      </section>
      <section className="settings-section"><h2>特殊日期调整</h2><p className="muted">点击日期切换上班或休息，轮换顺序保持不变。</p><Calendar config={candidate.config??draft} month={calendarMonth} onMonth={setCalendarMonth} onToggle={toggleDate} onClear={()=>{setDraft({...draft,dateOverrides:Object.fromEntries(Object.entries(draft.dateOverrides).filter(([date])=>!date.startsWith(calendarMonth)))});setConfirm(null);}}/></section>
      <section className="settings-section"><h2>悬浮窗与启动</h2><label className="switch-row"><input type="checkbox" checked={draft.launchAtLogin} onChange={e=>setDraft({...draft,launchAtLogin:e.target.checked})}/><span>登录 Mac 后自动出现</span></label><label><span>整额微光</span><select aria-label="整额微光" value={draft.appearance.milestoneYuan} onChange={e=>setDraft({...draft,appearance:{...draft.appearance,milestoneYuan:Number(e.target.value)as 0|10|100}})}><option value={100}>每赚到 ¥100</option><option value={10}>每赚到 ¥10</option><option value={0}>关闭微光</option></select></label>
      <label className="switch-row">
        <input type="checkbox" checked={draft.nativeInteraction===true} onChange={e=>setDraft({...draft,nativeInteraction:e.target.checked})}/>
        <span>启用原生交互</span>
      </label>
      <p className="muted">关闭时使用兼容显示。拖动、边缘拉伸和全屏自动变淡需要原生交互。与 Codex mini 同时使用时，建议保持关闭。</p>
      {base&&<section className="spaced overlay-adjustments" aria-labelledby="overlay-adjustments-title">
        <h3 id="overlay-adjustments-title">浮窗位置与大小</h3>
        <p className="muted">兼容显示也能调整。点击即生效并自动记住。</p>
        <div className="button-row">
          {([['left','左移'],['up','上移'],['down','下移'],['right','右移'],['smaller','缩小'],['larger','放大']] as const).map(([direction,label])=>
            <button key={direction} type="button" onClick={()=>void adjustOverlay(direction)}>{label}</button>)}
          <output aria-label="浮窗大小">{Math.round((adjustedScale??draft.window.scale??1)*100)}%</output>
        </div>
      </section>}
      <div className="field-grid spaced">{([['hoverOpacity','悬停不透明度'],['fullScreenOpacity','全屏不透明度'],['fullScreenHoverOpacity','全屏悬停不透明度']]as const).map(([key,label])=><label key={key}><span>{label} · {Math.round(draft.appearance[key]*100)}%</span><input type="range" aria-label={label} min={10} max={100} step={1} value={Math.round(draft.appearance[key]*100)} onChange={e=>setDraft({...draft,appearance:{...draft.appearance,[key]:Number(e.target.value)/100}})}/></label>)}</div>
      <p className="muted">工作时区：{draft.workTimeZone} · 数据仅保存在这台 Mac。</p></section>
      <div className="rate-preview"><div><span className="muted">{effective} 每秒收入</span><strong>{effectivePreview?rate(effectivePreview.rateCentsPerSecond):'—'}<small> / 秒</small></strong></div><span className="muted">{effectivePreview?.days.filter(d=>d.isWorkday).length??0} 个工作日</span></div>
      {candidate.error&&<p className="error" role="alert">{candidate.error}</p>}{error&&<p className="error" role="alert">{error}</p>}{notice&&<p className="notice" role="status">{notice}</p>}
      {effectivePreview?.plannedSeconds===0&&<p className="notice" role="status">{effective} 没有有效计划工时，收入暂不可计算，请调整排班。</p>}
      {confirm&&<div className="notice warning"><p>将重新折算：{confirm.months.join('、')}。这些月份的每秒收入和每日金额都可能变化。{preview&&<> 今日预览：{money(preview.today.earnedCents)}。</>}</p><div className="button-row"><button type="button" className="primary" disabled={busy||confirm.config!==candidate.config} onClick={()=>void persist(confirm.config)}>确认重新折算并保存</button><button type="button" onClick={()=>setConfirm(null)}>返回修改</button></div></div>}
      <button className="primary full-width" disabled={busy||!candidate.config||(!base&&!!recovery)} type="submit">{busy?'保存中…':base?'保存设置':'保存并开始赚钱'}</button>
    </form>
    {base&&<section className="settings-section native-status"><h2>原生窗口服务</h2><p>{base.nativeInteraction===true?(platform?.message??'正在检查连接…'):'兼容显示已启用'}</p>{base.nativeInteraction===true&&platform&&!platform.connected&&<><p className="muted">拖动与边缘拉伸需要辅助功能授权。更新应用后，若开关已开但仍无法连接，请移除旧条目，重新添加下方应用，再点击重新连接。</p><input aria-label="授权应用路径" readOnly value={platform.authorizationPath??platform.helperPath}/><div className="button-row"><button type="button" onClick={()=>void api().openAccessibilitySettings()}>打开辅助功能设置</button><button type="button" onClick={()=>void api().reconnectNative()}>重新连接</button></div></>}</section>}
  </main>;
}
