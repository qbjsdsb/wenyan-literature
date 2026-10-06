-- Wenyan-only schema. Existing abandoned project tables are untouched.
create schema wenyan_private;
revoke all on schema wenyan_private from public, anon, authenticated;
create table wenyan_private.config (
 singleton boolean primary key default true check(singleton),
 owner_id uuid references auth.users(id),
 mcp_client_id text,
 mcp_resource text,
 mcp_enabled boolean not null default false
);
insert into wenyan_private.config(singleton) values(true);
create table wenyan_private.learner_settings (
 owner_id uuid primary key references auth.users(id),
 watermark bigint not null default 0 check(watermark>=0),
 fields jsonb not null default '{}'
);
create table wenyan_private.study_events (
 owner_id uuid not null references auth.users(id),
 id text not null,
 seq bigint not null check(seq>0),
 event jsonb not null,
 received_at timestamptz not null default clock_timestamp(),
 primary key(owner_id,id), unique(owner_id,seq)
);
create unique index wenyan_attempt_unique on wenyan_private.study_events(owner_id,(event->>'attemptId'))
 where event->>'kind' in ('review','typing') and event ? 'attemptId';
create table wenyan_private.study_sessions (
 owner_id uuid not null references auth.users(id),
 id text not null,
 key text not null check(key in ('english','literature')),
 value jsonb not null,
 revision bigint not null check(revision>0),
 writer text not null,
 at bigint not null,
 primary key(owner_id,id)
);
create table wenyan_private.sync_receipts (
 owner_id uuid not null references auth.users(id),
 id uuid not null,
 input jsonb not null,
 result jsonb not null,
 committed_at timestamptz not null default clock_timestamp(),
 primary key(owner_id,id)
);
create table wenyan_private.session_forks (
 owner_id uuid not null references auth.users(id),
 operation_id uuid not null,
 session_id text not null,
 proposal jsonb not null,
 cloud_revision bigint not null,
 primary key(owner_id,operation_id)
);
-- Strict live owner/session/client boundary shared by all RPCs.
create function wenyan_private.authorized(p_write boolean default false) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(
  select 1 from wenyan_private.config c
  join auth.sessions s on s.user_id=c.owner_id
  where c.singleton and c.owner_id=auth.uid()
    and s.id::text=auth.jwt()->>'session_id'
    and (s.not_after is null or s.not_after>now())
    and coalesce(auth.jwt()->>'is_anonymous','false')='false'
    and (
      (coalesce(auth.jwt()->>'client_id','')='' and auth.jwt()->>'aud'='authenticated')
      or (not p_write and c.mcp_enabled and c.mcp_client_id=auth.jwt()->>'client_id'
          and c.mcp_resource=auth.jwt()->>'aud')
    )
 )
$$;
revoke all on function wenyan_private.authorized(boolean) from public,anon,authenticated;
-- Defence in depth if schema exposure/grants are accidentally changed later.
alter table wenyan_private.config enable row level security;
alter table wenyan_private.learner_settings enable row level security;
alter table wenyan_private.study_events enable row level security;
alter table wenyan_private.study_sessions enable row level security;
alter table wenyan_private.sync_receipts enable row level security;
alter table wenyan_private.session_forks enable row level security;
create policy wenyan_event_read on wenyan_private.study_events for select to authenticated
 using(owner_id=(select auth.uid()) and wenyan_private.authorized(false));
create policy wenyan_session_read on wenyan_private.study_sessions for select to authenticated
 using(owner_id=(select auth.uid()) and wenyan_private.authorized(false));
create policy wenyan_settings_read on wenyan_private.learner_settings for select to authenticated
 using(owner_id=(select auth.uid()) and wenyan_private.authorized(false));
