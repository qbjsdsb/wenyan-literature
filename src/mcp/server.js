import {McpServer} from '@modelcontextprotocol/sdk/server/mcp.js';
import {WebStandardStreamableHTTPServerTransport} from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import {createRemoteJWKSet,jwtVerify} from 'jose';
import {z} from 'zod';
import {learningTool,TOOL_NAMES} from './tools.js';
import {validateFacts} from '../cloud/protocol.js';
const descriptions={get_learning_overview:'Read committed learning overview and today counts. Offline device history is unknown. Never infer mastery from a single answer.',get_review_pressure:'Read due counts and bounded recent review evidence. Observations are not proof of cause.',get_problem_words:'Read words with at least two recent failed or hinted recalls; include sample and evidence.',get_word_history:'Read bounded history for one stable word ID, including Undo and unknown first results. No learning is written.',preview_study_session:'Preview a short study plan or an unfinished session. Does not create a session or change FSRS.'};
const days=z.number().int().min(1).max(90).default(7),limit=z.number().int().min(1).max(30).default(10);
const schemas={get_learning_overview:z.object({}).strict(),get_review_pressure:z.object({days}).strict(),get_problem_words:z.object({days,limit}).strict(),get_word_history:z.object({word_id:z.string().min(1).max(80).regex(/^[\p{L}\p{N}' -]+$/u),limit:limit.default(30)}).strict(),preview_study_session:z.object({minutes:z.number().int().min(5).max(60).default(15)}).strict()};
export async function verifyAccessToken(token,key,issuer,resource){return (await jwtVerify(token,key,{issuer,audience:resource,algorithms:['ES256','RS256'],requiredClaims:['exp','sub','aud','iss','session_id','client_id']})).payload;}
export async function readCommittedSnapshot(pull,maxFacts=10000){
 let cursor=0,first,events=[];
 for(let pageCount=0;pageCount<25;pageCount++){
  const page=await pull(cursor,first?.watermark??null);if(page.v!==3||!Number.isSafeInteger(page.watermark)||!Number.isSafeInteger(page.nextCursor)||page.nextCursor<cursor||page.nextCursor>page.watermark||!Array.isArray(page.events))throw Error('INVALID_CLOUD_PAGE');
  first??=page;if(page.watermark!==first.watermark||page.events.length!==page.nextCursor-cursor||page.events.some((r,i)=>r.seq!==cursor+i+1))throw Error('INVALID_CLOUD_WATERMARK');
  events.push(...page.events.map(row=>row.event));validateFacts(events);
  if(events.length>maxFacts)return {...first,events:[],complete:false};
  if(page.nextCursor===first.watermark)return {...first,events,complete:true};
  if(page.nextCursor<=cursor)throw Error('NON_PROGRESSING_PAGE');cursor=page.nextCursor;
 }
 return {...first,events:[],complete:false};
}
export function createMcpHandler({supabaseUrl,publishableKey,resource,website,catalog,verify,fetcher=fetch}){
 const issuer=supabaseUrl+'/auth/v1',metadataUrl=resource+'/.well-known/oauth-protected-resource',jwks=createRemoteJWKSet(new URL(issuer+'/.well-known/jwks.json'));
 const challenge={'WWW-Authenticate':`Bearer resource_metadata="${metadataUrl}"`,'Cache-Control':'no-store'};
 const json=(value,status=200,headers={})=>Response.json(value,{status,headers:{'Cache-Control':'no-store',...headers}});
 return async request=>{
  const url=new URL(request.url);
  if(url.origin!==new URL(resource).origin)return json({error:'invalid_host'},403);
  if(url.pathname===new URL(metadataUrl).pathname&&request.method==='GET')return json({resource,authorization_servers:[issuer],scopes_supported:['openid'],bearer_methods_supported:['header'],resource_name:'Wenyan read-only learning'});
  if(url.pathname!==new URL(resource).pathname||url.search)return json({error:'not_found'},404);
  const origin=request.headers.get('Origin');if(origin&&![new URL(website).origin,'https://chatgpt.com'].includes(origin))return json({error:'invalid_origin'},403);
  if(request.method!=='POST')return json({error:'method_not_allowed'},405,{Allow:'POST'});
  const header=request.headers.get('Authorization')||'';if(!/^Bearer [^ ]{1,8192}$/.test(header))return json({error:'unauthorized'},401,challenge);
  const token=header.slice(7);let claims;
  try{claims=verify?await verify(token):await verifyAccessToken(token,jwks,issuer,resource);
   if(claims.iss!==issuer||claims.aud!==resource||claims.exp*1000<=Date.now()||typeof claims.sub!=='string'||typeof claims.client_id!=='string'||!claims.client_id||typeof claims.session_id!=='string'||claims.is_anonymous===true||claims.role!=='authenticated')throw Error('INVALID_AUTH');
  }catch{return json({error:'unauthorized'},401,challenge);}
  const pull=async(cursor,high)=>{
   const response=await fetcher(supabaseUrl+'/rest/v1/rpc/wenyan_pull',{method:'POST',headers:{apikey:publishableKey,Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify({p_cursor:cursor,p_high:high,p_limit:500})});
   if(!response.ok)throw Error(response.status===401||response.status===403?'NOT_AUTHORIZED':'CLOUD_UNAVAILABLE');return response.json();
  };
  // The actual owner/live session/approved client is checked by the narrow RPC
  // for every request, even tools/list and initialize. No service_role client.
  try{await pull(0,null);}catch(error){return json({error:error.message==='NOT_AUTHORIZED'?'forbidden':'cloud_unavailable'},error.message==='NOT_AUTHORIZED'?403:503);}
  if(Number(request.headers.get('Content-Length')||0)>16384)return json({error:'request_too_large'},413);
  let body;try{const raw=await request.text();if(raw.length>16384)return json({error:'request_too_large'},413);body=JSON.parse(raw);}catch{return json({error:'invalid_json'},400);}
  const server=new McpServer({name:'Wenyan',version:'0.1.0'});
  let snapshot;
  for(const name of TOOL_NAMES)server.registerTool(name,{description:descriptions[name],inputSchema:schemas[name],annotations:{readOnlyHint:true,destructiveHint:false,idempotentHint:true,openWorldHint:false},_meta:{securitySchemes:[{type:'oauth2',scopes:['openid']}] }},async args=>{
   try{snapshot??=await readCommittedSnapshot(pull);const data=learningTool(name,args,snapshot,catalog);return {content:[{type:'text',text:JSON.stringify(data)}],structuredContent:data};
   catch{return {isError:true,content:[{type:'text',text:'Committed learning data is unavailable. Do not infer history or mastery.'}]};}
  });
  const transport=new WebStandardStreamableHTTPServerTransport({sessionIdGenerator:undefined,enableJsonResponse:true});
  try{await server.connect(transport);const response=await transport.handleRequest(request,{parsedBody:body});response.headers.set('Cache-Control','no-store');return response;}finally{await server.close();}
 };
}
