-- Read-only, single PostgreSQL snapshot. Execute through the owner's trusted
-- management connector; save the result privately, never in Git or CI logs.
-- No Auth tables, email, owner UUID, API key, password or token are exported.
select jsonb_build_object(
 'schema',3,
 'exportedAt',clock_timestamp(),
 'events',
  coalesce((select jsonb_agg(event order by seq) from wenyan_private.study_events),'[]'::jsonb)
  || coalesce((select jsonb_agg(jsonb_build_object(
    'id','checkpoint-'||id,'device',writer,'kind','session','key',key,'at',at,'value',value
   ) order by at,id) from wenyan_private.study_sessions),'[]'::jsonb),
 'settings',coalesce((select fields from wenyan_private.learner_settings limit 1),'{}'::jsonb),
 'cloudBackup',jsonb_build_object(
   'format',1,'contentVersion','netem-v1+ecdict-v1','schedulerVersion','ts-fsrs-5.2.3/epoch-1',
   'watermark',coalesce((select watermark from wenyan_private.learner_settings limit 1),0),
   'eventSeqs',coalesce((select jsonb_object_agg(id,seq) from wenyan_private.study_events),'{}'::jsonb),
   'sessionRevisions',coalesce((select jsonb_object_agg(id,revision) from wenyan_private.study_sessions),'{}'::jsonb),
   'receipts',coalesce((select jsonb_agg(jsonb_build_object('id',id,'input',input,'result',result,'committedAt',committed_at) order by committed_at,id) from wenyan_private.sync_receipts),'[]'::jsonb),
   'forks',coalesce((select jsonb_agg(jsonb_build_object('operationId',operation_id,'sessionId',session_id,'proposal',proposal,'cloudRevision',cloud_revision)) from wenyan_private.session_forks),'[]'::jsonb),
   'offlineCoverage','unknown','authIncluded',false
 )
) as backup;
