// Deliberate browser-only acceptance harness. Tokens stay inside the SDK; no
// credentials, user IDs or learning content appear in its DOM/logs/downloads.
import {createClient} from '@supabase/supabase-js';
import {openLocalDB} from '../src/cloud/local-db.js';
import {SyncEngine} from '../src/cloud/sync.js';
import {newId} from '../src/core.js';
import {canonical} from '../src/cloud/protocol.js';
const output=document.querySelector('#result'),button=document.querySelector('#run');
const client=createClient(import.meta.env.VITE_SUPABASE_URL,import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,{auth:{storageKey:'wenyan-auth-v1',persistSession:true,autoRefreshToken:true,detectSessionInUrl:false}});
const report=[];
const log=text=>{report.push(text);output.textContent=report.join('\n');};
function check(condition,label){if(!condition)throw Error(label);log('PASS '+label);}
async function rpc(name,args){const{data,error}=await client.rpc(name,args);if(error){const e=Error(error.code||'RPC_FAILED');e.code=error.code;e.reason=error.message;throw e;}return data;}
const transport={commit:op=>rpc('wenyan_commit',{p_op:op}),pull:(cursor,high)=>rpc('wenyan_pull',{p_cursor:cursor,p_high:high,p_limit:100})};
button.addEventListener('click',async()=>{
 button.disabled=true;report.length=0;output.textContent='运行中';let a,b,baseline,lastRevision,changed=false;
 try{
  const {data,error}=await client.auth.getUser();check(!error&&Boolean(data.user),'real owner Auth');
  baseline=await transport.pull(0,null);check(baseline.v===3,'authorized hosted pull');
  const original=baseline.settings.newWordLimit;if(!original)throw Error('MISSING_INITIAL_SETTINGS');
  a=await openLocalDB('wenyan-hosted-qa-a-'+newId());b=await openLocalDB('wenyan-hosted-qa-b-'+newId());
  for(const db of[a,b]){await db.migrate([]);await db.bindOwner(data.user.id);await new SyncEngine(db,transport).flush();}
  const initialA=await a.read(),initialB=await b.read();check(canonical(initialA.facts)===canonical(initialB.facts)&&initialA.cursor===initialB.cursor,'two isolated databases recover cloud watermark');
  const alternative=original.value===6?12:6,op=await a.commit({settings:{newWordLimit:alternative}});
  const receipt=await transport.commit(op);check(!receipt.settings.newWordLimit.conflict,'A setting commits to hosted cloud');changed=true;lastRevision=receipt.settings.newWordLimit.revision;
  check((await a.read()).outbox.length===1,'lost acknowledgement keeps durable outbox');
  const duplicate=await transport.commit(op);check(canonical(receipt)===canonical(duplicate),'duplicate request returns same hosted receipt');
  await new SyncEngine(a,transport).flush();check((await a.read()).outbox.length===0,'retry acknowledges outbox');
  await new SyncEngine(b,transport).flush();check((await b.read()).settings.newWordLimit.value===alternative,'B receives committed A setting');
  let rejected=false;try{await transport.commit({...op,settings:{newWordLimit:{value:24,baseRevision:original.revision}}});}catch(e){rejected=e.code==='P0001'&&e.reason==='OP_CONTENT_CONFLICT';}check(rejected,'same operation ID with altered payload rejected');
  const corrupt=await client.rpc('wenyan_commit',{p_op:{id:newId(),v:2,events:[]}});check(Boolean(corrupt.error),'old writer protocol rejected');
  const direct=await client.schema('wenyan_private').from('study_events').select('id').limit(1);check(Boolean(direct.error),'private Data API bypass denied');
  const publicDirect=await client.from('study_events').select('id').limit(1);check(Boolean(publicDirect.error),'public Data API bypass denied');
  const refreshed=await client.auth.refreshSession();check(!refreshed.error&&Boolean(refreshed.data.session),'real token refresh');
  const final=await transport.pull(0,null);check(final.watermark===baseline.watermark,'no synthetic learning history committed');
 }catch(error){log('FAIL '+(error.code||error.message||'UNKNOWN'));}
 finally{
  if(changed){try{
   const op={id:newId(),v:3,events:[],settings:{newWordLimit:{value:baseline.settings.newWordLimit.value,baseRevision:lastRevision,baseOperation:null}}};
   const receipt=await transport.commit(op);check(!receipt.settings.newWordLimit.conflict,'original setting restored with revision CAS');
   for(const db of[a,b])if(db)await new SyncEngine(db,transport).flush();
  }catch(error){log('RESTORE_REQUIRED '+(error.code||error.message));}}
  a?.close();b?.close();button.disabled=false;log('DONE');
 }
});
