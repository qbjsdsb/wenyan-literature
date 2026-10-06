-- Preparation only: does not enable OAuth, MCP or bind any client.
alter table wenyan_private.config add column mcp_redirect_uri text;
create function public.wenyan_oauth_policy(p_client_id text default null) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare c wenyan_private.config;
begin
 if not wenyan_private.authorized(true) then raise exception 'FORBIDDEN' using errcode='42501';end if;
 select * into c from wenyan_private.config where singleton;
 return jsonb_build_object('enabled',c.mcp_enabled and c.mcp_client_id is not null and c.mcp_redirect_uri is not null,
  'clientId',c.mcp_client_id,'resource',c.mcp_resource,'redirectUri',c.mcp_redirect_uri,
  'allowed',coalesce(c.mcp_enabled and p_client_id=c.mcp_client_id and c.mcp_redirect_uri is not null,false));
end $$;
revoke all on function public.wenyan_oauth_policy(text) from public,anon;
grant execute on function public.wenyan_oauth_policy(text) to authenticated;

-- Optional official Custom Access Token Hook if hosted resource→aud does not
-- meet our contract. Supabase Auth calls this; it never signs tokens itself.
-- Only supabase_auth_admin may call; activation is a separate Dashboard step.
create function public.wenyan_access_token_hook(event jsonb) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare claims jsonb:=event->'claims';client text;trusted_client text; c wenyan_private.config;
begin
 client:=nullif(claims->>'client_id','');trusted_client:=nullif(event->>'client_id','');
 if trusted_client is not null and trusted_client is distinct from client then
  raise exception 'CLIENT_CLAIM_MISMATCH' using errcode='42501';
 end if;
 if client is null then
  if coalesce(event->>'authentication_method','') like 'oauth_provider/%' then
   raise exception 'MISSING_OAUTH_CLIENT' using errcode='42501';
  end if;
  return jsonb_build_object('claims',claims);
 end if;
 select * into c from wenyan_private.config where singleton;
 if not c.mcp_enabled or c.mcp_client_id is distinct from client or c.mcp_resource is null
   or claims->>'sub' is distinct from c.owner_id::text or coalesce(claims->>'is_anonymous','false')<>'false' then
  raise exception 'OAUTH_NOT_APPROVED' using errcode='42501';
 end if;
 return jsonb_build_object('claims',jsonb_set(claims,'{aud}',to_jsonb(c.mcp_resource)));
end $$;
revoke all on function public.wenyan_access_token_hook(jsonb) from public,anon,authenticated;
grant execute on function public.wenyan_access_token_hook(jsonb) to supabase_auth_admin;
