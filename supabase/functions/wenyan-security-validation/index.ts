// Temporary, owner-only acceptance probe. Disable after validation. It never
// returns credentials or writes learning facts. Admin key stays inside Edge.
import {createClient} from 'npm:@supabase/supabase-js@2.117.2';
const allowedOrigin='https://qbjsdsb.github.io';
const cors={'Access-Control-Allow-Origin':allowedOrigin,'Access-Control-Allow-Headers':'authorization,apikey,content-type,x-client-info','Access-Control-Allow-Methods':'POST,OPTIONS'};
const json=(data:unknown,status=200)=>new Response(JSON.stringify(data),{status,headers:{...cors,'Content-Type':'application/json','Cache-Control':'no-store'}});
const url=Deno.env.get('SUPABASE_URL')!,anon=Deno.env.get('SUPABASE_ANON_KEY')!;
const options={auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}};
let running=false;
Deno.serve(async(req:Request)=>{
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers:cors});
 if(req.method!=='POST')return json({error:'METHOD_NOT_ALLOWED'},405);
 const origin=req.headers.get('Origin');if(origin&&origin!==allowedOrigin)return json({error:'ORIGIN_DENIED'},403);
 const authorization=req.headers.get('Authorization');if(!authorization?.startsWith('Bearer '))return json({error:'AUTH_REQUIRED'},401);
 const caller=createClient(url,anon,{...options,global:{headers:{Authorization:authorization}}});
 const identity=await caller.auth.getUser(authorization.slice(7));
 if(identity.error||!identity.data.user)return json({error:'AUTH_REQUIRED'},401);
 const claims=await caller.auth.getClaims(authorization.slice(7));
 if(claims.error||claims.data?.claims.aud!=='authenticated'||claims.data?.claims.client_id)return json({error:'FIRST_PARTY_REQUIRED'},403);
 // The guarded RPC proves both the single owner and live session, not merely
 // a valid JWT. No admin client exists before this boundary has succeeded.
 const proof=await caller.rpc('wenyan_pull',{p_cursor:0,p_high:null,p_limit:1});
 if(proof.error)return json({error:'OWNER_REQUIRED'},403);
 if(running)return json({error:'BUSY'},409);running=true;
 const admin=createClient(url,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,options);
 let fixtureId:string|undefined,cleanup=false;const results:Record<string,boolean>={};
 try{
  const password=crypto.randomUUID()+crypto.randomUUID();
  const created=await admin.auth.admin.createUser({email:'wenyan-denial-'+crypto.randomUUID()+'@example.invalid',password,email_confirm:true,app_metadata:{wenyan_disposable_validation:true}});
  if(created.error||!created.data.user)throw Error('FIXTURE_CREATION_FAILED');fixtureId=created.data.user.id;
  const fixture=createClient(url,anon,options);
  const login=await fixture.auth.signInWithPassword({email:created.data.user.email!,password});
  if(login.error||!login.data.session)throw Error('FIXTURE_LOGIN_FAILED');results.realSecondUserLogin=true;
  const pull=await fixture.rpc('wenyan_pull',{p_cursor:0,p_high:null,p_limit:1});
  results.secondUserPullDenied=pull.error?.message==='FORBIDDEN';
  const commit=await fixture.rpc('wenyan_commit',{p_op:{id:crypto.randomUUID(),v:3,events:[]}});
  results.secondUserCommitDenied=commit.error?.message==='FORBIDDEN';
  results.privateDataApiDenied=Boolean((await fixture.schema('wenyan_private').from('study_events').select('id').limit(1)).error);
  results.publicDataApiDenied=Boolean((await fixture.from('study_events').select('id').limit(1)).error);
  await fixture.auth.signOut();
  results.ownerStillAuthorized=!(await caller.rpc('wenyan_pull',{p_cursor:0,p_high:null,p_limit:1})).error;
 }catch(error){return json({error:error instanceof Error?error.message:'VALIDATION_FAILED',results},500);}
 finally{
  if(fixtureId)cleanup=!(await admin.auth.admin.deleteUser(fixtureId)).error;
  running=false;
 }
 return json({results,fixtureRemoved:cleanup,passed:cleanup&&Object.values(results).every(Boolean)});
});
