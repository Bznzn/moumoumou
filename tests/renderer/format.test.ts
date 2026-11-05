import{expect,it}from'vitest';
import{money}from'../../src/renderer/api';
it('formats exact integer cents up to the supported maximum and rounds derived fractions once',()=>{
  expect(money(Number.MAX_SAFE_INTEGER)).toBe('¥90,071,992,547,409.91');
  expect(money(136956.521739)).toBe('¥1,369.57');
});
