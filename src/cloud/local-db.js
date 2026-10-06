import {newId,mergeEvents,validEvent,flagHeads} from '../core.js';
import {PROTOCOL,CONTENT_VERSION,SCHEDULER_VERSION,assertSame,validateFacts,validateCheckpoint,checkpointEvent,validateSetting} from './protocol.js';
const stores=['facts','checkpoints','outbox','meta','snapshots','conflicts'];
const request=req=>new Promise((resolve,reject)=>{req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);});
export async function openLocalDB(name,indexedDB=globalThis.indexedDB,clock={wall:()=>Date.now(),monotonic:()=>performance.now()}){
 if(!indexedDB)throw Error('INDEXEDDB_UNAVAILABLE');
 const req=indexedDB.open(name,1);req.onupgradeneeded=()=>{for(const s of stores)req.result.createObjectStore(s,{keyPath:s==='meta'?'key':'id'});};
 const db=await request(req);db.onversionchange=()=>db.close();
 let wallAnchor=clock.wall(),monoAnchor=clock.monotonic(),clockIssue=false;
 const safeNow=()=>{const wall=clock.wall();if(clockIssue||Math.abs(wall-wallAnchor-(clock.monotonic()-monoAnchor))>300000)throw Error('CLOCK_OUT_OF_RANGE');return wall;};
 async function observeServerClock(asOf){
  if(!asOf)return;const serverAt=Date.parse(asOf);if(!Number.isFinite(serverAt))throw Error('INVALID_SERVER_TIME');
  const wall=clock.wall();clockIssue=Math.abs(wall-serverAt)>300000;
  if(!clockIssue){wallAnchor=wall;monoAnchor=clock.monotonic();}
  if(clockIssue)throw Error('CLOCK_OUT_OF_RANGE');
 }
 async function transaction(names,mode,fn){
  const tx=db.transaction(names,mode);const done=new Promise((res,rej)=>{tx.oncomplete=res;tx.onabort=()=>rej(tx.error||Error('TRANSACTION_ABORTED'));tx.onerror=()=>{};});
  // Attach rejection now; abort can fire before the callback resumes.
  done.catch(()=>{});try{const result=await fn(n=>tx.objectStore(n),tx);await done;return result;}catch(e){try{tx.abort();}catch{}await done.catch(()=>{});throw e;}
 }
 const getMeta=(s,key)=>request(s('meta').get(key)).then(r=>r?.value);
 const putMeta=(s,key,value)=>request(s('meta').put({key,value}));
 async function read(){return transaction(stores,'readonly',async s=>{
  const facts=(await request(s('facts').getAll())).map(r=>r.event),checkpoints=await request(s('checkpoints').getAll());
  validateFacts(facts);for(const cp of checkpoints)validateCheckpoint(cp.key,cp.value);
  const selected=new Map();for(const cp of checkpoints){const prior=selected.get(cp.key);if(!prior||cp.at>prior.at||cp.at===prior.at&&cp.id>prior.id)selected.set(cp.key,cp);}
  return {facts:mergeEvents(facts),checkpoints,events:mergeEvents(facts,[...selected.values()].map(checkpointEvent)),outbox:await request(s('outbox').getAll()),settings:await getMeta(s,'settings')||{},owner:await getMeta(s,'owner'),cursor:await getMeta(s,'cursor')||0,conflicts:await request(s('conflicts').getAll()),clockIssue};
 });}
 async function commit({events=[],checkpoint,settings,expectedLocalRevision}={},fail=false){
  const now=safeNow();
  validateFacts(events);if(checkpoint)validateCheckpoint(checkpoint.key,checkpoint.value);
  if(settings)for(const [k,v]of Object.entries(settings))if(!validateSetting(k,v))throw Error('INVALID_SETTING');
  return transaction(stores,'readwrite',async(s,tx)=>{
   let ordinal=await getMeta(s,'ordinal')||0,lastAt=await getMeta(s,'lastAt')||0;
   const device=await getMeta(s,'device')||newId();await putMeta(s,'device',device);
   const order=(await getMeta(s,'operationOrder')||0)+1;await putMeta(s,'operationOrder',order);
   const op={id:newId(),v:PROTOCOL,events:[],createdAt:Date.now(),order};
   for(const original of events){
    const prior=await request(s('facts').get(original.id));if(prior){assertSame(prior.event,original.version?original:{...original,version:3,contentVersion:CONTENT_VERSION,schedulerVersion:SCHEDULER_VERSION,imported:true});continue;}
    // Imports keep original time and identity; missing observations remain unknown.
    const event=original.version?original:{...original,version:3,contentVersion:CONTENT_VERSION,schedulerVersion:SCHEDULER_VERSION,imported:true};
    await request(s('facts').add({id:event.id,event,seq:null}));op.events.push(event);
   }
   if(checkpoint){
    const old=await request(s('checkpoints').get(checkpoint.value.id));
    if(old&&expectedLocalRevision!==old.localRevision)throw Error('LOCAL_WRITER_CONFLICT');
    const cp={id:checkpoint.value.id,key:checkpoint.key,value:structuredClone(checkpoint.value),at:Math.max(now,lastAt+1),writer:device,revision:old?.revision||0,localRevision:(old?.localRevision||0)+1,pending:op.id};
    op.checkpoint={...cp,baseRevision:old?.revision||0,baseOperation:old?.pending||null};
    await request(s('checkpoints').put(cp));
   }
   if(settings){const old=await getMeta(s,'settings')||{};op.settings={};for(const [k,v]of Object.entries(settings)){const prev=old[k];op.settings[k]={value:v,baseRevision:prev?.revision||0,baseOperation:prev?.pending||null};old[k]={value:v,revision:prev?.revision||0,pending:op.id};}await putMeta(s,'settings',old);}
   await putMeta(s,'ordinal',ordinal);await putMeta(s,'lastAt',Math.max(lastAt,now));
   if(op.events.length||checkpoint||settings)await request(s('outbox').add(op));
   if(fail)tx.abort();return op;
  });
 }
 async function makeEvent(kind,key,value,extra={}){return transaction(['meta','facts'],'readwrite',async s=>{
  const device=await getMeta(s,'device')||newId(),ordinal=(await getMeta(s,'ordinal')||0)+1,rawAt=safeNow(),at=Math.max(rawAt,(await getMeta(s,'lastAt')||0)+1);
  await putMeta(s,'device',device);await putMeta(s,'ordinal',ordinal);await putMeta(s,'lastAt',at);
  const previous=['favorite','mastered'].includes(kind)?flagHeads((await request(s('facts').getAll())).map(r=>r.event),kind,key).map(e=>e.id):undefined;
  return {id:newId(),device,kind,key,value:structuredClone(value),at,rawAt,ordinal,version:3,contentVersion:CONTENT_VERSION,schedulerVersion:SCHEDULER_VERSION,...(previous?{previous}:{}),...extra,...(extra.attemptId?{attemptId:extra.attemptId+':'+device}:{})};
 });}
 async function migrate(legacy,preferences={}){
  if(!Array.isArray(legacy)||legacy.some(e=>!validEvent(e)))throw Error('INVALID_LEGACY');
  if(await transaction(['meta'],'readonly',s=>getMeta(s,'migrated')))return;
  const facts=legacy.filter(e=>e.kind!=='session').sort((a,b)=>Number(a.kind==='undo')-Number(b.kind==='undo')),latest=new Map();validateFacts(facts);const targets=new Map(facts.map(e=>[e.id,e]));for(const e of facts)if(e.kind==='undo'&&(!targets.has(e.value.id)||targets.get(e.value.id).kind==='undo'||targets.get(e.value.id).key!==e.key))throw Error('INVALID_UNDO_REFERENCE');
  for(const e of mergeEvents(legacy))if(e.kind==='session')latest.set(e.key,{key:e.key,value:{...e.value,id:e.value.id||e.id}});
  // One transaction owns the import marker, source copy, facts, checkpoints, and outbox.
  return transaction(stores,'readwrite',async s=>{
   if(await getMeta(s,'migrated'))return;
   await putMeta(s,'legacyOriginal',structuredClone(legacy));
   for(const e of facts){await request(s('facts').put({id:e.id,event:{...e,version:3,contentVersion:CONTENT_VERSION,schedulerVersion:SCHEDULER_VERSION,imported:true},seq:null}));}
   for(let i=0;i<facts.length;i+=50)await request(s('outbox').add({id:newId(),v:3,order:i+1,events:facts.slice(i,i+50).map(e=>({...e,version:3,contentVersion:CONTENT_VERSION,schedulerVersion:SCHEDULER_VERSION,imported:true})),createdAt:Date.now()}));
   for(const cp of latest.values()){const op={id:newId(),v:3,order:facts.length+latest.size,events:[],createdAt:Date.now()};const value={id:cp.value.id,...cp,at:Date.now(),writer:'legacy',revision:0,localRevision:1,pending:op.id};await request(s('checkpoints').put(value));op.checkpoint={...value,baseRevision:0,baseOperation:null};await request(s('outbox').add(op));}
   const settings={};for(const [k,v] of Object.entries(preferences))if(validateSetting(k,v))settings[k]={value:v,revision:0};await putMeta(s,'settings',settings);await putMeta(s,'operationOrder',facts.length+latest.size+1);await putMeta(s,'migrated',true);
  });
 }
 async function bindOwner(owner){return transaction(['meta'],'readwrite',async s=>{const old=await getMeta(s,'owner');if(old&&old!==owner)throw Error('ACCOUNT_MISMATCH');await putMeta(s,'owner',owner);});}
 async function prepareSettings(remote){return transaction(['meta','outbox'],'readwrite',async s=>{
  const current=await getMeta(s,'settings')||{},op={id:newId(),v:3,events:[],settings:{},order:(await getMeta(s,'operationOrder')||0)+1,createdAt:Date.now()};
  for(const[k,old]of Object.entries(current)){
   if(old.pending||old.revision>0)continue;
   if(remote[k]){if(!validateSetting(k,remote[k].value)||!Number.isSafeInteger(remote[k].revision)||remote[k].revision<1)throw Error('INVALID_PAGE');current[k]=remote[k];}
   else{op.settings[k]={value:old.value,baseRevision:0,baseOperation:null};current[k]={...old,pending:op.id};}
  }
  await putMeta(s,'settings',current);if(Object.keys(op.settings).length){await request(s('outbox').add(op));await putMeta(s,'operationOrder',op.order);}
 });}
 async function rawRecovery(){return transaction(stores,'readonly',async s=>{const rows={};for(const name of stores)rows[name]=await request(s(name).getAll());return rows;});}
 // A backup is one local transaction; the cloud still receives bounded operations.
 async function restore(events,settings={},fail=false){
  safeNow();
  const facts=events.filter(e=>e.kind!=='session').sort((a,b)=>Number(a.kind==='undo')-Number(b.kind==='undo'));validateFacts(facts);
  const checkpoints=events.filter(e=>e.kind==='session').map(e=>({key:e.key,value:{...e.value,id:e.value.id||e.id}}));
  for(const cp of checkpoints)validateCheckpoint(cp.key,cp.value);
  const values={};for(const[k,row]of Object.entries(settings)){const value=row&&typeof row==='object'&&Object.hasOwn(row,'value')?row.value:row;if(!validateSetting(k,value))throw Error('INVALID_SETTING');values[k]=value;}
  return transaction(stores,'readwrite',async(s,tx)=>{
   let order=await getMeta(s,'operationOrder')||0;const fresh=[],targets=new Map([...(await request(s('facts').getAll())).map(r=>r.event),...facts].map(e=>[e.id,e]));for(const e of facts)if(e.kind==='undo'&&(!targets.has(e.value.id)||targets.get(e.value.id).kind==='undo'||targets.get(e.value.id).key!==e.key))throw Error('INVALID_UNDO_REFERENCE');
   for(const original of facts){const event=original.version?original:{...original,version:3,contentVersion:CONTENT_VERSION,schedulerVersion:SCHEDULER_VERSION,imported:true},old=await request(s('facts').get(event.id));if(old)assertSame(old.event,event);else{fresh.push(event);await request(s('facts').add({id:event.id,event,seq:null}));}}
   for(let i=0;i<fresh.length;i+=50)await request(s('outbox').add({id:newId(),v:3,order:++order,events:fresh.slice(i,i+50),createdAt:Date.now()}));
   let at=await getMeta(s,'lastAt')||0;
   for(const cp of checkpoints){const old=await request(s('checkpoints').get(cp.value.id));if(old){if(old.key!==cp.key)throw Error('ID_CONTENT_CONFLICT');continue;}const op={id:newId(),v:3,events:[],order:++order,createdAt:Date.now()},row={id:cp.value.id,...cp,at:Math.max(Date.now(),at+1),writer:'backup',revision:0,localRevision:1,pending:op.id};at=row.at;op.checkpoint={...row,baseRevision:0,baseOperation:null};await request(s('checkpoints').add(row));await request(s('outbox').add(op));}
   if(Object.keys(values).length){const current=await getMeta(s,'settings')||{},op={id:newId(),v:3,events:[],order:++order,createdAt:Date.now(),settings:{}};for(const[k,value]of Object.entries(values)){const old=current[k];op.settings[k]={value,baseRevision:old?.revision||0,baseOperation:old?.pending||null};current[k]={value,revision:old?.revision||0,pending:op.id};}await putMeta(s,'settings',current);await request(s('outbox').add(op));}
   await putMeta(s,'operationOrder',order);await putMeta(s,'lastAt',at);if(fail)tx.abort();
  });
 }
 async function resolveConflict(id,choice){
  safeNow();
  if(!['cloud','local'].includes(choice))throw Error('INVALID_CHOICE');
  return transaction(stores,'readwrite',async s=>{
   const conflict=await request(s('conflicts').get(id));if(!conflict)throw Error('MISSING_CONFLICT');
   const op={id:newId(),v:3,events:[],order:(await getMeta(s,'operationOrder')||0)+1,createdAt:Date.now()};
   if(conflict.type==='checkpoint'){
    const old=await request(s('checkpoints').get(conflict.proposal.id));if(!old||old.pending!==conflict.id)throw Error('CONFLICT_HAS_NEWER_LOCAL_CHANGES');
    if(choice==='cloud'){if(!conflict.remote)throw Error('CLOUD_CHECKPOINT_NOT_RECEIVED');validateCheckpoint(conflict.remote.key,conflict.remote.value);await request(s('checkpoints').put({...conflict.remote,localRevision:old.localRevision+1,pending:null}));}
    else{const fork={...old,id:newId(),value:{...old.value},at:Math.max(Date.now(),old.at+1),revision:0,localRevision:1,pending:op.id};fork.value.id=fork.id;op.checkpoint={...fork,baseRevision:0,baseOperation:null};await request(s('checkpoints').delete(old.id));await request(s('checkpoints').add(fork));}
   }else{
    const current=await getMeta(s,'settings')||{},field=conflict.field,old=current[field];if(old?.pending!==conflict.operationId)throw Error('CONFLICT_HAS_NEWER_LOCAL_CHANGES');
    if(choice==='cloud')current[field]=conflict.cloud.current;else{op.settings={[field]:{value:old.value,baseRevision:conflict.cloud.current?.revision||0,baseOperation:null}};current[field]={value:old.value,revision:conflict.cloud.current?.revision||0,pending:op.id};}await putMeta(s,'settings',current);
   }
   for(const row of await request(s('conflicts').getAll()))if(conflict.type===row.type&&(row.type==='checkpoint'?row.proposal.id===conflict.proposal.id:row.field===conflict.field))await request(s('conflicts').delete(row.id));if(op.checkpoint||op.settings){await request(s('outbox').add(op));await putMeta(s,'operationOrder',op.order);}return choice;
  });
 }
 async function acknowledge(op,receipt){return transaction(stores,'readwrite',async s=>{
  const pending=await request(s('outbox').get(op.id));if(!pending)return;assertSame(pending,op);
  if(receipt.operationId!==op.id||receipt.v!==3)throw Error('INVALID_RECEIPT');
  if(op.checkpoint&&(!receipt.checkpoint||receipt.checkpoint.id!==op.checkpoint.id||typeof receipt.checkpoint.conflict!=='boolean'||!Number.isSafeInteger(receipt.checkpoint.revision)||receipt.checkpoint.revision<0))throw Error('INVALID_RECEIPT');
  for(const e of op.events){const row=await request(s('facts').get(e.id));if(row){row.seq=receipt.eventSeqs[e.id];if(!Number.isSafeInteger(row.seq)||row.seq<1)throw Error('INVALID_RECEIPT');await request(s('facts').put(row));}}
  if(op.checkpoint){const cp=await request(s('checkpoints').get(op.checkpoint.id));if(receipt.checkpoint?.conflict){await request(s('conflicts').put({id:op.id,type:'checkpoint',proposal:op.checkpoint,cloud:receipt.checkpoint}));}else if(cp){cp.revision=receipt.checkpoint.revision;if(cp.pending===op.id)cp.pending=null;await request(s('checkpoints').put(cp));}}
  if(op.settings){const current=await getMeta(s,'settings')||{};for(const k of Object.keys(op.settings)){const result=receipt.settings[k];if(result.conflict)await request(s('conflicts').put({id:op.id+'-'+k,operationId:op.id,type:'setting',field:k,proposal:op.settings[k],cloud:result}));else{current[k].revision=result.revision;if(current[k].pending===op.id)current[k].pending=null;}}await putMeta(s,'settings',current);}
  await request(s('outbox').delete(op.id));
 });}
 async function receive(page){return transaction(stores,'readwrite',async s=>{
  const cursor=await getMeta(s,'cursor')||0;if(page.v!==3||!Array.isArray(page.events)||!Number.isSafeInteger(page.watermark)||page.watermark<cursor||!Number.isSafeInteger(page.nextCursor)||page.nextCursor<cursor||page.nextCursor>page.watermark)throw Error('INVALID_PAGE');
  validateFacts(page.events.map(row=>row.event));if(page.events.length!==page.nextCursor-cursor||page.events.some((row,i)=>row.seq!==cursor+i+1))throw Error('INVALID_PAGE');
  for(const row of page.events){if(row.seq<=cursor||row.seq>page.nextCursor||!validEvent(row.event))throw Error('INVALID_PAGE');const old=await request(s('facts').get(row.event.id));if(old)assertSame(old.event,row.event);await request(s('facts').put({id:row.event.id,event:row.event,seq:row.seq}));}
  for(const cp of page.checkpoints||[]){validateCheckpoint(cp.key,cp.value);if(cp.id!==cp.value.id||!Number.isSafeInteger(cp.revision)||cp.revision<1||!Number.isFinite(cp.at)||cp.at<=0||cp.at>Date.now()+86400000)throw Error('INVALID_PAGE');const old=await request(s('checkpoints').get(cp.id));if(old?.pending)for(const row of await request(s('conflicts').getAll()))if(row.type==='checkpoint'&&row.proposal.id===cp.id){row.remote=cp;await request(s('conflicts').put(row));}if(!old?.pending&&(!old||cp.revision>old.revision))await request(s('checkpoints').put({...cp,localRevision:(old?.localRevision||0)+1,pending:null}));}
  const settings=await getMeta(s,'settings')||{};for(const[k,v]of Object.entries(page.settings||{})){if(!validateSetting(k,v.value)||!Number.isSafeInteger(v.revision)||v.revision<1)throw Error('INVALID_PAGE');if(!settings[k]?.pending)settings[k]=v;}await putMeta(s,'settings',settings);
  await putMeta(s,'cursor',page.nextCursor);await putMeta(s,'watermark',page.watermark);
 });}
 async function snapshot(){const state=await read();return transaction(['snapshots'],'readwrite',async s=>{const all=await request(s('snapshots').getAll());const row={id:Date.now().toString(),schema:3,events:state.events,settings:state.settings,exportedAt:new Date().toISOString()};await request(s('snapshots').put(row));for(const old of all.sort((a,b)=>b.id.localeCompare(a.id)).slice(4))await request(s('snapshots').delete(old.id));return row;});}
 return {db,read,commit,makeEvent,migrate,bindOwner,prepareSettings,rawRecovery,restore,resolveConflict,acknowledge,receive,snapshot,observeServerClock,transaction,close:()=>db.close()};
}
