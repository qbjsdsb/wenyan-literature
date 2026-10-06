// Regression for CDN/HTTP shell skew during an otherwise successful install.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
const code=await readFile('dist/sw.js','utf8'),html=await readFile('dist/index.html','utf8');
const handlers={},entries=new Map(),cacheNames=new Set(['wenyan-shell-previous']);let stale=true,completed;
const ctx={URL,Request,Error,Promise,self:{location:{href:'https://example.test/desktop/sw.js'},addEventListener:(type,fn)=>handlers[type]=fn},
 caches:{open:async name=>{cacheNames.add(name);return {put:async(url,response)=>entries.set(url,await response.text()),addAll:async requests=>{assert(requests.every(r=>r.cache==='reload'));}};},delete:async name=>cacheNames.delete(name),keys:async()=>[...cacheNames]},
 fetch:async request=>{assert.equal(request.cache,'reload');return new Response(stale?html.replace(/name="wenyan-build" content="[^"]+"/,'name="wenyan-build" content="old"'):html);}};
vm.runInNewContext(code,ctx);
handlers.install({waitUntil:promise=>completed=promise});
await assert.rejects(completed,/SHELL_VERSION_MISMATCH/);assert.deepEqual([...cacheNames],['wenyan-shell-previous']);
stale=false;handlers.install({waitUntil:promise=>completed=promise});await completed;
assert.equal(entries.get('https://example.test/desktop/index.html'),html);
handlers.activate({waitUntil:promise=>completed=promise});await completed;
assert(!cacheNames.has('wenyan-shell-previous'));assert.equal(cacheNames.size,1);
console.log('Mixed-version offline install rejected; prior cache preserved; consistent install passed');
