// Actual hosted HTTP preflight, with only the public browser key. No owner
// credentials, created test users, learning writes, or service-role tokens.
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
const example=Object.fromEntries((await readFile('.env.example','utf8')).split('\n').filter(l=>l.startsWith('VITE_')).map(l=>{const i=l.indexOf('=');return[l.slice(0,i),l.slice(i+1).trim()];}));
const url=process.env.VITE_SUPABASE_URL||example.VITE_SUPABASE_URL,key=process.env.VITE_SUPABASE_PUBLISHABLE_KEY||example.VITE_SUPABASE_PUBLISHABLE_KEY;
assert.ok(url.startsWith('https://')&&key.startsWith('sb_publishable_'));
const results=[];
async function denied(name,path,{body,headers={},statuses,codes}={}){
 const response=await fetch(url+'/rest/v1/'+path,{method:body?'POST':'GET',headers:{apikey:key,Authorization:'Bearer '+key,...(body?{'Content-Type':'application/json'}:{}),...headers},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(15000)});
 const result=await response.json();assert.ok(statuses.includes(response.status),name+': unexpected HTTP '+response.status);assert.ok(codes.includes(result.code),name+': unexpected denial '+result.code);results.push({name,status:response.status,code:result.code});
}
await denied('anonymous pull','rpc/wenyan_pull',{body:{p_cursor:0,p_high:null,p_limit:1},statuses:[401,403],codes:['42501']});
await denied('anonymous commit','rpc/wenyan_commit',{body:{p_op:{id:randomUUID(),v:3,events:[]}},statuses:[401,403],codes:['42501']});
await denied('private schema Data API','study_events?select=id&limit=1',{headers:{'Accept-Profile':'wenyan_private'},statuses:[406],codes:['PGRST106']});
await denied('no public fact table','study_events?select=id&limit=1',{statuses:[404],codes:['PGRST205']});
const forged=[{alg:'HS256',typ:'JWT'},{sub:randomUUID(),role:'authenticated',aud:'authenticated',exp:Math.floor(Date.now()/1000)+60}].map(v=>Buffer.from(JSON.stringify(v)).toString('base64url')).join('.')+'.'+Buffer.alloc(32,1).toString('base64url');
await denied('forged bearer JWT','rpc/wenyan_pull',{body:{p_cursor:0,p_high:null,p_limit:1},headers:{Authorization:'Bearer '+forged},statuses:[401],codes:['PGRST301','PGRST303']});
await mkdir('browser-evidence',{recursive:true});await writeFile('browser-evidence/hosted-denial.json',JSON.stringify({project:new URL(url).hostname,checkedAt:new Date().toISOString(),ownerPositivePath:'not_verified',results},null,2));
console.log('Actual hosted anonymous/Data API/forged-JWT denial checks passed',results);
