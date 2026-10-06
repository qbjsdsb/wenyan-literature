-- Single MVCC snapshot; run only through trusted management tooling.
-- Result contains private learning data: never commit/upload it to GitHub.
-- Auth users, credentials, sessions and tokens are intentionally excluded.
select jsonb_build_object(
 'schema',3,'exportedAt',now(),'source','wenyan-hosted-snapshot',
 'localUnsyncedUnknown',true,
 'events',
   coalesce((select jsonb_agg(event order by seq) from wenyan_private.study_events),'[]'::jsonb)
   || coalesce((select jsonb_agg(jsonb_build_object(
     'id','checkpoint-'||id,'device',writer,'kind','session','key',key,'at',at,'value',value
   ) order by at,id) from wenyan_private.study_sessions),'[]'::jsonb),
 'settings',coalesce((select fields from wenyan_private.learner_settings),'{}'::jsonb),
 'watermark',coalesce((select watermark from wenyan_private.learner_settings),0),
 'cloudForks',coalesce((select jsonb_agg(jsonb_build_object(
   'operationId',operation_id,'sessionId',session_id,'proposal',proposal,'cloudRevision',cloud_revision
 ) order by operation_id) from wenyan_private.session_forks),'[]'::jsonb)
) as backup;
