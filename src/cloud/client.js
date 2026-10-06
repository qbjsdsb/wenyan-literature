import {createClient} from '@supabase/supabase-js';
import {database,ready,store,refresh,prefix} from '../storage.js';
import {SyncEngine} from './sync.js';
const url=import.meta.env?.VITE_SUPABASE_URL,key=import.meta.env?.VITE_SUPABASE_PUBLISHABLE_KEY;
export const configured=Boolean(url&&key&&!prefix);
export const cloud=configured?createClient(url,key,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true,storageKey:prefix+'wenyan-auth-v1'}}):null;
let engine,retryTimer,disposed=false;
function status(value,error){store.status=value;store.cloudError=error?.message||'';window.dispatchEvent(new Event('wenyan-cloud-status'));}
const unwrap=({data,error})=>{if(error){const e=Error(error.message);e.code=error.code;e.status=error.status;throw e;}return data;};
export async function syncNow(){if(!engine)return;try{await engine.flush();await refresh();window.dispatchEvent(new Event('wenyan-remote'));}catch{}finally{clearTimeout(retryTimer);if(engine&&!disposed&&store.status!=='auth')retryTimer=setTimeout(syncNow,store.status==='synced'?60000:engine.retryDelay());}}
export async function connect(){
 await ready;if(!cloud||!database||disposed)return;
 const {data,error}=await cloud.auth.getUser();if(error||!data.user){engine?.stop();engine=null;status('auth');return;}
 try{
  // Read authorization succeeds before this account can adopt an unbound local history.
  const first=unwrap(await cloud.rpc('wenyan_pull',{p_cursor:0,p_high:null,p_limit:1}));
  if(first.v!==3)throw Error('UNKNOWN_CLOUD_VERSION');await database.bindOwner(data.user.id);await database.prepareSettings(first.settings||{});
  engine?.stop();engine=new SyncEngine(database,{commit:async op=>unwrap(await cloud.rpc('wenyan_commit',{p_op:op})),pull:async(cursor,high)=>unwrap(await cloud.rpc('wenyan_pull',{p_cursor:cursor,p_high:high,p_limit:100}))},status);
  await syncNow();
 }catch(e){status(e.message==='ACCOUNT_MISMATCH'?'error':'auth',e);}
}
export async function login(email,password){if(!cloud)throw Error('CLOUD_NOT_CONFIGURED');unwrap(await cloud.auth.signInWithPassword({email,password}));await connect();}
export async function logout(){disposed=true;engine?.stop();engine=null;clearTimeout(retryTimer);unwrap(await cloud.auth.signOut({scope:'local'}));status('auth');disposed=false;}
export function cloudStatus(){return configured?store.status:'unconfigured';}
if(cloud){cloud.auth.onAuthStateChange((event)=>{if(['SIGNED_IN','TOKEN_REFRESHED'].includes(event))setTimeout(connect,0);else if(event==='SIGNED_OUT'){engine?.stop();engine=null;status('auth');}});
 window.addEventListener('online',()=>syncNow());window.addEventListener('offline',()=>status('offline'));
 window.addEventListener('focus',()=>syncNow());window.addEventListener('wenyan-change',()=>{clearTimeout(retryTimer);retryTimer=setTimeout(syncNow,300);});
 void connect();
}
