import test from 'node:test';import assert from 'node:assert/strict';import {readFile,readdir} from 'node:fs/promises';import {PGlite} from '@electric-sql/pglite';
import {newId} from '../src/core.js';import {openLocalDB} from '../src/cloud/local-db.js';import {indexedDB} from 'fake-indexeddb';import {SyncEngine} from '../src/cloud/sync.js';
const owner='10000000-0000-4000-8000-000000000001',other='20000000-0000-4000-8000-000000000001',session='10000000-0000-4000-8000-000000000002';
const db=new PGlite();
await db.exec(`create role anon;create role authenticated;create schema auth;
create table auth.users(id uuid primary key);create table auth.sessions(id uuid primary key,user_id uuid references auth.users(id),not_after timestamptz);
create function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb $$;
create function auth.uid() returns uuid language sql stable as $$ select (auth.jwt()->>'sub')::uuid $$;
grant usage on schema auth to authenticated,anon;grant execute on all functions in schema auth to authenticated,anon;
insert into auth.users values('${owner}'),('${other}');insert into auth.sessions values('${session}','${owner}',null);`);
const file=(await readdir('supabase/migrations')).find(f=>f.endsWith('_wenyan_cloud_foundation.sql'));
await db.exec(await readFile('supabase/migrations/'+file,'utf8'));
await db.exec(`update wenyan_private.config set owner_id='${owner}';`);
const claims={sub:owner,session_id:session,aud:'authenticated',role:'authenticated',is_anonymous:false};
async function as(jwt,role='authenticated'){await db.exec('reset role');await db.query("select set_config('request.jwt.claims',$1,false)",[JSON.stringify(jwt)]);await db.exec('set role '+role);}
async function rpc(name,args){const values=Object.values(args);const text=Object.keys(args).map((k,i)=>k+'=> $'+(i+1)+(values[i]!==null&&typeof values[i]==='object'?'::jsonb':'')).join(',');return (await db.query('select public.'+name+'('+text+') as result',values.map(v=>v!==null&&typeof v==='object'?JSON.stringify(v):v))).rows[0].result;}
const local=await openLocalDB('sql-'+newId(),indexedDB);await local.migrate([]);await local.bindOwner(owner);
const transport={commit:op=>rpc('wenyan_commit',{p_op:op}),pull:(cursor,high)=>rpc('wenyan_pull',{p_cursor:cursor,p_high:high,p_limit:2})};
test('migration/RPC deny anonymous, second user, unknown client, wrong audience and revoked sessions',async()=>{
 const op={id:newId(),v:3,events:[]};
 await as({},'anon');await assert.rejects(rpc('wenyan_pull',{}));
 for(const jwt of [{...claims,sub:other},{...claims,client_id:'unknown'},{...claims,aud:'wrong'},{...claims,session_id:newId()},{...claims,is_anonymous:true}]){await as(jwt);await assert.rejects(rpc('wenyan_commit',{p_op:op}),/FORBIDDEN/);await assert.rejects(rpc('wenyan_pull',{}),/FORBIDDEN/);}
 await as(claims);await assert.rejects(db.query('select * from wenyan_private.study_events'),/permission denied/);await assert.rejects(db.query("insert into wenyan_private.learner_settings values($1,0,'{}')",[owner]),/permission denied/);
});
test('actual PostgreSQL commits are idempotent, reject same ID with different payload, and preserve undo observations',async()=>{
 await as(claims);const event=await local.makeEvent('review','word:abandon',{rating:1,firstCorrect:false,hinted:true});const op=await local.commit({events:[event]});
 const first=await transport.commit(op);assert.equal(first.watermark,1);assert.deepEqual(await transport.commit(op),first);
 await assert.rejects(transport.commit({...op,events:[{...event,value:{rating:3}}]}),/OP_CONTENT_CONFLICT/);
 await assert.rejects(transport.commit({id:newId(),v:3,events:[{...event,value:{rating:3}}]}),/ID_CONTENT_CONFLICT/);
 const undo=await local.makeEvent('undo',event.key,{id:event.id});const undoOp=await local.commit({events:[undo]});assert.equal((await transport.commit(undoOp)).watermark,2);
 const illegal=await local.makeEvent('undo',event.key,{id:undo.id});await assert.rejects(transport.commit({id:newId(),v:3,events:[illegal]}),/UNDO_TARGET_MISSING/);
});
test('checkpoint receipts survive lost ack; causal local updates apply; stale remote writer becomes a preserved fork',async()=>{
 await as(claims);const value={id:newId(),mode:'recall',queue:['abandon'],index:0,results:[]};
 const op1=await local.commit({checkpoint:{key:'english',value}}),r1=await transport.commit(op1);
 const op2=await local.commit({checkpoint:{key:'english',value:{...value,current:{hinted:true}}},expectedLocalRevision:1}),r2=await transport.commit(op2);
 assert.equal(r2.checkpoint.revision,2);assert.equal((await transport.commit(op1)).checkpoint.revision,1);
 const stale={id:newId(),v:3,events:[],checkpoint:{...op1.checkpoint,baseRevision:1,baseOperation:null,value:{...value,current:{firstCorrect:false}}}};
 const fork=await transport.commit(stale);assert.equal(fork.checkpoint.conflict,true);assert.deepEqual(await transport.commit(stale),fork);
 await local.acknowledge(op1,r1);await local.acknowledge(op2,r2);const state=await local.read();assert.equal(state.checkpoints[0].revision,2);assert.equal(state.checkpoints[0].value.current.hinted,true);
});
test('settings merge per-field and refuse stale same-field overwrite',async()=>{
 await as(claims);const op=await local.commit({settings:{newWordLimit:12,layer:'core'}});const result=await transport.commit(op);assert.equal(result.settings.newWordLimit.revision,1);
 const next={id:newId(),v:3,events:[],settings:{newWordLimit:{value:6,baseRevision:1},layer:{value:'full',baseRevision:1}}};await transport.commit(next);
 const stale={id:newId(),v:3,events:[],settings:{newWordLimit:{value:24,baseRevision:1}}};const conflict=await transport.commit(stale);assert.equal(conflict.settings.newWordLimit.conflict,true);assert.equal(conflict.settings.newWordLimit.current.value,6);
 await local.acknowledge(op,result);
});
test('outbox → PostgreSQL → second IndexedDB closes the loop without duplicate reviews',async()=>{
 await as(claims);const engine=new SyncEngine(local,transport);await engine.flush();assert.equal((await local.read()).outbox.length,0);
 const second=await openLocalDB('sql-b-'+newId(),indexedDB);await second.bindOwner(owner);await new SyncEngine(second,transport).flush();
 const a=await local.read(),b=await second.read();assert.deepEqual(a.facts,b.facts);assert.equal(b.checkpoints[0].value.current.hinted,true);assert.equal(b.cursor,2);second.close();
});
test('unknown protocol, malformed events, missing dependencies and future clocks reject atomically',async()=>{
 await as(claims);const event=await local.makeEvent('review','word:ability',{rating:3});
 for(const op of [{id:newId(),v:2,events:[]},{id:newId(),v:3,events:[{...event,value:{rating:2}}]},{id:newId(),v:3,events:[{...event,at:Date.now()+86400001*2}]},{id:newId(),v:3,events:[{...event,id:null}]}])await assert.rejects(transport.commit(op));
 assert.equal((await transport.pull(0,null)).watermark,2);
});
test('fixed-watermark pagination cannot omit late committed facts',async()=>{
 await as(claims);const first=await transport.pull(0,null);assert.equal(first.nextCursor,2);
 const event=await local.makeEvent('typing','word:ability',{correct:true});const op=await local.commit({events:[event]});await transport.commit(op);
 const old=await transport.pull(2,2);assert.equal(old.events.length,0);assert.equal(old.watermark,2);
 const fresh=await transport.pull(2,null);assert.equal(fresh.events.length,1);assert.equal(fresh.nextCursor,3);
 local.close();await db.close();
});
