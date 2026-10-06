import {mergeEvents,validEvent,newId} from './core.js';
import {openLocalDB} from './cloud/local-db.js';
const testScope=new URLSearchParams(location.search).get('test');
export const prefix=['1','visual','baseline','baseline-restore'].includes(testScope)?testScope==='1'?'wenyan-test:':testScope==='visual'?'wenyan-visual:':'wenyan-'+testScope+':':'';
export const local={getItem:k=>{try{return localStorage.getItem(prefix+k);}catch{return null;}},setItem:(k,v)=>localStorage.setItem(prefix+k,v),removeItem:k=>localStorage.removeItem(prefix+k)};
export const store={events:[],facts:[],checkpoints:[],outbox:[],settings:{},problem:'',rawRecords:local.getItem('wenyan-events-v2')||'',status:'local'};
export let database;
const revisions=new Map();
export async function refresh(){if(!database)return;Object.assign(store,await database.read());for(const cp of store.checkpoints)if(!revisions.has(cp.id))revisions.set(cp.id,cp.localRevision);}
export function adoptCheckpoint(id){const cp=store.checkpoints.find(c=>c.id===id);if(cp)revisions.set(id,cp.localRevision);}
export const ready=(async()=>{
 try{
  let legacy=store.rawRecords?JSON.parse(store.rawRecords):[];if(!Array.isArray(legacy)||legacy.some(e=>!validEvent(e)))throw Error('INVALID_LEGACY');
  // Preferences-only v1 checkpoints are recovered once, without destroying the source.
  for(const [key,storageKey]of [['english','wenyan-session'],['literature','wenyan-lit-session']]){if(!legacy.some(e=>e.kind==='session'&&e.key===key)){const raw=local.getItem(storageKey);if(raw){const value=JSON.parse(raw);if(value){const e={id:newId(),device:'legacy',kind:'session',key,at:Date.now(),value};if(!validEvent(e))throw Error('INVALID_LEGACY_SESSION');legacy.push(e);}}}}
  database=await openLocalDB(prefix+'wenyan-v3');await database.migrate(legacy,{newWordLimit:Number(local.getItem('wenyan-english-new-limit'))||12,layer:local.getItem('wenyan-english-layer-v1')||'core',timezone:Intl.DateTimeFormat().resolvedOptions().timeZone});await refresh();if(prefix)window.__wenyanTestClose=()=>database.close();
 }catch(e){store.problem='本机记录未能读取或初始化，请先导出备份；原数据未覆盖。';store.errorCode=e.message;}
})();
const channel=typeof BroadcastChannel==='function'?new BroadcastChannel(prefix+'wenyan-v3'):null;
channel?.unref?.();
channel?.addEventListener('message',async()=>{const known=new Map(revisions);await refresh();revisions.clear();for(const[k,v]of known)revisions.set(k,v);window.dispatchEvent(new Event('wenyan-remote'));});
let tail=Promise.resolve();
function write(fn){const job=tail.then(async()=>{await ready;if(store.problem||!database)throw Error(store.errorCode||'STORAGE_UNAVAILABLE');try{const value=await fn();await refresh();store.problem='';channel?.postMessage('commit');window.dispatchEvent(new Event('wenyan-change'));return value;}catch(e){store.errorCode=e.message;store.problem=e.message==='LOCAL_WRITER_CONFLICT'?'另一标签页更新了这组进度，请重新打开当前组。':'未能保存到本机，本次没有进入下一步，请导出备份后重试。';await refresh();window.dispatchEvent(new Event('wenyan-change'));throw e;}});tail=job.catch(()=>{});return job;}
export function createEvent(kind,key,value,extra={}){return database.makeEvent(kind,key,value,extra);}
export function commitLearning(events,checkpoint){return write(async()=>{const cp=checkpoint?{key:'english',value:checkpoint}:undefined;const op=await database.commit({events,checkpoint:cp,expectedLocalRevision:checkpoint?revisions.get(checkpoint.id):undefined});if(op.checkpoint)revisions.set(op.checkpoint.id,op.checkpoint.localRevision);return events.at(-1);});}
export function record(kind,key,value){return write(async()=>{
 if(kind==='session'){
  const old=store.checkpoints.find(cp=>cp.id===value.id),events=[];
  if(key==='english'&&value.current){const prior=old?.value.current||{};for(const field of ['firstCorrect','hinted'])if(value.current[field]!==undefined&&value.current[field]!==prior[field])events.push(await createEvent('attempt','word:'+value.queue[value.index],{field,value:value.current[field],sessionId:value.id,index:value.index,step:value.steps?.[value.index]||value.mode}));}
  const op=await database.commit({events,checkpoint:{key,value},expectedLocalRevision:revisions.get(value.id)});revisions.set(value.id,op.checkpoint.localRevision);return;
 }
 const event=await createEvent(kind,key,value);await database.commit({events:[event]});return event;
});}
export function save(events=store.events){return write(async()=>{
 const facts=events.filter(e=>e.kind!=='session');const known=new Set(store.facts.map(e=>e.id));
 const newFacts=facts.filter(e=>!known.has(e.id));for(let i=0;i<newFacts.length;i+=50)await database.commit({events:newFacts.slice(i,i+50)});
 for(const e of events.filter(e=>e.kind==='session')){const value={...e.value,id:e.value.id||e.id};const prior=store.checkpoints.find(c=>c.id===value.id);if(!prior||JSON.stringify(prior.value)!==JSON.stringify(value))await database.commit({checkpoint:{key:e.key,value},expectedLocalRevision:prior?.localRevision});}
 return true;
});}
export function setLearningSetting(field,value){return write(()=>database.commit({settings:{[field]:value}}));}
export async function localSnapshot(){await ready;return database.snapshot();}
