// @vitest-environment jsdom
import{describe,expect,it,vi}from'vitest';
import{render,screen,fireEvent}from'@testing-library/react';
import{Calendar}from'../../src/renderer/settings/Calendar';
import{fixture}from'../fixtures';
import'./host';
describe('alternating calendar',()=>{
  it('shows working Saturday and lets a date be explicitly overridden',()=>{
    const toggle=vi.fn();render(<Calendar config={fixture()} month="2026-11" onMonth={()=>{}} onToggle={toggle} onClear={()=>{}}/>);
    const saturday=screen.getByRole('button',{name:'2026-11-07，上班'});expect(saturday.getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('button',{name:'2026-11-14，休息'}).getAttribute('aria-pressed')).toBe('false');
    fireEvent.click(saturday);expect(toggle).toHaveBeenCalledWith('2026-11-07');
  });
});