-- Private definer is deliberate: table DML is not granted to web or MCP users.
-- Public entry points recheck owner/client; no arbitrary SQL or owner parameter.
create function wenyan_private.assert_event(e jsonb) returns void
language plpgsql set search_path='' as $$
declare k text:=e->>'kind'; v jsonb:=e->'value'; ms numeric;
begin
 if jsonb_typeof(e)<>'object' or length(e::text)>16384 or e->>'version' is distinct from '3'
  or coalesce(e->>'id','') !~ '^[a-zA-Z0-9-]{8,80}$' or e->>'device' is null or length(e->>'device')>80
  or e->>'key' is null or length(e->>'key')>100
  or jsonb_typeof(v) is distinct from 'object' or length(v::text)>8192
  or e->>'contentVersion' is distinct from 'netem-v1+ecdict-v1' or e->>'schedulerVersion' is distinct from 'ts-fsrs-5.2.3/epoch-1'
  or jsonb_typeof(e->'at') is distinct from 'number' then raise exception 'INVALID_EVENT'; end if;
 ms:=(e->>'at')::numeric;
 if ms<=0 or ms>extract(epoch from clock_timestamp())*1000+86400000 then raise exception 'CLOCK_OUT_OF_RANGE';end if;
 if k='review' then
  if coalesce(v->>'rating','') not in ('1','3') or (v ? 'firstCorrect' and jsonb_typeof(v->'firstCorrect')<>'boolean') or (v ? 'hinted' and jsonb_typeof(v->'hinted')<>'boolean') then raise exception 'INVALID_REVIEW';end if;
 elsif k='typing' then
  if jsonb_typeof(v->'correct') is distinct from 'boolean' then raise exception 'INVALID_TYPING';end if;
 elsif k in ('favorite','mastered') then
  if jsonb_typeof(v->'on') is distinct from 'boolean' then raise exception 'INVALID_FLAG';end if;
  if e ? 'previous' then
   if jsonb_typeof(e->'previous') is distinct from 'array' or jsonb_array_length(e->'previous')>1000 then raise exception 'INVALID_FLAG_PREVIOUS';end if;
   if exists(select 1 from jsonb_array_elements(e->'previous') p where jsonb_typeof(p) is distinct from 'string' or (p#>>'{}')!~'^[a-zA-Z0-9-]{8,80}$') then raise exception 'INVALID_FLAG_PREVIOUS';end if;
  end if;
 elsif k='undo' then
  if coalesce(v->>'id','')!~'^[a-zA-Z0-9-]{8,80}$' then raise exception 'INVALID_UNDO';end if;
 elsif k='task' then
  if jsonb_typeof(v->'done') is distinct from 'boolean' then raise exception 'INVALID_TASK';end if;
 elsif k='reading' then
  if jsonb_typeof(v->'article') is distinct from 'string' or coalesce(v->>'section','')!~'^[0-9]{1,3}$' or coalesce(v->>'paragraph','')!~'^[0-9]{1,3}$' then raise exception 'INVALID_READING';end if;
 elsif k='attempt' then
  if coalesce(v->>'field','') not in ('firstCorrect','hinted') or jsonb_typeof(v->'value') is distinct from 'boolean' or v->>'sessionId' is null or coalesce(v->>'index','')!~'^[0-9]{1,3}$' then raise exception 'INVALID_ATTEMPT';end if;
 else raise exception 'UNKNOWN_EVENT_KIND';end if;
end $$;
revoke all on function wenyan_private.assert_event(jsonb) from public,anon,authenticated;
create function wenyan_private.assert_checkpoint(cp jsonb) returns void
language plpgsql set search_path='' as $$
declare v jsonb:=cp->'value'; q jsonb:=v->'queue'; n integer; i integer; r jsonb; steps text; seen jsonb:='{}'; word text; mark text; prior text;
begin
 if jsonb_typeof(v) is distinct from 'object' or length(v::text)>8192 or cp->>'id' is distinct from v->>'id'
  or coalesce(cp->>'id','')!~'^[a-zA-Z0-9-]{8,80}$' or coalesce(cp->>'key','') not in ('english','literature')
  or jsonb_typeof(q) is distinct from 'array' or jsonb_typeof(v->'results') is distinct from 'array'
  or coalesce(v->>'index','')!~'^[0-9]{1,2}$' or length(coalesce(cp->>'writer','')) not between 1 and 80
 or jsonb_typeof(cp->'at') is distinct from 'number' or coalesce(cp->>'baseRevision','0')!~'^[0-9]{1,16}$'
 then raise exception 'INVALID_CHECKPOINT';end if;
 if (cp->>'at')::numeric<=0 or (cp->>'at')::numeric>extract(epoch from clock_timestamp())*1000+86400000 then raise exception 'CLOCK_OUT_OF_RANGE';end if;
 n:=jsonb_array_length(q);i:=(v->>'index')::integer;
 if n>50 or i>n or jsonb_array_length(v->'results')>n then raise exception 'INVALID_CHECKPOINT';end if;
 for r in select value from jsonb_array_elements(q) loop
  if jsonb_typeof(r)<>'string' or length(r#>>'{}')>=100 then raise exception 'INVALID_CHECKPOINT';end if;
 end loop;
 if cp->>'key'='english' and (v->>'mode' not in ('follow','recall','listen') or v->>'mode' is null) then raise exception 'INVALID_MODE';end if;
 if v ? 'smart' then
  if v->>'smart' is distinct from '1' or v->>'mode' is distinct from 'recall' or jsonb_typeof(v->'steps') is distinct from 'string' or v->>'steps'~'[^erx]' or length(v->>'steps')<>n then raise exception 'INVALID_SMART';end if;
  steps:=v->>'steps';
  for i in 0..n-1 loop
   word:=q->>i;mark:=substr(steps,i+1,1);prior:=coalesce(seen->>word,'');
   if position(mark in prior)>0 or (mark='e' and prior<>'') or (mark='x' and position('r' in prior)=0) then raise exception 'INVALID_SMART';end if;
   seen:=seen||jsonb_build_object(word,prior||mark);
  end loop;
  if (select count(*) from jsonb_object_keys(seen))>24 or exists(select 1 from jsonb_each_text(seen) t where position('r' in t.value)=0) then raise exception 'INVALID_SMART';end if;
 end if;
 for r in select value from jsonb_array_elements(v->'results') loop
  if jsonb_typeof(r) is distinct from 'object' or jsonb_typeof(r->'id') is distinct from 'string' or (r->'rating' is distinct from 'null'::jsonb and coalesce(r->>'rating','') not in ('1','3')) or (r ? 'firstCorrect' and jsonb_typeof(r->'firstCorrect')<>'boolean') or (r ? 'hinted' and jsonb_typeof(r->'hinted')<>'boolean') then raise exception 'INVALID_RESULT';end if;
 end loop;
 if cp->>'key'='literature' and jsonb_typeof(v->'article') is distinct from 'string' then raise exception 'INVALID_CHECKPOINT';end if;
 if v ? 'current' then
  if jsonb_typeof(v->'current') is distinct from 'object' or (v->'current' ? 'firstCorrect' and jsonb_typeof(v->'current'->'firstCorrect')<>'boolean') or (v->'current' ? 'hinted' and jsonb_typeof(v->'current'->'hinted')<>'boolean') or (v->'current' ? 'phase' and coalesce(v->'current'->>'phase','') not in ('input','correction','rating')) then raise exception 'INVALID_CURRENT';end if;
 end if;
end $$;
revoke all on function wenyan_private.assert_checkpoint(jsonb) from public,anon,authenticated;
create function public.wenyan_commit(p_op jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare
 u uuid:=auth.uid(); op uuid; saved wenyan_private.sync_receipts%rowtype;
 state wenyan_private.learner_settings%rowtype; ev jsonb; old jsonb; cp jsonb;
 ses wenyan_private.study_sessions%rowtype; base bigint; dependency jsonb; next_rev bigint;
 result jsonb; seqs jsonb:='{}'; cp_result jsonb; settings_result jsonb:='{}'; field text; proposal jsonb; cur jsonb;
begin
 if not wenyan_private.authorized(true) then raise exception 'FORBIDDEN' using errcode='42501';end if;
 if jsonb_typeof(p_op) is distinct from 'object' or p_op->>'v' is distinct from '3' or length(p_op::text)>1048576
  or jsonb_typeof(p_op->'events') is distinct from 'array' or jsonb_array_length(p_op->'events')>50 then raise exception 'INVALID_OPERATION';end if;
 op:=(p_op->>'id')::uuid;
 if op is null then raise exception 'INVALID_OPERATION_ID';end if;
 insert into wenyan_private.learner_settings(owner_id) values(u) on conflict do nothing;
 -- Serializes ALL mutations and pulls for this owner. Cursor is a commit order, not sequence allocation order.
 select * into state from wenyan_private.learner_settings where owner_id=u for update;
 select * into saved from wenyan_private.sync_receipts where owner_id=u and id=op;
 if found then
  if saved.input<>p_op then raise exception 'OP_CONTENT_CONFLICT';end if;
  return saved.result;
 end if;
 for ev in select value from jsonb_array_elements(p_op->'events') loop
  perform wenyan_private.assert_event(ev);
  select event into old from wenyan_private.study_events where owner_id=u and id=ev->>'id';
  if found then
   if old<>ev then raise exception 'ID_CONTENT_CONFLICT';end if;
  else
   if ev->>'kind'='undo' and not exists(select 1 from wenyan_private.study_events where owner_id=u and id=ev->'value'->>'id' and event->>'kind'<>'undo' and event->>'key'=ev->>'key') then raise exception 'UNDO_TARGET_MISSING';end if;
   state.watermark:=state.watermark+1;
   insert into wenyan_private.study_events(owner_id,id,seq,event) values(u,ev->>'id',state.watermark,ev);
  end if;
  select seq into next_rev from wenyan_private.study_events where owner_id=u and id=ev->>'id';
  seqs:=seqs||jsonb_build_object(ev->>'id',next_rev);
 end loop;
 cp:=p_op->'checkpoint';
 if cp is not null and cp<>'null'::jsonb then
  perform wenyan_private.assert_checkpoint(cp);
  select * into ses from wenyan_private.study_sessions where owner_id=u and id=cp->>'id';
  base:=coalesce((cp->>'baseRevision')::bigint,0);
  if cp->>'baseOperation' is not null then
   select r.result->'checkpoint' into dependency from wenyan_private.sync_receipts r where owner_id=u and id=(cp->>'baseOperation')::uuid;
   if dependency is null then raise exception 'DEPENDENCY_MISSING';end if;
   if dependency->>'conflict'='true' then base:=-1;else base:=(dependency->>'revision')::bigint;end if;
  end if;
  if base<>coalesce(ses.revision,0) then
   insert into wenyan_private.session_forks values(u,op,cp->>'id',cp,coalesce(ses.revision,0));
   cp_result:=jsonb_build_object('conflict',true,'revision',coalesce(ses.revision,0),'id',cp->>'id');
  else
   next_rev:=coalesce(ses.revision,0)+1;
   insert into wenyan_private.study_sessions values(u,cp->>'id',cp->>'key',cp->'value',next_rev,cp->>'writer',(cp->>'at')::bigint)
    on conflict(owner_id,id) do update set value=excluded.value,revision=excluded.revision,writer=excluded.writer,at=excluded.at;
   cp_result:=jsonb_build_object('conflict',false,'revision',next_rev,'id',cp->>'id');
  end if;
 end if;
 if p_op ? 'settings' then
  if jsonb_typeof(p_op->'settings')<>'object' or (select count(*) from jsonb_object_keys(p_op->'settings'))>3 then raise exception 'INVALID_SETTINGS';end if;
  for field,proposal in select * from jsonb_each(p_op->'settings') loop
   if field='newWordLimit' then
    if jsonb_typeof(proposal->'value') is distinct from 'number' or coalesce(proposal->>'value','') not in ('6','12','24') then raise exception 'INVALID_SETTING';end if;
   elsif field='layer' then
    if jsonb_typeof(proposal->'value') is distinct from 'string' or coalesce(proposal->>'value','') not in ('core','high','full') then raise exception 'INVALID_SETTING';end if;
   elsif field='timezone' then
    if not exists(select 1 from pg_timezone_names where name=proposal->>'value') then raise exception 'INVALID_TIMEZONE';end if;
   else raise exception 'UNKNOWN_SETTING';end if;
   cur:=state.fields->field;base:=coalesce((proposal->>'baseRevision')::bigint,0);
   if proposal->>'baseOperation' is not null then
    select r.result->'settings'->field into dependency from wenyan_private.sync_receipts r where owner_id=u and id=(proposal->>'baseOperation')::uuid;
    if dependency is null then raise exception 'DEPENDENCY_MISSING';end if;
    if dependency->>'conflict'='true' then base:=-1;else base:=(dependency->>'revision')::bigint;end if;
   end if;
   if base<>coalesce((cur->>'revision')::bigint,0) then settings_result:=settings_result||jsonb_build_object(field,jsonb_build_object('conflict',true,'current',cur));
   else
    next_rev:=coalesce((cur->>'revision')::bigint,0)+1;
    cur:=jsonb_build_object('value',proposal->'value','revision',next_rev);state.fields:=state.fields||jsonb_build_object(field,cur);
    settings_result:=settings_result||jsonb_build_object(field,cur||jsonb_build_object('conflict',false));
   end if;
  end loop;
 end if;
 update wenyan_private.learner_settings set watermark=state.watermark,fields=state.fields where owner_id=u;
 result:=jsonb_build_object('v',3,'operationId',op,'watermark',state.watermark,'eventSeqs',seqs,'checkpoint',cp_result,'settings',settings_result);
 insert into wenyan_private.sync_receipts(owner_id,id,input,result) values(u,op,p_op,result);
 return result;
end $$;
revoke all on function public.wenyan_commit(jsonb) from public,anon;
grant execute on function public.wenyan_commit(jsonb) to authenticated;
create function public.wenyan_pull(p_cursor bigint default 0,p_high bigint default null,p_limit integer default 100) returns jsonb
language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid(); state wenyan_private.learner_settings%rowtype; high bigint; next_cursor bigint; evs jsonb; cps jsonb;
begin
 if not wenyan_private.authorized(false) then raise exception 'FORBIDDEN' using errcode='42501';end if;
 if p_cursor is null or p_cursor<0 or p_limit is null or p_limit not between 1 and 500 then raise exception 'INVALID_PAGE';end if;
 insert into wenyan_private.learner_settings(owner_id) values(u) on conflict do nothing;
 select * into state from wenyan_private.learner_settings where owner_id=u for update;
 high:=coalesce(p_high,state.watermark);
 if high>state.watermark or p_cursor>high then raise exception 'INVALID_WATERMARK';end if;
 select coalesce(jsonb_agg(jsonb_build_object('event',event,'seq',seq) order by seq),'[]'),coalesce(max(seq),p_cursor) into evs,next_cursor
  from (select seq,event from wenyan_private.study_events where owner_id=u and seq>p_cursor and seq<=high order by seq limit p_limit) q;
 select coalesce(jsonb_agg(jsonb_build_object('id',id,'key',key,'value',value,'revision',revision,'writer',writer,'at',at)),'[]') into cps from wenyan_private.study_sessions where owner_id=u;
 return jsonb_build_object('v',3,'watermark',high,'nextCursor',next_cursor,'events',evs,'checkpoints',cps,'settings',state.fields,'asOf',clock_timestamp(),'offlineCoverage','unknown');
end $$;
revoke all on function public.wenyan_pull(bigint,bigint,integer) from public,anon;
grant execute on function public.wenyan_pull(bigint,bigint,integer) to authenticated;
-- No table DML grants. No public views. No broad owner-only OR policies.
revoke all on all tables in schema wenyan_private from public,anon,authenticated;
