import type {AppConfig} from '../shared/model';
import {validateConfig} from '../shared/config';
import {mkdir,readFile,writeFile,rename,unlink} from 'node:fs/promises';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
type Status={config:AppConfig|null;recovered:boolean;error:string|null};
export function createConfigStore(directory:string) {
  let status:Status|undefined;
  let lastGood:AppConfig|null=null;
  let queue:Promise<void>=Promise.resolve();
  const primary=path.join(directory,'config.json'),backup=path.join(directory,'config.backup.json');
  async function read(file:string):Promise<{missing:boolean;config:AppConfig|null;error:string|null;unsupported?:boolean}> {
    try {
      const data=JSON.parse(await readFile(file,'utf8'));
      if(data&&typeof data==='object'&&'schemaVersion'in data&&data.schemaVersion!==1)return{missing:false,config:null,error:'配置版本不受支持，原文件已保护，请使用兼容版本打开',unsupported:true};
      const result=validateConfig(data);
      return result.ok?{missing:false,config:result.value,error:null}:{missing:false,config:null,error:'配置格式或版本不受支持'};
    } catch(error) {if((error as NodeJS.ErrnoException).code==='ENOENT')return {missing:true,config:null,error:null};return {missing:false,config:null,error:'配置无法读取或已损坏'};}
  }
  async function load():Promise<Status> {
    if(status)return structuredClone(status);
    const main=await read(primary);
    if(main.unsupported){status={config:null,recovered:false,error:main.error};return structuredClone(status);}
    if(main.config) {lastGood=main.config;status={config:lastGood,recovered:false,error:null};return structuredClone(status);}
    const saved=await read(backup);
    if(saved.config){lastGood=saved.config;status={config:lastGood,recovered:true,error:main.error??'主配置缺失，已读取备份'};}
    else status={config:null,recovered:false,error:main.missing&&saved.missing?null:main.error??saved.error??'配置不可恢复'};
    return structuredClone(status);
  }
  async function atomic(file:string,value:AppConfig) {
    const temporary=file+'.'+randomUUID()+'.tmp';
    try {await writeFile(temporary,JSON.stringify(value,null,2),{encoding:'utf8',mode:0o600,flag:'wx'});await rename(temporary,file);}
    finally {await unlink(temporary).catch(()=>{});}
  }
  function save(config:AppConfig):Promise<void> {
    const validation=validateConfig(config);
    if(!validation.ok)return Promise.reject(Error('无效配置：'+validation.issues.map(i=>i.message).join('；')));
    const next=structuredClone(validation.value);
    const job=queue.catch(()=>{}).then(async()=>{
      const loaded=await load();
      if(loaded.error&&!lastGood)throw Error('现有配置无法恢复，已保留原文件，未覆盖');
      await mkdir(directory,{recursive:true,mode:0o700});
      if(lastGood)await atomic(backup,lastGood);
      await atomic(primary,next);
      lastGood=next;status={config:next,recovered:false,error:null};
    });
    queue=job;return job;
  }
  return {load,save};
}
