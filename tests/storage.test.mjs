import test from 'node:test';import assert from 'node:assert/strict';import {indexedDB} from 'fake-indexeddb';
test('storage facade waits for IDB durability and preserves legacy source untouched',async()=>{
 const map=new Map();globalThis.indexedDB=indexedDB;globalThis.location={search:'?test=1'};globalThis.window=new EventTarget();
 globalThis.localStorage={getItem:k=>map.get(k)||null,setItem:(k,v)=>map.set(k,v),removeItem:k=>map.delete(k)};
 const a=await import('../src/storage.js?first');await a.ready;await a.record('task','day:reading',{done:true});assert.equal(a.store.facts.length,1);
 assert.equal(map.has('wenyan-test:wenyan-events-v2'),false);
 const b=await import('../src/storage.js?reopen');await b.ready;assert.equal(b.store.events.length,1);
 await b.record('favorite','word:ability',{on:true});await a.record('favorite','word:abandon',{on:true});await a.refresh();assert.equal(a.store.facts.length,3);a.database.close();b.database.close();
});
