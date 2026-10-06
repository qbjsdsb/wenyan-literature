import test from 'node:test';
import assert from 'node:assert/strict';
import {indexedDB} from 'fake-indexeddb';
import {openLocalDB} from '../src/cloud/local-db.js';
import {SyncEngine} from '../src/cloud/sync.js';
async function fixture(){let wall=Date.now(),mono=0;const clock={wall:()=>wall,monotonic:()=>mono};const db=await openLocalDB('clock-'+crypto.randomUUID(),indexedDB,clock);return {db,advance:(w,m)=>{wall+=w;mono+=m;},wall:()=>wall};}
for(const jump of [-3600000,172800000])test(`clock jump ${jump} cannot poison lastAt, advance session or append a fact`,async()=>{
 const f=await fixture();await f.db.observeServerClock(new Date(f.wall()).toISOString());
 const before=await f.db.rawRecovery();f.advance(jump,100);
 await assert.rejects(f.db.makeEvent('typing','word:ability',{correct:true}),/CLOCK_OUT_OF_RANGE/);
 await assert.rejects(f.db.commit({settings:{newWordLimit:6}}),/CLOCK_OUT_OF_RANGE/);
 assert.deepEqual(await f.db.rawRecovery(),before);
 f.advance(-jump+100,0);await f.db.observeServerClock(new Date(f.wall()).toISOString());
 const event=await f.db.makeEvent('typing','word:ability',{correct:true});await f.db.commit({events:[event]});assert.equal((await f.db.read()).facts.length,1);f.db.close();
});
test('ordinary elapsed offline time remains usable and keeps original wall time',async()=>{
 const f=await fixture();f.advance(3600000,3600000);const e=await f.db.makeEvent('typing','word:ability',{correct:true});assert.equal(e.rawAt,f.wall());assert.equal(e.at,e.rawAt);await f.db.commit({events:[e]});f.db.close();
});
test('untrusted computer clock pauses upload before committing any operation and recovers without rewriting facts',async()=>{
 const f=await fixture();const e=await f.db.makeEvent('typing','word:ability',{correct:true});await f.db.commit({events:[e]});
 let serverTime=f.wall()-3600000,commits=0;
 const engine=new SyncEngine(f.db,{commit:async op=>{commits++;return {v:3,operationId:op.id,eventSeqs:{[e.id]:1}};},pull:async cursor=>({v:3,watermark:cursor,nextCursor:cursor,events:[],asOf:new Date(serverTime).toISOString()})});
 await assert.rejects(engine.flush(),/CLOCK_OUT_OF_RANGE/);assert.equal(commits,0);assert.equal((await f.db.read()).outbox.length,1);
 serverTime=f.wall();await engine.flush();assert.equal(commits,1);assert.deepEqual((await f.db.read()).facts[0],e);f.db.close();
});
