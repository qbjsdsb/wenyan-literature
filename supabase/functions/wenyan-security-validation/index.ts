// Disabled after hosted denial checks. The former temporary acceptance probe
// could create disposable Auth users with service_role; keep no privileged
// validation surface deployed after the cloud foundation has been established.
Deno.serve(() => Response.json(
  {error: 'VALIDATION_PROBE_DISABLED'},
  {status: 410, headers: {'Cache-Control': 'no-store'}}
));
