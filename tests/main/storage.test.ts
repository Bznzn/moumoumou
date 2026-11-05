import { afterEach, describe, expect, it } from 'vitest';
import { mkdtemp, readFile, writeFile, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createConfigStore } from '../../src/main/storage';
import { fixture } from '../fixtures';
const dirs:string[]=[];
async function directory(){const d=await mkdtemp(path.join(tmpdir(),'salary-float-test-'));dirs.push(d);return d;}
afterEach(async()=>{await Promise.all(dirs.splice(0).map(d=>rm(d,{recursive:true,force:true})));});
describe('local config store',()=>{
  it('distinguishes first launch from corrupt data and writes a private file',async()=>{
    const d=await directory(),store=createConfigStore(d);expect(await store.load()).toEqual({config:null,recovered:false,error:null});
    await store.save(fixture());expect(JSON.parse(await readFile(path.join(d,'config.json'),'utf8'))).toEqual(fixture());
    expect((await stat(path.join(d,'config.json'))).mode&0o777).toBe(0o600);
  });
  it('serialises concurrent writes and keeps last valid backup',async()=>{
    const d=await directory(),store=createConfigStore(d),a=fixture(),b=fixture();b.salaries[0].salaryCents=1500000;
    await Promise.all([store.save(a),store.save(b)]);
    expect((await createConfigStore(d).load()).config).toEqual(b);
    expect(JSON.parse(await readFile(path.join(d,'config.backup.json'),'utf8'))).toEqual(a);
  });
  it('recovers valid backup without destroying the corrupt primary on load',async()=>{
    const d=await directory();await writeFile(path.join(d,'config.json'),'broken');await writeFile(path.join(d,'config.backup.json'),JSON.stringify(fixture()));
    const result=await createConfigStore(d).load();expect(result.recovered).toBe(true);expect(result.config).toEqual(fixture());
    expect(await readFile(path.join(d,'config.json'),'utf8')).toBe('broken');
  });
  it('does not overwrite unrecoverable or newer schema configuration',async()=>{
    const d=await directory();const raw=JSON.stringify({...fixture(),schemaVersion:2});await writeFile(path.join(d,'config.json'),raw);
    const store=createConfigStore(d);expect((await store.load()).error).not.toBeNull();await expect(store.save(fixture())).rejects.toThrow();
    expect(await readFile(path.join(d,'config.json'),'utf8')).toBe(raw);
  });
  it('rejects invalid configuration before writing',async()=>{
    const store=createConfigStore(await directory());const c=fixture();c.salaries[0].salaryCents=-1;await expect(store.save(c)).rejects.toThrow();
  });
  it('protects newer schema even when an older valid backup exists',async()=>{
    const d=await directory(),raw=JSON.stringify({...fixture(),schemaVersion:2,newVersionData:'must survive'});
    await writeFile(path.join(d,'config.json'),raw);await writeFile(path.join(d,'config.backup.json'),JSON.stringify(fixture()));
    const store=createConfigStore(d),result=await store.load();expect(result.config).toBeNull();expect(result.recovered).toBe(false);expect(result.error).not.toBeNull();
    await expect(store.save(fixture())).rejects.toThrow();expect(await readFile(path.join(d,'config.json'),'utf8')).toBe(raw);
  });
});
