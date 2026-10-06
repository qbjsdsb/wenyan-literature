import test from 'node:test';
import assert from 'node:assert/strict';
test('学习操作先落本机、重开恢复，另一标签页保存不覆盖旧记录，写入失败明确提示',async()=>{
 const map=new Map();globalThis.location={search:''};globalThis.window=new EventTarget();
 globalThis.localStorage={getItem:k=>map.get(k)||null,setItem:(k,v)=>map.set(k,v)};
 const a=await import('../src/storage.js?first');a.record('task','day:reading',{done:true});
 assert.equal(JSON.parse(map.get('wenyan-events-v2')).length,1);
 const b=await import('../src/storage.js?reopen');assert.equal(b.store.events.length,1);
 b.record('favorite','word:ability',{on:true});a.record('favorite','word:abandon',{on:true});assert.equal(JSON.parse(map.get('wenyan-events-v2')).length,3);
 const c=await import('../src/storage.js?corrupt');const before=map.get('wenyan-events-v2');map.set('wenyan-events-v2','broken');assert.equal(c.save(),false);assert.equal(map.get('wenyan-events-v2'),'broken');map.set('wenyan-events-v2',before);
 localStorage.setItem=()=>{throw Error('quota')};assert.equal(a.save(),false);assert.match(a.store.problem,/未能保存/);assert.equal(map.get('wenyan-events-v2'),before);
});
