import type{SalaryFloatApi}from'../shared/api';
export const api=():SalaryFloatApi=>{if(!window.salaryFloat)throw Error('原生连接不可用，请从桌面应用打开');return window.salaryFloat;};
export const money=(cents:number)=>{const rounded=BigInt(Math.round(cents)),absolute=rounded<0n?-rounded:rounded;return(rounded<0n?'-¥':'¥')+(absolute/100n).toLocaleString('zh-CN')+'.'+(absolute%100n).toString().padStart(2,'0');};
export const rate=(cents:number)=>'¥'+(cents/100).toFixed(4);
export const hours=(seconds:number)=>`${Number((seconds/3600).toFixed(2))} 小时`;
