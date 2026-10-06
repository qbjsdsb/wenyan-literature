import {createClient} from '@supabase/supabase-js';
import {canApprove,safeConsentRedirect} from '../src/mcp/consent-policy.js';
const status=document.querySelector('#status'),approve=document.querySelector('#approve'),deny=document.querySelector('#deny');
const id=new URL(location.href).searchParams.get('authorization_id');
const url=import.meta.env.VITE_SUPABASE_URL,key=import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
let cloud,policy;
const unwrap=({data,error})=>{if(error)throw Error('AUTHORIZATION_UNAVAILABLE');return data;};
const redirect=data=>location.assign(safeConsentRedirect(data.redirect_url,policy.redirectUri));
async function start(){
 if(!id||!/^[a-zA-Z0-9_-]{8,100}$/.test(id)){status.textContent='缺少有效授权请求。请从 ChatGPT 重新开始连接。';return;}
 if(!url||!key){status.textContent='此部署尚未配置云连接。';return;}
 cloud=createClient(url,key,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:false,storageKey:'wenyan-auth-v1'}});
 const {data,error}=await cloud.auth.getUser();if(error||!data.user){status.textContent='请先返回文研登录本人学习账户，再从 ChatGPT 重新开始连接。';return;}
 policy=unwrap(await cloud.rpc('wenyan_oauth_policy',{p_client_id:null}));
 if(!policy?.enabled){status.textContent='个人只读连接尚未开放。授权准备完成后，请从 ChatGPT 重试。';return;}
 const details=unwrap(await cloud.auth.oauth.getAuthorizationDetails(id));
 // Supabase may return an existing grant's redirect. No new consent is clicked.
 if(details.redirect_url){redirect(details);return;}
 document.querySelector('#client').textContent='请求连接的应用：'+details.client.name;
 policy=unwrap(await cloud.rpc('wenyan_oauth_policy',{p_client_id:details.client.id}));
 deny.disabled=false;
 if(!canApprove(details,policy)){status.textContent='该应用、权限或回调地址未经批准。请拒绝并重新检查连接配置。';return;}
 status.textContent='仅允许预先批准的个人应用读取已提交记录。';approve.disabled=false;
}
async function decide(allowed){approve.disabled=true;deny.disabled=true;try{
 policy=unwrap(await cloud.rpc('wenyan_oauth_policy',{p_client_id:policy.clientId}));
 if(allowed&&!policy.allowed)throw Error('AUTHORIZATION_DISABLED');
 const data=unwrap(await cloud.auth.oauth[allowed?'approveAuthorization':'denyAuthorization'](id,{skipBrowserRedirect:true}));redirect(data);
 }catch{status.textContent='授权未完成。请从 ChatGPT 重新开始；不要在聊天中提供密码或验证码。';}}
approve.addEventListener('click',()=>decide(true));deny.addEventListener('click',()=>decide(false));
start().catch(()=>{status.textContent='无法核验此授权请求。请从 ChatGPT 重新开始连接。';});
