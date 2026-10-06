import {createMcpHandler} from '../../../src/mcp/server.js';
import catalogFile from '../../../public/data/english/netem-v1.json' with {type:'json'};
const url=Deno.env.get('SUPABASE_URL')!;
// Public browser key only. Deliberately never read SUPABASE_SERVICE_ROLE_KEY.
const key=Deno.env.get('SUPABASE_ANON_KEY')!;
const handler=createMcpHandler({supabaseUrl:url,publishableKey:key,resource:url+'/functions/v1/wenyan-mcp',website:'https://qbjsdsb.github.io/wenyan-literature/',catalog:catalogFile.catalog});
Deno.serve(handler);
