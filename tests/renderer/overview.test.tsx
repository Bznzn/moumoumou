// @vitest-environment jsdom
import{describe,expect,it}from'vitest';
import{render,screen,fireEvent}from'@testing-library/react';
import{OverviewPage}from'../../src/renderer/overview/OverviewPage';
import{host}from'./host';
import{fixture}from'../fixtures';
describe('income overview',()=>{
  it('uses exact monthly total and expands a daily calculation',async()=>{
    host();render(<OverviewPage/>);await screen.findByText('¥1,369.57');
    expect(screen.getAllByRole('button',{name:/2026-11-\d\d/})[0].getAttribute('aria-label')).toContain('2026-11-04');
    fireEvent.click(screen.getByRole('button',{name:/2026-11-04/}));
    expect(screen.getByText('5 小时')).toBeTruthy();expect(screen.getByText('12:00–13:00')).toBeTruthy();
  });
  it('does not show full salary as future income when no work time is configured',async()=>{
    const c=fixture();c.schedules[0].rule={kind:'weekly',weekdays:[]};host(c);render(<OverviewPage/>);
    const month=await screen.findByLabelText('查看月份');fireEvent.change(month,{target:{value:'2026-12'}});
    await screen.findByText(/没有有效计划工时/);expect(screen.queryByText('¥12,000.00',{selector:'.month-total'})).toBeNull();expect(screen.getByRole('button',{name:'调整排班'})).toBeTruthy();
  });
});
