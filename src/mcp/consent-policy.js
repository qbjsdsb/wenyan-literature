export function canApprove(details,policy){
 return Boolean(policy?.enabled&&policy.allowed&&details?.client?.id===policy.clientId&&details.scope==='openid'&&details.redirect_uri===policy.redirectUri);
}
export function safeConsentRedirect(value,registered){
 const url=new URL(value),target=new URL(registered);
 if(url.protocol!=='https:'||url.username||url.password||url.hash||target.hash)throw Error('UNSAFE_REDIRECT');
 for(const key of ['code','state','error','error_description'])url.searchParams.delete(key);
 if(url.href!==target.href)throw Error('UNAPPROVED_REDIRECT');
 return value;
}
