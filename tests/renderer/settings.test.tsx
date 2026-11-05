// @vitest-environment jsdom
import{describe,it,expect}from'vitest';
import{render,screen,fireEvent,waitFor}from'@testing-library/react';
import{SettingsPage}from'../../src/renderer/settings/SettingsPage';
import{host}from'./host';
import{fixture,now}from'../fixtures';
import{applyMonthlyChange}from'../../src/shared/config';
import{calculateMonth}from'../../src/shared/income';
describe('settings flow',()=>{
  it('allows a first salary and the alternating schedule to be saved',async()=>{
    const{api}=host(null);render(<SettingsPage/>);
    const salary=await screen.findByLabelText('月薪（元）');fireEvent.change(salary,{target:{value:'15000'}});
    fireEvent.change(screen.getByLabelText('排班方式'),{target:{value:'alternating'}});
    expect(screen.getByLabelText('参考周类型')).toBeTruthy();
    fireEvent.click(screen.getByRole('button',{name:'保存并开始赚钱'}));
    await waitFor(()=>expect(api.saveConfig).toHaveBeenCalled());
    const saved=(api.saveConfig as any).mock.calls[0][0];expect(saved.salaries.at(-1).salaryCents).toBe(1500000);expect(saved.schedules.at(-1).rule.kind).toBe('alternating');
  });
  it('keeps invalid hours in the form but prevents saving',async()=>{
    host();render(<SettingsPage/>);await screen.findByLabelText('月薪（元）');
    fireEvent.change(screen.getByLabelText('下班时间'),{target:{value:'08:00'}});
    expect((screen.getByRole('button',{name:'保存设置'})as HTMLButtonElement).disabled).toBe(true);
  });
  it('does not create future salary or schedule versions for an appearance change',async()=>{
    const original=fixture(),{api}=host(original);render(<SettingsPage/>);await screen.findByLabelText('月薪（元）');
    fireEvent.change(screen.getByLabelText('悬停不透明度'),{target:{value:'35'}});fireEvent.click(screen.getByRole('button',{name:'保存设置'}));
    await waitFor(()=>expect(api.saveConfig).toHaveBeenCalled());const saved=(api.saveConfig as any).mock.calls[0][0];
    expect(saved.salaries).toEqual(original.salaries);expect(saved.schedules).toEqual(original.schedules);
    const raised=applyMonthlyChange(saved,{from:'2026-11',salaryCents:1500000});expect(calculateMonth(raised,'2026-12',now).salaryCents).toBe(1500000);
  });
  it('keeps typed salary when selecting its effective month',async()=>{
    const{api}=host();render(<SettingsPage/>);const salary=await screen.findByLabelText('月薪（元）');
    fireEvent.change(salary,{target:{value:'15000'}});fireEvent.change(screen.getByLabelText('生效月份'),{target:{value:'2026-11'}});
    expect((salary as HTMLInputElement).value).toBe('15000');fireEvent.click(screen.getByRole('button',{name:'保存设置'}));
    await waitFor(()=>expect(api.saveConfig).toHaveBeenCalled());expect((api.saveConfig as any).mock.calls[0][0].salaries.at(-1).salaryCents).toBe(1500000);
  });
  it('warns before changing a past month and invalidates a stale confirmation after more edits',async()=>{
    const{api}=host();render(<SettingsPage/>);await screen.findByLabelText('月薪（元）');
    fireEvent.click(screen.getByRole('button',{name:'上个月'}));fireEvent.click(screen.getByRole('button',{name:'2026-10-30，上班'}));
    fireEvent.click(screen.getByRole('button',{name:'保存设置'}));
    await screen.findByRole('button',{name:'确认重新折算并保存'});expect(api.saveConfig).not.toHaveBeenCalled();expect(screen.getByText(/将重新折算：2026-10/)).toBeTruthy();
    fireEvent.change(screen.getByLabelText('上班时间'),{target:{value:'10:00'}});
    expect(screen.queryByRole('button',{name:'确认重新折算并保存'})).toBeNull();
  });
  it('explains a month with no effective work time instead of implying a computable rate',async()=>{
    const c=fixture();c.schedules[0].rule={kind:'weekly',weekdays:[]};host(c);render(<SettingsPage/>);
    await screen.findByLabelText('月薪（元）');expect(screen.getByText(/没有有效计划工时/)).toBeTruthy();
  });
  it('stores the exact cent value of a large but valid decimal input',async()=>{
    const{api}=host(null);render(<SettingsPage/>);fireEvent.change(await screen.findByLabelText('月薪（元）'),{target:{value:'90071992547409.90'}});
    fireEvent.click(screen.getByRole('button',{name:'保存并开始赚钱'}));await waitFor(()=>expect(api.saveConfig).toHaveBeenCalled());
    expect((api.saveConfig as any).mock.calls[0][0].salaries.at(-1).salaryCents).toBe(9007199254740990);
  });
});
