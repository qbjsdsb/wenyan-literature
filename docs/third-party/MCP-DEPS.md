# Read-only MCP dependencies

Only the Edge function and Node acceptance tests use these packages. They do
not add a framework or AI API dependency to the desktop learning UI.

| Package | Pinned version | License | Source |
| --- | --- | --- | --- |
| @modelcontextprotocol/sdk | 1.32.1 | MIT | https://github.com/modelcontextprotocol/typescript-sdk |
| jose | 6.2.12 | MIT | https://github.com/panva/jose |
| zod | 4.3.6 | MIT | https://github.com/colinhacks/zod |

The function import map pins direct dependencies; Node's complete resolution
is in package-lock.json. Edge bundling is not a claim that hosted OAuth works.
The fixed NETEM ID ordering uses the same existing CC BY-NC-SA source snapshot;
see NETEMVocabulary-DATA.md. No personal learning records or Auth secrets are
included in the deployment payload.
