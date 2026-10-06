import test from 'node:test';import assert from 'node:assert/strict';
import {generateKeyPair,SignJWT} from 'jose';
import {createMcpHandler,verifyAccessToken,readCommittedSnapshot,normalizeSupabaseRequest} from '../src/mcp/server.js';
import {learningTool,TOOL_NAMES} from '../src/mcp/tools.js';
const now=Date.now(),supabaseUrl='https://project.example.test',resource=supabaseUrl+'/functions/v1/wenyan-mcp',issuer=supabaseUrl+'/auth/v1';
const claims={iss:issuer,aud:resource,sub:crypto.randomUUID(),session_id:crypto.randomUUID(),client_id:'approved-test-client',role:'authenticated',exp:Math.floor(now/1000)+60};
const event=(rating,extra={},at=now-1000)=>({id:crypto.randomUUID(),device:'fixture',key:'word:abandon',kind:'review',at,value:{rating,...extra}});
const catalog=[{id:'abandon',word:'abandon'},{id:'ability',word:'ability'}];
const snapshot=(events=[])=>({v:3,events,asOf:new Date(now).toISOString(),watermark:events.length,complete:true,settings:{timezone:{value:'Asia/Shanghai',revision:1}},checkpoints:[]});
test('all five tools explicitly handle cold start without invented history or timing',()=>{for(const name of TOOL_NAMES){const r=learningTool(name,{word_id:'abandon',minutes:15},snapshot(),catalog,now);assert.equal(r.metadata.sample.active_reviews,0);assert.equal(r.metadata.coverage.offline_devices,'unknown');assert.equal(r.metadata.timezone,'Asia/Shanghai');}assert.equal(learningTool('get_word_history',{word_id:'abandon'},snapshot(),catalog).card,null);});
test('hints, repeated failure, unknown first results and undo remain distinct; reducer parity is shared',()=>{
 const a=event(1,{hinted:true,firstCorrect:false},now-3000),b=event(1,{hinted:false,firstCorrect:false},now-2000),c=event(3,{},now-1000),undo={id:crypto.randomUUID(),device:'fixture',key:c.key,kind:'undo',at:now-500,value:{id:c.id}},s=snapshot([a,b,c,undo]);
 const problems=learningTool('get_problem_words',{},s,catalog,now);assert.equal(problems.words[0].again,2);assert.equal(problems.words[0].sample,2);
 const history=learningTool('get_word_history',{word_id:'abandon'},s,catalog,now);assert.equal(history.card.reps,2);assert.equal(history.history.find(e=>e.evidence_id===c.id).undone,true);assert.equal(history.history.find(e=>e.evidence_id===c.id).first_correct,null);
});
test('partial history refuses FSRS and mastery conclusions; preview never writes',()=>{const s={...snapshot(),complete:false};for(const name of TOOL_NAMES)assert(learningTool(name,{word_id:'abandon'},s,catalog).data_unavailable);const r=learningTool('preview_study_session',{minutes:15},snapshot(),catalog);assert.equal(r.writes,false);assert(r.time_estimate.includes('no measured timing'));});
test('JWT signature, algorithm, audience and expiration are verified with actual crypto',async()=>{
 const {privateKey,publicKey}=await generateKeyPair('ES256');
 const signed=async payload=>new SignJWT(payload).setProtectedHeader({alg:'ES256'}).sign(privateKey);
 const token=await signed(claims);assert.equal((await verifyAccessToken(token,publicKey,issuer,resource)).sub,claims.sub);
 await assert.rejects(verifyAccessToken(await signed({...claims,aud:'authenticated'}),publicKey,issuer,resource));
 await assert.rejects(verifyAccessToken(await signed({...claims,exp:1}),publicKey,issuer,resource));
 await assert.rejects(verifyAccessToken(token.slice(0,-10)+'AAAAAAAAAA',publicKey,issuer,resource));
 await assert.rejects(verifyAccessToken(await signed({...claims,client_id:undefined}),publicKey,issuer,resource));
});
const request=(method='initialize',params={protocolVersion:'2025-11-25',capabilities:{},clientInfo:{name:'fixture',version:'1'}},headers={})=>new Request(resource,{method:'POST',headers:{Authorization:'Bearer fixture','Content-Type':'application/json',Accept:'application/json, text/event-stream',...headers},body:JSON.stringify({jsonrpc:'2.0',id:1,method,params})});
test('real SDK initializes, lists exactly five read tools, and rejects unknown tools/extra owner arguments',async()=>{
 let calls=0;const h=createMcpHandler({supabaseUrl,publishableKey:'public-key',resource,website:'https://study.example.test',catalog,verify:async()=>claims,fetcher:async(url,opts)=>{calls++;assert.equal(url,supabaseUrl+'/rest/v1/rpc/wenyan_pull');assert.equal(opts.headers.Authorization,'Bearer fixture');return Response.json({...snapshot(),nextCursor:0});}});
 const init=await h(request());assert.equal(init.status,200);assert((await init.json()).result.serverInfo);
 const list=await h(request('tools/list',{}));assert.deepEqual((await list.json()).result.tools.map(t=>t.name),TOOL_NAMES);
 const call=await h(request('tools/call',{name:'get_word_history',arguments:{word_id:'abandon'}}));assert.equal((await call.json()).result.structuredContent.sample,0);
 const bad=await h(request('tools/call',{name:'get_word_history',arguments:{word_id:'abandon',owner:'other'}}));assert((await bad.json()).result.isError);
 const write=await h(request('tools/call',{name:'execute_sql',arguments:{sql:'delete'}}));const rejected=await write.json();assert(rejected.result?.isError===true||rejected.error?.code===-32602);assert(calls>0);
});
test('web token, anonymous, expired and revoked/other client requests fail before tools expose data',async()=>{
 for(const c of [{...claims,aud:'authenticated'},{...claims,client_id:''},{...claims,is_anonymous:true},{...claims,exp:1}]){let called=false;const h=createMcpHandler({supabaseUrl,publishableKey:'public',resource,website:'https://study.example.test',catalog,verify:async()=>c,fetcher:async()=>{called=true;return Response.json({});}});assert.equal((await h(request())).status,401);assert.equal(called,false);}
 const h=createMcpHandler({supabaseUrl,publishableKey:'public',resource,website:'https://study.example.test',catalog,verify:async()=>claims,fetcher:async()=>Response.json({code:'42501'},{status:403})});assert.equal((await h(request('tools/list',{}))).status,403);
 const noauth=await h(request('initialize',{}, {Authorization:''}));assert.equal(noauth.status,401);assert(noauth.headers.get('WWW-Authenticate').includes('resource_metadata'));
 const metadata=await h(new Request(resource+'/.well-known/oauth-protected-resource'));assert.equal((await metadata.json()).resource,resource);
 assert.equal((await h(request('tools/list',{}, {Origin:'https://evil.example'}))).status,403);
});
test('bounded committed pagination enforces fixed watermark, contiguity and safe budget',async()=>{
 const e=event(1);const good=await readCommittedSnapshot(async()=>({...snapshot([e]),events:[{event:e,seq:1}],nextCursor:1}));assert.equal(good.events[0].id,e.id);
 await assert.rejects(readCommittedSnapshot(async()=>({...snapshot(),watermark:2,nextCursor:1,events:[{event:e,seq:2}]})),/INVALID_CLOUD_WATERMARK/);
 const partial=await readCommittedSnapshot(async()=>({...snapshot([e]),events:[{event:e,seq:1}],nextCursor:1}),0);assert.equal(partial.complete,false);assert.deepEqual(partial.events,[]);
});

test('Edge proxy normalization restores only the fixed host/path without dropping origin or auth',()=>{
 const original=new Request('http://project.example.test/wenyan-mcp/.well-known/oauth-protected-resource',{headers:{Origin:'https://evil.example',Authorization:'Bearer fixture'}});
 const canonical=normalizeSupabaseRequest(original,supabaseUrl,'wenyan-mcp');assert.equal(canonical.url,resource+'/.well-known/oauth-protected-resource');assert.equal(canonical.headers.get('Origin'),'https://evil.example');assert.equal(canonical.headers.get('Authorization'),'Bearer fixture');
 for(const url of ['http://evil.example/wenyan-mcp','https://project.example.test/other-function']){const r=new Request(url);assert.equal(normalizeSupabaseRequest(r,supabaseUrl,'wenyan-mcp'),r);}
});
