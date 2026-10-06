import test from 'node:test';import assert from 'node:assert/strict';
import {indexedDB} from 'fake-indexeddb';import {openLocalDB} from '../src/cloud/local-db.js';
import {createSmartSession,completeEnglishStep} from '../src/english/smart.js';
import {reviewCard,newId} from '../src/core.js';import {SyncEngine} from '../src/cloud/sync.js';
const open=()=>openLocalDB('test-'+newId(),indexedDB);
const checkpoint=()=>({key:'english',value:createSmartSession({id:newId(),newIds:['ability','abandon'],newLimit:2})});
test('atomic failure does not advance session, facts or outbox; restart restores hint and first answer',async()=>{
 const db=await open(),cp=checkpoint();await db.commit({checkpoint:cp});const state=await db.read();
 const event=await db.makeEvent('review','word:ability',{rating:1,firstCorrect:false,hinted:true});
 const next={...cp.value,index:1,current:{hinted:true,firstCorrect:false}};
 await assert.rejects(db.commit({events:[event],checkpoint:{key:'english',value:next},expectedLocalRevision:1},true));
 let after=await db.read();assert.equal(after.facts.length,0);assert.equal(after.outbox.length,state.outbox.length);assert.equal(after.checkpoints[0].value.index,0);
 await db.commit({checkpoint:{key:'english',value:{...cp.value,current:{hinted:true,firstCorrect:false}}},expectedLocalRevision:1});
 const name=db.db.name;db.close();const restarted=await openLocalDB(name,indexedDB);assert.equal((await restarted.read()).checkpoints[0].value.current.hinted,true);restarted.close();
});
test('same ID content conflict rejects instead of choosing a copy',async()=>{
 const db=await open(),event=await db.makeEvent('favorite','word:ability',{on:true});await db.commit({events:[event]});
 await db.commit({events:[event]});assert.equal((await db.read()).facts.length,1);
 await assert.rejects(db.commit({events:[{...event,value:{on:false}}]}),/ID_CONTENT_CONFLICT/);db.close();
});
test('multi-tab local compare-and-swap rejects a stale checkpoint',async()=>{
 const db=await open(),cp=checkpoint();await db.commit({checkpoint:cp});const other=await openLocalDB(db.db.name,indexedDB);
 await db.commit({checkpoint:cp,expectedLocalRevision:1});await assert.rejects(other.commit({checkpoint:cp,expectedLocalRevision:1}),/LOCAL_WRITER_CONFLICT/);
 assert.equal((await other.read()).outbox.length,2);db.close();other.close();
});
test('cloud pull joins unconfirmed local facts; malformed page never moves cursor',async()=>{
 const db=await open(),local=await db.makeEvent('favorite','word:ability',{on:true}),remote=await db.makeEvent('review','word:abandon',{rating:3});await db.commit({events:[local]});
 await db.receive({v:3,watermark:1,nextCursor:1,events:[{event:remote,seq:1}],checkpoints:[]});const state=await db.read();assert.equal(state.facts.length,2);assert.equal(state.outbox.length,1);
 await assert.rejects(db.receive({v:3,watermark:2,nextCursor:2,events:[{event:{bad:true},seq:2}]}));assert.equal((await db.read()).cursor,1);db.close();
});
test('binding a different account never mixes learning histories',async()=>{const db=await open();await db.bindOwner(newId());await assert.rejects(db.bindOwner(newId()),/ACCOUNT_MISMATCH/);db.close();});
test('v2 import preserves original IDs/history, separates checkpoints and is idempotent',async()=>{
 const db=await open(),ev={id:newId(),device:'legacy',kind:'review',key:'word:ability',at:Date.now()-10000,value:{rating:1}},cp=checkpoint();
 await db.migrate([ev,{id:newId(),device:'legacy',kind:'session',key:'english',at:Date.now(),value:cp.value}]);await db.migrate([ev]);
 const state=await db.read();assert.equal(state.facts.length,1);assert.equal(state.facts[0].id,ev.id);assert.equal(state.checkpoints.length,1);assert.equal(reviewCard(state.events,ev.key).reps,1);assert.equal(state.facts[0].value.firstCorrect,undefined);db.close();
});
test('lost ack leaves durable outbox; retry uses exact operation identity',async()=>{
 const db=await open(),event=await db.makeEvent('review','word:ability',{rating:3});await db.commit({events:[event]});let first,attempts=0;
 const engine=new SyncEngine(db,{commit:async op=>{first??=op;assert.deepEqual(op,first);if(++attempts===1)throw Error('lost response');return{v:3,operationId:op.id,eventSeqs:{[event.id]:1}};},pull:async()=>({v:3,watermark:1,nextCursor:1,events:[{event,seq:1}],checkpoints:[]})});
 await assert.rejects(engine.flush());assert.equal((await db.read()).outbox.length,1);await engine.flush();assert.equal((await db.read()).outbox.length,0);assert.equal((await db.read()).facts.length,1);db.close();
});
test('snapshot keeps a bounded local recovery ring and contains no auth data',async()=>{const db=await open();for(let i=0;i<8;i++){await db.snapshot();await new Promise(r=>setTimeout(r,2));}const snapshots=await db.transaction(['snapshots'],'readonly',s=>new Promise(r=>{const req=s('snapshots').getAll();req.onsuccess=()=>r(req.result);}));assert.ok(snapshots.length<=5);assert.equal(snapshots[0].schema,3);assert.ok(!JSON.stringify(snapshots).includes('access_token'));db.close();});
test('backup restore is atomic across all batches, checkpoint and settings',async()=>{
 const db=await open(),facts=Array.from({length:101},(_,i)=>({id:newId(),device:'backup',kind:'favorite',key:'word:ability',at:Date.now()-1000+i,value:{on:true}})),cp=checkpoint(),events=[...facts,{id:newId(),device:'backup',kind:'session',key:'english',at:Date.now(),value:cp.value}];
 await assert.rejects(db.restore(events,{newWordLimit:{value:6}},true));let state=await db.read();assert.equal(state.facts.length,0);assert.equal(state.checkpoints.length,0);assert.equal(state.outbox.length,0);
 await db.restore(events,{newWordLimit:{value:6}});state=await db.read();assert.equal(state.facts.length,101);assert.equal(state.settings.newWordLimit.value,6);assert.ok(state.outbox.every(op=>op.events.length<=50));await db.restore(events);assert.equal((await db.read()).facts.length,101);db.close();
});
test('same v2 backup can be restored after migration without conflicting with protocol metadata',async()=>{const db=await open(),ev={id:newId(),device:'legacy',kind:'favorite',key:'word:ability',at:Date.now(),value:{on:true}};await db.migrate([ev]);await db.restore([ev]);assert.equal((await db.read()).facts.length,1);db.close();});
test('corrupted IndexedDB facts are surfaced instead of silently filtered into an empty account',async()=>{const db=await open();await db.transaction(['facts'],'readwrite',s=>{s('facts').put({id:'corrupt-row',event:{invalid:true}});});await assert.rejects(db.read(),/INVALID_FACTS/);db.close();});
test('checkpoint conflict keeps all facts and resolves to committed cloud or a new local fork',async()=>{
 for(const choice of ['cloud','local']){const db=await open(),cp=checkpoint(),op=await db.commit({checkpoint:cp});await db.acknowledge(op,{v:3,operationId:op.id,eventSeqs:{},checkpoint:{conflict:true,revision:2,id:cp.value.id}});const remote={id:cp.value.id,...cp,at:Date.now(),writer:'other-device',revision:2};await db.receive({v:3,watermark:0,nextCursor:0,events:[],checkpoints:[remote]});await db.resolveConflict(op.id,choice);const state=await db.read();assert.equal(state.conflicts.length,0);assert.equal(state.checkpoints.length,1);assert.equal(state.checkpoints[0].id===cp.value.id,choice==='cloud');assert.equal(state.outbox.length,choice==='local'?1:0);db.close();}
});
test('concurrent boolean flags preserve review and bookmarks until an explicit observed choice',async()=>{
 const {latest}=await import('../src/core.js');const a=await open(),b=await open();
 for(const kind of ['mastered','favorite']){const ea=await a.makeEvent(kind,'word:ability',{on:true}),eb=await b.makeEvent(kind,'word:ability',{on:false});await a.commit({events:[ea,eb]});assert.deepEqual(latest((await a.read()).facts,kind,ea.key),{on:kind==='favorite',conflict:true});const resolved=await a.makeEvent(kind,ea.key,{on:kind==='mastered'});assert.equal(resolved.previous.length,2);await a.commit({events:[resolved]});assert.equal(latest((await a.read()).facts,kind,ea.key).conflict,false);}
 a.close();b.close();
});
test('unknown fact versions and skipped pull sequences cannot poison local history or cursor',async()=>{const db=await open(),ev=await db.makeEvent('favorite','word:ability',{on:true});await assert.rejects(db.restore([{...ev,version:4}]),/UNKNOWN_FACT_VERSION/);await assert.rejects(db.receive({v:3,watermark:2,nextCursor:2,events:[{seq:2,event:ev}]}),/INVALID_PAGE/);assert.equal((await db.read()).cursor,0);assert.equal((await db.read()).facts.length,0);db.close();});
test('first device initializes cloud settings while another clean device adopts committed settings',async()=>{const a=await open(),b=await open();await a.migrate([],{newWordLimit:6,layer:'core',timezone:'Asia/Shanghai'});await a.prepareSettings({});let state=await a.read();assert.equal(state.outbox.length,1);assert.equal(state.outbox[0].settings.newWordLimit.value,6);await b.migrate([],{newWordLimit:12,layer:'core',timezone:'UTC'});await b.prepareSettings({newWordLimit:{value:6,revision:1},layer:{value:'full',revision:1},timezone:{value:'Asia/Shanghai',revision:1}});state=await b.read();assert.equal(state.outbox.length,0);assert.equal(state.settings.layer.value,'full');assert.equal(state.settings.newWordLimit.value,6);a.close();b.close();});
test('restore validates undo references and emits original facts before earlier-clock undos',async()=>{const db=await open(),ev={id:newId(),device:'legacy',kind:'review',key:'word:ability',at:Date.now(),value:{rating:3}},undo={id:newId(),device:'legacy',kind:'undo',key:ev.key,at:ev.at-1000,value:{id:ev.id}};await assert.rejects(db.restore([undo]),/INVALID_UNDO_REFERENCE/);await db.restore([undo,ev]);const state=await db.read();assert.equal(state.outbox[0].events[0].id,ev.id);assert.equal(reviewCard(state.facts,ev.key).reps,0);db.close();});
